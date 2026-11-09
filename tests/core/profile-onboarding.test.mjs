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
for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OAUTH_REDIRECT_URI']) process.env[name] = 'synthetic';
const server = await createServer({ configFile: false, ssr: { noExternal: ['jose'] }, server: { middlewareMode: true },
  resolve: { alias: { $lib: resolve('src/lib') } },
  plugins: [{ name: 'capture-test-boundary', enforce: 'pre',
    resolveId(id) {
      for (const dep of ['db','auth','leads/link','server/userEmail','server/loginThrottle','server/foundation/provisioning','server/tokens','server/pilot','server/core/pilotSmsCallback']) {
        if (id === '$lib/' + dep || id === resolve('src/lib',dep)) return '\0mock:$lib/' + dep;
      }
      if (id === '$app/forms') return '\0mock:forms';
      if (id === 'jose') return '\0mock:jose';
      if (id.endsWith('/core/contactCapture') || id.endsWith('/core/contactCaptureToken') || id.endsWith('/core/contacts')) return '\0mock:' + id.split('/').at(-1);
    },
    load(id) {
      if (id === '\0mock:$lib/db') return `export const prisma = new Proxy({}, {get:(_,key)=>key==='$transaction' ? async fn=>fn(globalThis.__onboardingDb) : globalThis.__onboardingDb[key]});`;
      if (id === '\0mock:$lib/auth') return `export async function hashPassword(){return 'test-hash';} export async function createSession(){return {cookie:'session',expiresAt:new Date()};} export function setSessionCookie(){} export async function verifyPassword(_,p){return p==='correct';} export function clearSessionCookie(){}`;
      if (id === '\0mock:$lib/leads/link') return `export async function linkLeadsForUser(){globalThis.__onboardingClaims++;}`;
      if (id === '\0mock:$lib/server/userEmail') return `export async function findUserByEmail(email){globalThis.__onboardingLookups.push(email);return globalThis.__onboardingUser || null;} export function encryptedUserEmailFields(){return {email_Enc:'encrypted',email_Idx:'index'};} export function decryptUserEmail(){return 'account@example.test';} export async function setUserEmail(){throw Error('fixture has encrypted email');}`;
      if (id === '\0mock:forms') return 'export function enhance(){}';
      if (id === '\0mock:jose') return `export const createRemoteJWKSet=()=>({}); export const jwtVerify=async(_token,_keys,options)=>(globalThis.__googleOptions=options,{payload:globalThis.__googlePayload || {sub:'google-account',email:'google@example.test',email_verified:true,nonce:'nonce',name:'Verified name'}});`;
      if (id === '\0mock:$lib/server/foundation/provisioning') return `export async function provisionNewFoundationAccount(){} export async function accountDomain(){return 'LEGACY';} export async function usesLegacyProfileServices(){return true;}`;
      if (id === '\0mock:$lib/server/loginThrottle') return `export async function consumePasswordSignupAttempt(){return true;} export async function consumePasswordLoginAttempt(){return true;} export async function clearSuccessfulLoginAccountBucket(){}`;
      if (id === '\0mock:$lib/server/tokens') return `export const createInviteToken=async()=>({token:'fixture-invite'});`;
      if (id === '\0mock:$lib/server/pilot') return `export const pilotDomainForKind=()=>null; export const getOrCreatePilotVisitor=()=>{}; export const ensurePilotSelfContact=()=>{}; export const pilotSource=()=>{}; export const recordPilotEvent=()=>{};`;
      if (id === '\0mock:$lib/server/core/pilotSmsCallback') return `export const pilotTermsConfig=()=>({ready:false}); export const issuePilotSmsInvitation=()=>{};`;
      if (id === '\0mock:contactCapture') return `export async function publishedCaptureProfile(slug) { return {id:slug==='other'?'other-profile':'profile',slug,userId:'owner',displayName:'Terence'}; }
        export async function capturePrivateContact(profile,input) { if(globalThis.__onboardingCaptureFailure) throw Error('storage unavailable'); globalThis.__onboardingCaptures.push({profile,input}); }`;
      if (id === '\0mock:contactCaptureToken') return `export const CAPTURE_COOKIE='capture'; export const issueContactCaptureToken=()=> 'token';
        export function verifyContactCaptureToken(token) { if(token!=='token') throw Error('invalid'); return {nonce:'nonce',via:'qr'}; }`;
      if (id === '\0mock:contacts') return `export function validateContactDetails(v) { if (!v.name.trim()) throw Error('Name required'); return v; }`;
    }
  }]
});
globalThis.__onboardingClaims = 0;
globalThis.__onboardingLookups = [];
const draft = await server.ssrLoadModule('/src/lib/server/profileOnboarding.ts');
const returns = await server.ssrLoadModule('/src/lib/server/networkJoinReturn.ts');
const route = await server.ssrLoadModule('/src/routes/u/[slug]/share-details/+page.server.ts');

function event(values, origin = 'https://relish.test') {
  const stored = new Map();
  const writes = [];
  return { params: {slug:'terence'}, locals:{}, url:new URL('https://relish.test/u/terence/share-details'),
    request:new Request('https://relish.test/u/terence/share-details', {method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)}),
    cookies:{get:k=>stored.get(k),delete:k=>stored.delete(k),set:(k,v,options)=>{stored.set(k,v);writes.push({k,v,options});}}, writes, getClientAddress:()=>'127.0.0.1', setHeaders(){} };
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
    const badToken=await route.actions.default(event({name:'Guest',email:'guest@example.test',contactConsent:'yes',captureToken:'bad'}));
    assert.equal(badToken.status,403);
    assert.equal(globalThis.__onboardingCaptures.length,1);
  });
  await test('sharing a name alone leaves no contact or browser receipt', async () => {
    globalThis.__onboardingCaptures = [];
    const e = event({name:'Guest',contactConsent:'yes',captureToken:'token'});
    const result = await route.actions.default(e);
    assert.equal(result.status,400);
    assert.match(result.data.error,/email address or mobile number/);
    assert.equal(globalThis.__onboardingCaptures.length,0);
    assert.equal(draft.hasSharedContact(e.cookies,'profile'),false);
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
    const failed=event({name:'Guest',email:'guest@example.test',contactConsent:'yes',captureToken:'token'});
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
    globalThis.__onboardingDb={user:{create:async args=>{created.push(args.data);return {id:'new-user',profiles:[{id:'owned'}]};}}};
    const e=event({email:'guest@example.test',password:'test-password'});
    e.url.search='?next='+encodeURIComponent(draft.PROFILE_ONBOARDING_RETURN);
    draft.saveProfileDraft(e.cookies,e.url,{name:'Guest',email:'guest@example.test',phone:'123'});
    const data=await registration.load(e);
    assert.equal(data.draft.email,'guest@example.test');
    await assert.rejects(registration.actions.default(e),r=>r.status===303 && r.location===draft.PROFILE_ONBOARDING_RETURN);
    assert.equal(globalThis.__onboardingClaims,0);
    assert.equal(draft.readProfileDraft(e.cookies),null);
    assert.equal(draft.readOwnedProfileDraft(e.cookies,'new-user','owned').phone,'123');
    assert.equal(created.length,1);
    assert.equal(created[0].profiles.create.displayName,'Guest');
    assert.equal(created[0].profiles.create.isPublished,false);
    assert.equal('emailPublic' in created[0].profiles.create,false);
    assert.equal('phonePublic' in created[0].profiles.create,false);
    // Ordinary registration follows the same explicit publication review without a draft.
    const ordinary=event({email:'other@example.test',password:'test-password'});
    await assert.rejects(registration.actions.default(ordinary),r=>r.location===draft.PROFILE_ONBOARDING_RETURN);
    assert.equal(created[1].profiles.create.isPublished,false);
    assert.equal(created[1].profiles.create.displayName,'New Relish user');
    assert.equal(globalThis.__onboardingClaims,0);
  });
  await test('editor reads browser draft only for explicit onboarding, retaining owner-scoped profile lookup', async () => {
    const editor=await server.ssrLoadModule('/src/routes/settings/profile/+page.server.ts');
    const queries=[];
    globalThis.__onboardingDb={profile:{findFirst:async args=>{queries.push(args);return {id:'owned',kind:'business',slug:'mine',isPublished:false};}}};
    const e=event({});e.locals.user={id:'new-user'};e.url.search='?onboarding=1';
    draft.saveProfileDraft(e.cookies,e.url,{name:'Guest',email:'guest@example.test',phone:'123'});
    assert.equal((await editor.load(e)).draft,null);
    draft.finishProfileAuth(e.cookies,e.url,draft.PROFILE_ONBOARDING_RETURN,'new-user','owned');
    assert.equal(draft.readOwnedProfileDraft(e.cookies,'other-user','owned'),null);
    assert.equal(draft.readOwnedProfileDraft(e.cookies,'new-user','other-profile'),null);
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
    const invalid=event({});invalid.locals.user={id:'new-user'};
    draft.saveProfileDraft(invalid.cookies,invalid.url,{name:'Guest',email:'guest@example.test',phone:'123'});
    draft.finishProfileAuth(invalid.cookies,invalid.url,draft.PROFILE_ONBOARDING_RETURN,'new-user','owned');
    assert.equal((await editor.actions.save(invalid)).status,400);
    assert.ok(draft.readOwnedProfileDraft(invalid.cookies,'new-user','owned'));assert.equal(updates.length,0);
    const e=event({profileId:'owned',displayName:'Guest',kind:'business',emailPublic:'guest@example.test',publishNow:'yes'});
    e.locals.user={id:'new-user'};
    draft.saveProfileDraft(e.cookies,e.url,{name:'Guest',email:'guest@example.test',phone:'123'});
    draft.finishProfileAuth(e.cookies,e.url,draft.PROFILE_ONBOARDING_RETURN,'new-user','owned');
    await assert.rejects(editor.actions.save(e),r=>r.status===303 && r.location==='/share?profile=mine');
    assert.equal(updates.length,1);assert.equal(updates[0].data.isPublished,true);
    assert.equal(e.cookies.get(draft.PROFILE_DRAFT_COOKIE),undefined);
  });
  await test('Save for later keeps edits private and publication-only actions enforce ownership', async () => {
    const editor = await server.ssrLoadModule('/src/routes/settings/profile/+page.server.ts');
    const updates = [];
    globalThis.__onboardingDb = { profile: {
      findFirst: async ({ where }) => where.userId === 'new-user' && where.id === 'owned'
        ? { id: 'owned', kind: 'business', slug: 'mine', displayName: 'Owner', isPublished: true, publicMeta: {} }
        : null,
      update: async (args) => updates.push(args)
    } };
    const save = event({ profileId: 'owned', displayName: 'Draft edits', kind: 'business', isPublished: 'on' });
    save.locals.user = { id: 'new-user' };
    await assert.rejects(editor.actions.save(save), (r) => r.status === 303 && r.location === '/profiles');
    assert.equal(updates[0].data.isPublished, false);
    assert.equal(updates[0].data.displayName, 'Draft edits');

    const foreign = event({ profileId: 'owned', publication: 'unpublish' });
    foreign.locals.user = { id: 'other-user' };
    assert.equal((await editor.actions.publication(foreign)).status, 404);
    assert.equal(updates.length, 1);

    for (const publication of ['unpublish', 'publish']) {
      const owned = event({ profileId: 'owned', publication });
      owned.locals.user = { id: 'new-user' };
      await assert.rejects(editor.actions.publication(owned), (r) => r.status === 303);
      assert.deepEqual(updates.at(-1), {
        where: { id: 'owned', userId: 'new-user' },
        data: { isPublished: publication === 'publish' }
      });
    }
  });
  await test('expired sessions retain the allowlisted review destination and logout clears the draft', async () => {
    const editor=await server.ssrLoadModule('/src/routes/settings/profile/+page.server.ts');
    const logout=await server.ssrLoadModule('/src/routes/auth/logout/+server.ts');
    const e=event({});
    e.url=new URL('https://relish.test/settings/profile?onboarding=1&profile=foreign');
    e.locals.appOrigin=e.url.origin;
    await assert.rejects(editor.load(e),r=>r.status===303 &&
      new URL(r.location).searchParams.get('next')===draft.PROFILE_ONBOARDING_RETURN);
    const input={name:'Visitor',email:'visitor@example.test',phone:'123'};
    e.cookies.set(draft.PROFILE_DRAFT_COOKIE,draft.encodeProfileDraft(input,Date.now()-29*60*1000),{});
    draft.finishProfileAuth(e.cookies,e.url,draft.PROFILE_ONBOARDING_RETURN,'account','owned');
    const bound=e.writes.at(-1);
    assert.ok(bound.options.maxAge <= 60);
    assert.match(bound.v,/^v2\./);
    await assert.rejects(logout.POST(e),r=>r.status===303);
    assert.equal(e.cookies.get(draft.PROFILE_DRAFT_COOKIE),undefined);
  });
  await test('password sign-in retains a bound draft only for the same account', async () => {
    const login=await server.ssrLoadModule('/src/routes/auth/login/+page.server.ts');
    const e=event({email:'account@example.test',password:'correct'});
    e.url.search='?next='+encodeURIComponent(draft.PROFILE_ONBOARDING_RETURN);
    e.getClientAddress=()=> '127.0.0.1';
    globalThis.__onboardingUser={id:'account',passwordHash:'hash'};
    globalThis.__onboardingDb={profile:{findFirst:async()=>({id:'owned'})}};
    const before=globalThis.__onboardingClaims;
    try {
      draft.saveProfileDraft(e.cookies,e.url,{name:'Visitor',email:'visitor@example.test',phone:'123'});
      await assert.rejects(login.actions.default(e), r=>r.status===303 && r.location==='/profiles');
      assert.equal(e.cookies.get(draft.PROFILE_DRAFT_COOKIE),undefined);

      draft.saveProfileDraft(e.cookies,e.url,{name:'Visitor',email:'visitor@example.test',phone:'123'});
      draft.finishProfileAuth(e.cookies,e.url,draft.PROFILE_ONBOARDING_RETURN,'account','owned');
      const wrong={...e,request:new Request(e.url,{method:'POST',body:new URLSearchParams({email:'account@example.test',password:'wrong'})})};
      assert.equal((await login.actions.default(wrong)).status,400);
      assert.equal(draft.readOwnedProfileDraft(e.cookies,'account','owned').phone,'123');
      const retry={...e,request:new Request(e.url,{method:'POST',body:new URLSearchParams({email:'account@example.test',password:'correct'})})};
      await assert.rejects(login.actions.default(retry), r=>r.status===303 && r.location===draft.PROFILE_ONBOARDING_RETURN);
      assert.equal(draft.readOwnedProfileDraft(e.cookies,'account','owned').phone,'123');
      assert.equal(globalThis.__onboardingClaims,before);
    } finally { delete globalThis.__onboardingUser; }
  });
  await test('Google signup creates unpublished profile atomically and only new accounts receive prefills', async () => {
    const google=await server.ssrLoadModule('/src/routes/auth/google/callback/+server.ts');
    const e=event({});
    e.url=new URL('https://relish.test/auth/google/callback?code=code&state=state');
    e.locals.sessionCookie={options:{secure:true}};
    e.getClientAddress=()=> '127.0.0.2';
    e.fetch=async()=>Response.json({id_token:'fixture-token'});
    const created=[];
    let returning=false;
    globalThis.__onboardingDb={
      user:{
        findFirst:async()=>returning ? {id:'returning'} : null,
        findUnique:async()=>({email_Enc:'encrypted',email_Idx:'index'}),
        create:async({data})=>{created.push(data);return {id:'google-user',profiles:[{id:'google-profile'}]};}
      },
      profile:{findFirst:async()=>({id:'returning-profile'})},
      oAuthAccount:{upsert:async()=>({userId:'returning'}),update:async()=>({})}
    };
    const before=globalThis.__onboardingClaims;
    function start() {
      for (const [key,value] of Object.entries({oauth_state:'state',oauth_nonce:'nonce',oauth_pkce:'pkce',oauth_network_next:draft.PROFILE_ONBOARDING_RETURN})) e.cookies.set(key,value,{});
      draft.saveProfileDraft(e.cookies,e.url,{name:'Visitor name',email:'different@example.test',phone:'123'});
    }
    start();
    await assert.rejects(google.GET(e),r=>r.status===303 && r.location===draft.PROFILE_ONBOARDING_RETURN);
    assert.equal(created[0].email_Enc,'encrypted');
    assert.equal(globalThis.__onboardingLookups.at(-1),'google@example.test');
    assert.equal(created[0].profiles.create.displayName,'Visitor name');
    assert.equal(created[0].profiles.create.isPublished,false);
    assert.equal(created[0].profiles.create.emailPublic,undefined);
    assert.equal(draft.readOwnedProfileDraft(e.cookies,'google-user','google-profile').phone,'123');
    returning=true;
    start();
    await assert.rejects(google.GET(e),r=>r.status===303 && r.location==='/profiles');
    assert.equal(created.length,1);
    assert.equal(e.cookies.get(draft.PROFILE_DRAFT_COOKIE),undefined);
    assert.equal(globalThis.__onboardingClaims,before);
    // Exchange continuation uses the same Google verification with a fixed, secret-free return.
    returning=false;
    start();e.cookies.set('oauth_network_next','/exchange/claim',{});
    await assert.rejects(google.GET(e),r=>r.status===303 && r.location==='/exchange/claim');
    assert.equal(created.at(-1).profiles.create.isPublished,false);
    assert.equal(draft.readOwnedProfileDraft(e.cookies,'google-user','google-profile').phone,'123');

  });
  await test('Google callback rejects missing/mismatched nonce and coerced email flags before account lookup',async()=>{
    const google=await server.ssrLoadModule('/src/routes/auth/google/callback/+server.ts');
    const variants=[{sub:'g',email:'test@example.test',email_verified:true},{sub:'g',email:'test@example.test',email_verified:true,nonce:'wrong'},{sub:'g',email:'test@example.test',email_verified:'true',nonce:'nonce'}];
    try{for(let n=0;n<variants.length;n++){
      globalThis.__googlePayload=variants[n];const e=event({});
      e.url=new URL('https://relish.test/auth/google/callback?code=code&state=state');
      e.locals.sessionCookie={options:{secure:true}};e.getClientAddress=()=> 'nonce-case-'+n;
      e.fetch=async()=>new Response(JSON.stringify({id_token:'synthetic-token'}),{status:200});
      for(const [k,v] of Object.entries({oauth_state:'state',oauth_nonce:'nonce',oauth_pkce:'pkce'}))e.cookies.set(k,v,{});
      const before=globalThis.__onboardingLookups.length;
      await assert.rejects(google.GET(e),err=>err.status===400);
      assert.equal(globalThis.__onboardingLookups.length,before);
      assert.deepEqual(globalThis.__googleOptions.issuer,['https://accounts.google.com','accounts.google.com']);
      assert.ok(globalThis.__googleOptions.requiredClaims.includes('exp'));
    }}finally{delete globalThis.__googlePayload;}
  });
  await test('Share and QR preview select the same owned profile and hide unpublished destinations', async () => {
    const share=await server.ssrLoadModule('/src/routes/share/+page.server.ts');
    const qr=await server.ssrLoadModule('/src/routes/share/qr/+page.server.ts');
    const image=await server.ssrLoadModule('/src/routes/api/qr/+server.ts');
    const generate=await server.ssrLoadModule('/src/routes/api/profile/generate-qr/+server.ts');
    const cards=[
      {id:'first',userId:'account',kind:'business',slug:'existing-public-url',isPublished:true,displayName:'First'},
      {id:'second',userId:'account',kind:'business',slug:'selected',isPublished:true,displayName:'Second'},
      {id:'draft',userId:'account',kind:'business',slug:'unpublished',isPublished:false,displayName:'Draft'},
      {id:'foreign',userId:'other',kind:'business',slug:'foreign',isPublished:true}
    ];
    const writes=[];
    globalThis.__onboardingDb={profile:{
      update:async({where})=>writes.push(where.id),
      findMany:async({where})=>cards.filter(row=>row.userId===where.userId),
      findFirst:async({where})=>cards.find(row=>Object.entries(where).every(([key,value])=>row[key]===value))
    }};
    const locals={user:{id:'account'},appOrigin:'https://dev.relish.test'};
    const e={locals,url:new URL('https://dev.relish.test/share?profile=selected')};
    assert.equal((await share.load(e)).profile.id,'second');
    const preview=await qr.load(e);
    assert.equal(preview.qrUrl,'/api/qr?slug=selected');
    assert.equal(preview.link,'https://dev.relish.test/u/selected');
    assert.match(decodeURIComponent(preview.vcardUrl),/Second/);
    for(const load of [share.load,qr.load]) {
      await assert.rejects(load({...e,url:new URL('https://dev.relish.test/share?profile=foreign')}),r=>r.status===404);
    }
    e.url.search='?profile=unpublished';
    assert.equal((await share.load(e)).profile.isPublished,false);
    await assert.rejects(qr.load(e),r=>r.location==='/share?profile=unpublished');
    assert.equal((await image.GET({...e,url:new URL('https://dev.relish.test/api/qr?slug=unpublished')})).status,404);
    assert.equal((await image.GET({...e,url:new URL('https://dev.relish.test/api/qr?slug=selected')})).status,200);
    const generateFor=profileId=>generate.POST({...e,request:new Request(e.url,{method:'POST',body:new URLSearchParams({profileId})})});
    await assert.rejects(generateFor('second'),r=>r.status===303 && r.location==='/share/qr?profile=selected');
    await assert.rejects(generateFor('draft'),r=>r.status===303 && r.location==='/share?profile=unpublished');
    await assert.rejects(generateFor('foreign'),r=>r.status===404);
    assert.deepEqual(writes,['second']);
  });
  await test('public loader preserves exact slugs and legacy aliases with an owner-only draft preview', async () => {
    const publicPage=await server.ssrLoadModule('/src/routes/u/[slug]/+page.server.ts');
    const first={id:'first',userId:'account',slug:'existing-public-url',kind:'business',isPublished:true};
    const other={...first,id:'second',slug:'selected'};
    const unpublished={...first,id:'draft',slug:'unpublished',isPublished:false};
    globalThis.__onboardingDb={
      profile:{findFirst:async({where})=>where.slug ? [first,other,unpublished].find(p=>p.slug===where.slug) : first},
      user:{findFirst:async()=>({id:'account',publicSlug:'legacy-alias'}),findUnique:async()=>({id:'account',publicSlug:'legacy-alias'})},
      relishContextPreference:{findUnique:async()=>null}
    };
    const open=(slug,user)=>publicPage.load({params:{slug},locals:{user},url:new URL('https://relish.test/u/'+slug)});
    assert.equal((await open('selected')).profile.id,'second');
    assert.equal((await open('legacy-alias')).profile.id,'first');
    await assert.rejects(open('unpublished'),r=>r.status===404);
    assert.equal((await open('unpublished',{id:'account'})).profile.id,'draft');
  });
  // IT: Compile and render the actual Svelte screen to catch conditional and escaping regressions.
  const out=resolve('.svelte-kit/onboarding-test'); mkdirSync(out,{recursive:true});
  const compiled=compile(readFileSync('src/routes/u/[slug]/share-details/+page.svelte','utf8'),{generate:'server'});
  writeFileSync(out+'/capture.mjs',compiled.js.code);
  const Component=(await import(out+'/capture.mjs')).default;
  const data={profile:{name:'Terence',slug:'terence'},captureToken:'token',createStep:false,isSignedIn:false};
  const shareCompiled=compile(readFileSync('src/routes/share/+page.svelte','utf8'),{generate:'server'});
  writeFileSync(out+'/share.mjs',shareCompiled.js.code);
  const Share=(await import(out+'/share.mjs')).default;
  const publicCompiled = compile(readFileSync('src/routes/u/[slug]/+page.svelte', 'utf8'), {generate:'server'});
  writeFileSync(out + '/public-profile.js', publicCompiled.js.code);
  const PublicProfile = (await server.ssrLoadModule('/.svelte-kit/onboarding-test/public-profile.js')).default;
  await test('step one offers one primary action even to signed-in visitors who can exchange', () => {
    const html = render(PublicProfile, {props:{data:{
      profile:{displayName:'Owner',slug:'owner',kind:'business',isPublished:true},
      origin:'https://relish.test',isVisitorLoggedIn:true,captureVia:'qr',canExchangeProfile:true
    }}}).body;
    assert.equal((html.match(/class="fc-primary(?:\s[^"]*)?"/g) || []).length, 1);
    assert.match(html, />Save contact</);
    assert.doesNotMatch(html, /Share my details back/);
  });
  await test('Share offers edit and preview for an unpublished card and sharing controls after publication',()=>{
    const profile={id:'a',kind:'business',slug:'my-card',displayName:'Owner',isPublished:false};
    const html=()=>render(Share,{props:{data:{profile,profileOptions:[profile],origin:'https://relish.test'}}}).body;
    assert.match(html(),/Edit profile/);
    assert.match(html(),/Preview profile/);
    assert.doesNotMatch(html(),/Copy link|Share by SMS|\/api\/qr/);
    profile.isPublished=true;
    assert.match(html(),/Copy link/);
    assert.match(html(),/\/api\/qr\?slug=my-card/);
  });
  await test('step two renders Send, Skip and consent without signup requirements',()=>{
    const html=render(Component,{props:{data}}).body;
    assert.match(html,/Share your details with Terence/);assert.match(html,/>Skip</);assert.match(html,/>Send</);assert.match(html,/name="contactConsent"/);assert.doesNotMatch(html,/Create my Relish profile|verify a phone number/);
    const enabled=render(Component,{props:{data:{...data,exchangeAvailable:true}}}).body;
    assert.match(enabled,/confirm the mobile number/);
  });
  await test('Send and Skip each show optional step three; preview escapes submitted markup',()=>{
    const html=render(Component,{props:{data,form:{shared:true,values:{name:'<script>Guest</script>',email:'guest@example.test',phone:''}}}}).body;
    assert.match(html,/Your details have been shared with Terence/);assert.match(html,/Create my Relish profile/);assert.match(html,/&lt;script>Guest/);assert.doesNotMatch(html,/<script>Guest/);
    const skipped=render(Component,{props:{data:{...data,createStep:true}}}).body;
    assert.match(skipped,/Create my Relish profile/);assert.match(skipped,/Maybe later/);assert.doesNotMatch(skipped,/Your details have been shared/);
  });
} finally { await server.close(); delete globalThis.__onboardingCaptures; delete globalThis.__onboardingDb; delete globalThis.__onboardingClaims; delete globalThis.__onboardingLookups; }
