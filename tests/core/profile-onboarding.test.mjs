// IT: Exercise real route handlers with an in-memory capture boundary; no live DB or provider writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

// IT: Test-only key, never a deployment credential.
process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
const server = await createServer({ configFile: false, server: { middlewareMode: true },
  resolve: { alias: { $lib: resolve('src/lib') } },
  plugins: [{ name: 'capture-test-boundary', enforce: 'pre',
    resolveId(id) {
      for (const dep of ['db','auth','leads/link','server/userEmail']) {
        if (id === '$lib/' + dep || id === resolve('src/lib',dep)) return '\0mock:$lib/' + dep;
      }
      if (id.endsWith('/core/contactCapture') || id.endsWith('/core/contactCaptureToken') || id.endsWith('/core/contacts')) return '\0mock:' + id.split('/').at(-1);
    },
    load(id) {
      if (id === '\0mock:$lib/db') return `export const prisma = new Proxy({}, {get:(_,key)=>globalThis.__onboardingDb[key]});`;
      if (id === '\0mock:$lib/auth') return `export async function hashPassword(){return 'test-hash';} export async function createSession(){return {cookie:'session',expiresAt:new Date()};} export function setSessionCookie(){}`;
      if (id === '\0mock:$lib/leads/link') return `export async function linkLeadsForUser(){}`;
      if (id === '\0mock:$lib/server/userEmail') return `export async function findUserByEmail(){return null;} export function encryptedUserEmailFields(){return {email_Enc:'encrypted',email_Idx:'index'};}`;
      if (id === '\0mock:contactCapture') return `export async function publishedCaptureProfile(slug) { return {id:slug==='other'?'other-profile':'profile',slug,userId:'owner',displayName:'Terence'}; }
        export async function capturePrivateContact(profile,input) { if(globalThis.__onboardingCaptureFailure) throw Error('storage unavailable'); globalThis.__onboardingCaptures.push({profile,input}); }`;
      if (id === '\0mock:contactCaptureToken') return `export const CAPTURE_COOKIE='capture'; export const issueContactCaptureToken=()=> 'token';
        export function verifyContactCaptureToken(token) { if(token!=='token') throw Error('invalid'); return {nonce:'nonce',via:'qr'}; }`;
      if (id === '\0mock:contacts') return `export function validateContactDetails(v) { if (!v.name.trim()) throw Error('Name required'); return v; }`;
    }
  }]
});
const draft = await server.ssrLoadModule('/src/lib/server/profileOnboarding.ts');
const returns = await server.ssrLoadModule('/src/lib/server/networkJoinReturn.ts');
const route = await server.ssrLoadModule('/src/routes/u/[slug]/share-details/+page.server.ts');

function event(values, origin = 'https://relish.test') {
  const stored = new Map();
  const writes = [];
  return { params: {slug:'terence'}, locals:{}, url:new URL('https://relish.test/u/terence/share-details'),
    request:new Request('https://relish.test/u/terence/share-details', {method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)}),
    cookies:{get:k=>stored.get(k),delete:k=>stored.delete(k),set:(k,v,options)=>{stored.set(k,v);writes.push({k,v,options});}}, writes, setHeaders(){} };
}

try {
  await test('auth returns allow only exact onboarding and unchanged Network invitation paths', () => {
    assert.equal(returns.safeAuthReturn(draft.PROFILE_ONBOARDING_RETURN), draft.PROFILE_ONBOARDING_RETURN);
    assert.equal(returns.safeAuthReturn('/network/join/alice'), '/network/join/alice');
    for (const v of ['https://evil.test','//evil.test','/settings/profile?onboarding=1&next=//evil.test','/settings/profile','/network/join/alice?next=evil','/%2f%2fevil.test']) assert.equal(returns.safeAuthReturn(v),null);
    assert.equal(returns.safeNetworkJoinReturn(draft.PROFILE_ONBOARDING_RETURN),null);
  });
  await test('draft is encrypted, authenticated, bounded, expires and rejects malformed input', () => {
    const input = {name:'<script>Guest</script>',email:'guest@example.test',phone:'+61400000000'};
    const encoded = draft.encodeProfileDraft(input,1000);
    assert.ok(!encoded.includes(input.email));
    assert.deepEqual(draft.decodeProfileDraft(encoded,1001),input);
    for (const v of [undefined,'broken',encoded+'x',encoded.slice(0,-5),'x'.repeat(5000)]) assert.equal(draft.decodeProfileDraft(v,1001),null);
    assert.equal(draft.decodeProfileDraft(encoded,1000+1800000),null);
    assert.equal(draft.decodeProfileDraft(encoded,999),null);
    assert.equal(draft.profileDraft({name:'x'.repeat(300),email:42}).name.length,200);
    assert.equal(draft.profileDraft({email:42}).email,'');
  });
  await test('explicit signup intent stores only a secure temporary draft, never another Contact', async () => {
    globalThis.__onboardingCaptures=[];
    const e=event({intent:'create-profile',name:'Guest',email:'guest@example.test',phone:'123'});
    await assert.rejects(route.actions.default(e), r=>r.status===303 && r.location==='/auth/register?next=%2Fsettings%2Fprofile%3Fonboarding%3D1');
    assert.equal(globalThis.__onboardingCaptures.length,0);
    assert.equal(e.writes.length,1);
    assert.deepEqual(e.writes[0].options,{path:'/',httpOnly:true,sameSite:'lax',secure:true,maxAge:1800});
    assert.equal(draft.decodeProfileDraft(e.writes[0].v).name,'Guest');
  });
  await test('Skip load creates no Contact and passes no invented visitor details', async () => {
    globalThis.__onboardingCaptures=[];
    const e=event({}); e.url.search='?step=create';
    const result=await route.load(e);
    assert.equal(result.createStep,true);
    assert.equal(result.isSignedIn,false);
    assert.equal(globalThis.__onboardingCaptures.length,0);
  });
  await test('Send retains consent/token guards and returns only visitor-entered preview fields', async () => {
    globalThis.__onboardingCaptures=[];
    const result=await route.actions.default(event({name:'Guest',email:'guest@example.test',contactConsent:'yes',captureToken:'token'}));
    assert.equal(result.shared,true); assert.equal(result.values.name,'Guest');
    assert.equal(globalThis.__onboardingCaptures.length,1);
    assert.equal('contactId' in result,false);
    const missingConsent=await route.actions.default(event({name:'Guest',captureToken:'token'}));
    assert.equal(missingConsent.status,400);
    const badToken=await route.actions.default(event({name:'Guest',contactConsent:'yes',captureToken:'bad'}));
    assert.equal(badToken.status,403);
    assert.equal(globalThis.__onboardingCaptures.length,1);
  });
  await test('successful share followed by Maybe later and another download skips the sharing form', async () => {
    globalThis.__onboardingCaptures=[];
    const e=event({name:'Guest',email:'guest@example.test',contactConsent:'yes',captureToken:'token'});
    await route.actions.default(e);
    const receipt=e.cookies.get(draft.CONTACT_SHARED_COOKIE);
    assert.ok(receipt); assert.ok(!receipt.includes('guest@example.test'));
    const repeat=event({});repeat.cookies=e.cookies;
    assert.equal((await route.load(repeat)).createStep,true);
    assert.equal((await route.load(repeat)).createStep,true);
    assert.equal(globalThis.__onboardingCaptures.length,1);
    repeat.params.slug='other';
    assert.equal((await route.load(repeat)).createStep,false);
  });
  await test('Skip, honeypot and failed storage do not mark details as shared', async () => {
    const skipped=event({});skipped.url.search='?step=create';
    await route.load(skipped);skipped.url.search='';
    assert.equal((await route.load(skipped)).createStep,false);
    const trap=event({website_check:'bot'});await route.actions.default(trap);
    assert.equal(draft.hasSharedContact(trap.cookies,'profile'),false);
    const failed=event({name:'Guest',contactConsent:'yes',captureToken:'token'});
    globalThis.__onboardingCaptureFailure=true;
    try { assert.equal((await route.actions.default(failed)).status,503); }
    finally { delete globalThis.__onboardingCaptureFailure; }
    assert.equal(draft.hasSharedContact(failed.cookies,'profile'),false);
    assert.equal((await route.load(failed)).createStep,false);
  });
  await test('shared-profile receipts expire, reject tampering and remain bounded and profile-specific', () => {
    const e=event({}),now=Date.now();
    draft.rememberContactShare(e.cookies,e.url,'first',now);
    assert.equal(draft.hasSharedContact(e.cookies,'first',now),true);
    assert.equal(draft.hasSharedContact(e.cookies,'other',now),false);
    assert.equal(draft.hasSharedContact(e.cookies,'first',now-1),false);
    assert.equal(draft.hasSharedContact(e.cookies,'first',now+30*24*60*60*1000),false);
    const value=e.cookies.get(draft.CONTACT_SHARED_COOKIE);
    e.cookies.set(draft.CONTACT_SHARED_COOKIE,value+'x',{});
    assert.equal(draft.hasSharedContact(e.cookies,'first',now),false);
    for(let i=0;i<20;i++) draft.rememberContactShare(e.cookies,e.url,'profile-'+i,now);
    assert.equal(draft.hasSharedContact(e.cookies,'profile-0',now),false);
    assert.equal(draft.hasSharedContact(e.cookies,'profile-4',now),true);
    assert.equal(draft.hasSharedContact(e.cookies,'profile-19',now),true);
    assert.deepEqual(e.writes.at(-1).options,{path:'/u',httpOnly:true,sameSite:'lax',secure:true,maxAge:2592000});
  });
  await test('cross-origin signup/capture requests cannot store drafts or Contacts', async () => {
    for (const intent of ['', 'create-profile']) {
      const e=event({intent,name:'Guest'},'https://evil.test');
      assert.equal((await route.actions.default(e)).status,403); assert.equal(e.writes.length,0);
    }
  });
  await test('signed-in visitors reuse My Profiles without altering a profile or writing a draft', async () => {
    const e=event({intent:'create-profile'});e.locals.user={id:'visitor'};
    await assert.rejects(route.actions.default(e),r=>r.status===303 && r.location==='/profiles');
    assert.equal(e.writes.length,0);
  });
  await test('signup uses draft name, creates an unpublished profile, then returns to the existing editor', async () => {
    const registration=await server.ssrLoadModule('/src/routes/auth/register/+page.server.ts');
    const created=[];
    globalThis.__onboardingDb={user:{create:async args=>{created.push(args.data);return {id:'new-user'};}}};
    const e=event({email:'guest@example.test',password:'test-password'});
    e.url.search='?next='+encodeURIComponent(draft.PROFILE_ONBOARDING_RETURN);
    draft.saveProfileDraft(e.cookies,e.url,{name:'Guest',email:'guest@example.test',phone:'123'});
    const data=await registration.load(e);
    assert.equal(data.draft.email,'guest@example.test');
    await assert.rejects(registration.actions.default(e),r=>r.status===303 && r.location===draft.PROFILE_ONBOARDING_RETURN);
    assert.equal(created.length,1);
    assert.equal(created[0].profiles.create.displayName,'Guest');
    assert.equal(created[0].profiles.create.isPublished,false);
    assert.equal('emailPublic' in created[0].profiles.create,false);
    assert.equal('phonePublic' in created[0].profiles.create,false);
    // IT: Ordinary registrations retain their established defaults.
    const ordinary=event({email:'other@example.test',password:'test-password'});
    await assert.rejects(registration.actions.default(ordinary),r=>r.location==='/');
    assert.equal('isPublished' in created[1].profiles.create,false);
  });
  await test('editor reads browser draft only for explicit onboarding, retaining owner-scoped profile lookup', async () => {
    const editor=await server.ssrLoadModule('/src/routes/settings/profile/+page.server.ts');
    const queries=[];
    globalThis.__onboardingDb={profile:{findFirst:async args=>{queries.push(args);return {id:'owned',kind:'business',slug:'mine',isPublished:false};}}};
    const e=event({});e.locals.user={id:'new-user'};e.url.search='?onboarding=1';
    draft.saveProfileDraft(e.cookies,e.url,{name:'Guest',email:'guest@example.test',phone:'123'});
    const data=await editor.load(e);
    assert.equal(data.draft.phone,'123');assert.equal(queries[0].where.userId,'new-user');
    e.url.search=''; assert.equal((await editor.load(e)).draft,null);
  });
  await test('successful editor save clears draft and goes to QR; failed validation retains draft', async () => {
    const editor=await server.ssrLoadModule('/src/routes/settings/profile/+page.server.ts');
    const updates=[];
    globalThis.__onboardingDb={profile:{findFirst:async args=>{
      assert.equal(args.where.userId,'new-user');
      return {id:'owned',kind:'business',slug:'mine',publicMeta:{}};
    },update:async args=>{updates.push(args);}}};
    const invalid=event({profileOnboarding:'1'});invalid.locals.user={id:'new-user'};
    draft.saveProfileDraft(invalid.cookies,invalid.url,{name:'Guest',email:'guest@example.test',phone:'123'});
    assert.equal((await editor.actions.save(invalid)).status,400);
    assert.ok(draft.readProfileDraft(invalid.cookies));assert.equal(updates.length,0);
    const e=event({profileOnboarding:'1',profileId:'owned',displayName:'Guest',kind:'business',emailPublic:'guest@example.test',isPublished:'on'});
    e.locals.user={id:'new-user'};
    draft.saveProfileDraft(e.cookies,e.url,{name:'Guest',email:'guest@example.test',phone:'123'});
    await assert.rejects(editor.actions.save(e),r=>r.status===303 && r.location==='/share?profile=mine');
    assert.equal(updates.length,1);assert.equal(updates[0].data.isPublished,true);
    assert.equal(draft.readProfileDraft(e.cookies),null);
  });
  // IT: Compile and render the actual Svelte screen to catch conditional and escaping regressions.
  const out=resolve('.svelte-kit/onboarding-test'); mkdirSync(out,{recursive:true});
  const compiled=compile(readFileSync('src/routes/u/[slug]/share-details/+page.svelte','utf8'),{generate:'server'});
  writeFileSync(out+'/capture.mjs',compiled.js.code);
  const Component=(await import(out+'/capture.mjs')).default;
  const data={profile:{name:'Terence',slug:'terence'},captureToken:'token',createStep:false,isSignedIn:false};
  await test('step two renders Send, Skip and consent without signup requirements',()=>{
    const html=render(Component,{props:{data}}).body;
    assert.match(html,/Share your details with Terence/);assert.match(html,/>Skip</);assert.match(html,/>Send</);assert.match(html,/name="contactConsent"/);assert.doesNotMatch(html,/Create my Relish profile/);
  });
  await test('Send and Skip each show optional step three; preview escapes submitted markup',()=>{
    const html=render(Component,{props:{data,form:{shared:true,values:{name:'<script>Guest</script>',email:'guest@example.test',phone:''}}}}).body;
    assert.match(html,/Your details have been shared with Terence/);assert.match(html,/Create my Relish profile/);assert.match(html,/&lt;script>Guest/);assert.doesNotMatch(html,/<script>Guest/);
    const skipped=render(Component,{props:{data:{...data,createStep:true}}}).body;
    assert.match(skipped,/Create my Relish profile/);assert.match(skipped,/Maybe later/);assert.doesNotMatch(skipped,/Your details have been shared/);
  });
} finally { await server.close(); delete globalThis.__onboardingCaptures; delete globalThis.__onboardingDb; }
