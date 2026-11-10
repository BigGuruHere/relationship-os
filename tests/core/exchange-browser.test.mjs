import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
// Exercise encrypted browser capability handling and real form boundaries without sending SMS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { resolve } from 'node:path';
process.env.SECRET_MASTER_KEY = 'b'.repeat(64);
const vite = await createServer({
	configFile: false,
	server: { middlewareMode: true, hmr: false },
	resolve: { alias: { $lib: resolve('src/lib') } },
	plugins: [
		{
			name: 'exchange-test-services',
			enforce: 'pre',
			resolveId(id) {
				if (id.endsWith('/core/contactCapture')) return '\0capture';
                if (id.endsWith('/foundation/accountChannels')) return '\0channels';
                if (id.endsWith('/foundation/devPilotGate')) return '\0gate';
				if (id.endsWith('/foundation/exchangeClaims')) return '\0claims';
				if (id.endsWith('/foundation/provisioning')) return '\0domain';
			},
			load(id) {
				if (id === '\0capture') return `export async function publishedCaptureProfile(){return {id:'target',userId:'mark',slug:'mark',displayName:'Mark'};} export async function capturePrivateContact(){throw Error('unexpected guest capture');}`;
                if(id==='\0channels') return `export async function listAccountChannels(){return [{id:'phone',type:'PHONE',masked:'•••• 0000',status:globalThis.channelVerified?'VERIFIED':'PENDING'}];} export async function addAccountChannel(){return 'phone';} export async function requestAccountChannelCode(){return {status:'QUEUED',challengeId:'account-challenge'};} export async function dispatchAccountChannelCode(){return 'SENT';} export async function verifyAccountChannelCode(...a){globalThis.accountVerifyArgs=a;if(globalThis.accountVerifyFailure)throw globalThis.accountVerifyFailure;globalThis.channelVerified=true;return 'VERIFIED';} export async function revokeAccountChannel(){} export async function eraseRevokedAccountChannel(){}`;
                if (id === '\0gate') return `export function exchangeBrowserEnabled(){return true;}`;
				if (id === '\0domain') return `export async function accountDomain(){return 'ACTIVE';}`;
				if (id === '\0claims')
					return `export async function accountClaimState(){return {canComplete:true,settled:Boolean(globalThis.guestCompleted),channel:{type:'PHONE',step:'PHONE',available:true,masked:'•••• 0000'}};} export async function prepareAccountClaim(){return 'phone';} export async function completeAccountClaim(){globalThis.guestCompleted=true;return {status:'SETTLED',personId:'private-person'};} export async function ownedExchangeChoices(){return [];} export async function confirmOwnedProfileExchange(...a){globalThis.ownedArgs=a;return {personId:"private-person"};} export async function requestExchangeCode(...a){globalThis.claimArgs=a;if(globalThis.claimFailure)throw globalThis.claimFailure;return {status:'QUEUED',challengeId:'challenge'};} export async function dispatchExchangeCode(){return {status:'SENT'};} export async function verifyExchangeCode(...a){globalThis.verifyArgs=a;return {status:'SETTLED',personId:'private-person'};}`;
			}
		}
	]
});
const cookies = () => {
	const m = new Map();
	return { get: (k) => m.get(k), set: (k, v) => m.set(k, v), delete: (k) => m.delete(k) };
};
const flow = await vite.ssrLoadModule('/src/lib/server/exchangeOnboarding.ts');
const page = await vite.ssrLoadModule('/src/routes/exchange/claim/+page.server.ts');
const returns = await vite.ssrLoadModule('/src/lib/server/networkJoinReturn.ts');
function event(c, body, origin = 'https://dev.relish.live') {
	return {
		cookies: c,
		locals: { user: { id: 'betty' }, sessionId: 'session' },
		url: new URL('https://dev.relish.live/exchange/claim'),
		getClientAddress: () => 'trusted-address',
		request: new Request('https://dev.relish.live/exchange/claim', {
			method: 'POST',
			headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(body)
		}),
		setHeaders() {}
	};
}
try {
    await test('owned confirmation route keeps same-origin and fixed target binding; editor return is account-bound',async()=>{
      const route=await vite.ssrLoadModule('/src/routes/u/[slug]/share-details/+page.server.ts');
      const back=await vite.ssrLoadModule('/src/lib/server/profileExchangeReturn.ts');
      const c=cookies();c.set('relish_contact_capture','browser');
      const ev=event(c,{intent:'confirm-profile',confirmation:'opaque-preview'});
      ev.params={slug:'mark'};
      ev.url=new URL('https://dev.relish.live/u/mark/share-details');
      await assert.rejects(route.actions.default(ev),e=>e.status===303 && e.location==='/people/private-person?afterExchange=1');
      assert.equal(globalThis.ownedArgs[1],'opaque-preview');assert.equal(globalThis.ownedArgs[3],'target');
      const bad=event(c,{intent:'confirm-profile'},'https://evil.invalid');bad.params={slug:'mark'};
      assert.equal((await route.actions.default(bad)).status,403);
      back.saveProfileExchangeReturn(c,ev.url,'betty','mark');
      assert.equal(back.profileExchangeReturn(c,'betty'),'/u/mark/share-details');
      assert.equal(back.profileExchangeReturn(c,'other'),null);
    });
    await test('account channel settings refuse foreign origins and preserve the exact entered code',async()=>{
      const settings=await vite.ssrLoadModule('/src/routes/settings/channels/+page.server.ts');
      const c=cookies();
      assert.equal((await settings.actions.default(event(c,{intent:'send',channelId:'phone'},'https://evil.invalid'))).status,403);
      const sent=await settings.actions.default(event(c,{intent:'send',channelId:'phone'}));
      assert.equal(sent.challengeId,'account-challenge');
      const checked=await settings.actions.default(event(c,{intent:'verify',channelId:'phone',challengeId:sent.challengeId,code:'005321'}));
      assert.equal(checked.message,'Channel verified.');assert.equal(globalThis.accountVerifyArgs[2],'005321');
    });
    await test('signed-out claim URLs go directly to registration and preserve the continuation', async () => {
      const c = cookies();
      const url = new URL('https://dev.relish.live/exchange/claim');
      flow.saveExchange(c, url, 'a'.repeat(64), 'profile', 2);
      await assert.rejects(page.load({ ...event(c, {}), locals: {} }),
        failure => failure.status === 303 && failure.location === '/auth/register?next=%2Fexchange%2Fclaim');
      assert.equal(flow.readExchange(c).token, 'a'.repeat(64));
    });
    await test('guest verification reports a competing channel without settling the exchange', async () => {
      const { ChannelDenied } = await vite.ssrLoadModule('/src/lib/server/foundation/channelDiagnostics.ts');
      const c = cookies();
      const url = new URL('https://dev.relish.live/exchange/claim');
      flow.saveExchange(c, url, 'a'.repeat(64), 'profile', 2);
      flow.bindExchangeChallenge(c, url, flow.readExchange(c), 'challenge', 'betty', 'session', 'PHONE');
      globalThis.accountVerifyFailure = new ChannelDenied('CHANNEL_ALREADY_VERIFIED');
      globalThis.guestCompleted = false;
      const logs = [];
      const original = console.error;
      try {
        console.error = message => logs.push(message);
        const result = await page.actions.default(event(c, { intent: 'verify', code: '005321' }));
        assert.equal(result.status, 409);
        assert.match(result.data.error, /already verified on another Relish account/);
        assert.equal(globalThis.guestCompleted, false);
        assert.equal(JSON.parse(logs[0]).reason, 'CHANNEL_ALREADY_VERIFIED');
        assert.doesNotMatch(logs[0], /005321|betty/);
      } finally {
        console.error = original;
        delete globalThis.accountVerifyFailure;
      }
    });
    await test('v2 retained-assurance confirmation saves without a code and keeps other verification separate',async()=>{
      const c=cookies();flow.saveExchange(c,new URL('https://dev.relish.live'),'a'.repeat(64),'profile',2);
      const e=event(c,{intent:'complete'});e.locals.env='dev';
      const state=await page.load(e);assert.equal(state.version,2);assert.equal(state.accountClaim.canComplete,true);
      const before=globalThis.claimArgs;
      await assert.rejects(page.actions.default(e), r => r.status === 303 && r.location === '/people/private-person?afterExchange=1');assert.equal(globalThis.claimArgs,before);
      globalThis.guestCompleted=false;
    });
    await test('sign-in can complete an exchange with existing proof without visiting the claim page', async () => {
      const c = cookies();
      const url = new URL('https://dev.relish.live/auth/google/callback');
      flow.saveExchange(c, url, 'd'.repeat(64), 'profile', 2);
      const locals = {env:'dev', appOrigin:url.origin};
      assert.equal(await flow.exchangeAuthReturn(c, url, locals, '/network/join/invite'), '/network/join/invite');
      const next = await flow.exchangeAuthReturn(c, url, locals, null);
      assert.equal(next, flow.EXCHANGE_RETURN);
      assert.equal(await flow.finishVerifiedExchange(c, url, locals,
        next, 'betty', 'session'), '/people/private-person?afterExchange=1');
      assert.equal(flow.readExchange(c), null);
      globalThis.guestCompleted = false;
    });
    await test('channel diagnostics classify validation/schema/provider failures without private values',async()=>{
      const diag=await vite.ssrLoadModule('/src/lib/server/foundation/channelDiagnostics.ts');
      const email=await vite.ssrLoadModule('/src/lib/server/integrations/resend/verification.ts');
      assert.equal(diag.channelFailureReason({code:'P2022',message:'private SQL address@example.invalid'}),'SCHEMA_NOT_READY');
      assert.match(diag.channelFailureMessage('INVALID_PHONE'),/choose Email/);
      const logs=[],originalError=console.error,originalFetch=globalThis.fetch;
      process.env.RESEND_API_KEY='synthetic-private-key';process.env.RELISH_VERIFICATION_EMAIL_FROM='verify@example.invalid';
      try{
        console.error=(message)=>logs.push(message);
        for(const [status,reason] of [[401,'EMAIL_API_UNAUTHORIZED'],[403,'EMAIL_API_FORBIDDEN'],[422,'EMAIL_API_INVALID_REQUEST'],[429,'EMAIL_API_RATE_LIMITED'],[503,'EMAIL_API_UNAVAILABLE']]){
          globalThis.fetch=async()=>new Response('private address@example.invalid 123456',{status});
          await assert.rejects(email.sendVerificationEmail('address@example.invalid','123456','test'),failure=>{
            const result=diag.reportChannelFailure('dispatch',failure);assert.equal(result.reason,reason);return true;
          });
        }
        assert.doesNotMatch(logs.join(''),/address@|123456|synthetic-private-key|private SQL/);
      }finally{console.error=originalError;globalThis.fetch=originalFetch;delete process.env.RESEND_API_KEY;delete process.env.RELISH_VERIFICATION_EMAIL_FROM;}
    });
	await test('continuation is browser-bound, tamper-resistant and absent from auth URLs', () => {
		const c = cookies(),
			url = new URL('https://dev.relish.live');
		flow.saveExchange(c, url, 'a'.repeat(64), 'profile');
		assert.equal(flow.readExchange(c).token, 'a'.repeat(64));
		const copied = cookies();
		copied.set('relish_exchange_claim', c.get('relish_exchange_claim'));
		assert.equal(flow.readExchange(copied), null);
		c.set('relish_exchange_claim', 'tampered');
		assert.equal(flow.readExchange(c), null);
		assert.equal(returns.safeAuthReturn('/exchange/claim'), '/exchange/claim');
		assert.equal(returns.safeAuthReturn('/exchange/claim?token=secret'), null);
	});
	await test('same-origin request binds challenge to account/session and settles with server address', async () => {
		const c = cookies();
		flow.saveExchange(c, new URL('https://dev.relish.live'), 'c'.repeat(64), 'profile');
		assert.equal(
			(await page.actions.default(event(c, { intent: 'send' }, 'https://evil.invalid'))).status,
			403
		);
		assert.equal((await page.actions.default(event(c, { intent: 'send' }))).sent, true);
		assert.equal(globalThis.claimArgs[3], 'trusted-address');
		const switched = event(c, { intent: 'verify', code: '123456' });
		switched.locals.sessionId = 'other';
		assert.equal((await page.actions.default(switched)).status, 400);
		await assert.rejects(
			page.actions.default(event(c, { intent: 'verify', code: '123456' })),
			(e) => e.status === 303 && e.location === '/people/private-person?afterExchange=1'
		);
		assert.equal(flow.readExchange(c), null);
		assert.equal(globalThis.verifyArgs[4], 'trusted-address');
	});
	await test('claim policy preserves native form origins and Continue later retains the claim', async () => {
		const c = cookies();
		flow.saveExchange(c, new URL('https://dev.relish.live'), 'd'.repeat(64), 'profile');
		const e = event(c, { intent: 'later' });
		let headers;
		await page.load({ ...e, setHeaders: (h) => (headers = h) });
		assert.equal(headers['referrer-policy'], 'same-origin');
		await assert.rejects(
			page.actions.default(e),
			(r) => r.status === 303 && r.location === '/profiles'
		);
		assert.ok(flow.readExchange(c));
		assert.equal((await page.actions.default(event(c, { intent: 'send' }, 'null'))).status, 403);
	});
	await test('unsupported form encoding and oversized payloads fail before service invocation', async () => {
		const c = cookies(),
			e = event(c, { intent: 'send' });
		e.request = new Request(e.url, {
			method: 'POST',
			headers: { origin: e.url.origin, 'content-type': 'application/json' },
			body: '{}'
		});
		assert.equal((await page.actions.default(e)).status, 415);
		assert.equal((await page.actions.default(event(c, { code: 'x'.repeat(3000) }))).status, 413);
	});
	await test('failures expose a reference and emit fixed reasons without private values', async () => {
		const { ExchangeDenied, reportExchangeFailure } = await vite.ssrLoadModule(
			'/src/lib/server/foundation/exchangeDiagnostics.ts'
		);
		const c = cookies();
		flow.saveExchange(c, new URL('https://dev.relish.live'), 'e'.repeat(64), 'private-profile');
		const original = console.error;
		const lines = [];
		console.error = (line) => lines.push(line);
		try {
			globalThis.claimFailure = new ExchangeDenied('DESTINATION_NOT_ALLOWED');
			const response = await page.actions.default(event(c, { intent: 'send' }));
			assert.equal(response.status, 400);
			assert.match(response.data.reference, /^[0-9a-f-]{36}$/);
			const log = JSON.parse(lines[0]);
			assert.equal(log.reference, response.data.reference);
			assert.equal(log.reason, 'DESTINATION_NOT_ALLOWED');
			assert.equal(log.operation, 'request');
			reportExchangeFailure(
				'request',
				Object.assign(new Error('private SQL secret phone +61400000000'), {
					code: 'P2028',
					token: 'secret',
					phone: '+61400000000'
				})
			);
			const safe = JSON.parse(lines[1]);
			assert.equal(safe.code, 'P2028');
			assert.doesNotMatch(
				lines.join(' '),
				/secret|61400000000|private-profile|betty|session|eeeeeeee/
			);
			assert.deepEqual(
				Object.keys(log).sort(),
				['component', 'reference', 'operation', 'reason', 'code', 'category'].sort()
			);
		} finally {
			console.error = original;
			delete globalThis.claimFailure;
		}
	});
	await test('rendered code field accepts six digits including leading zero, rejecting other lengths/text', async () => {
		const source = await readFile('src/routes/exchange/claim/+page.svelte', 'utf8');
		const output = compile(source, {
			generate: 'server',
			filename: 'src/routes/exchange/claim/+page.svelte'
		});
		await mkdir('.svelte-kit', { recursive: true });
		await writeFile('.svelte-kit/test-exchange-code-component.js', output.js.code);
		const { default: component } = await vite.ssrLoadModule(
			'/.svelte-kit/test-exchange-code-component.js'
		);
		const { body } = render(component, {
			props: {
				data: { available: true, signedIn: true, ready: true, codeRequested: true },
				form: null
			}
		});
		const pattern = body.match(/pattern="([^"]+)"/)[1];
		const rule = new RegExp('^(?:' + pattern + ')$');
		for (const code of ['123456', '012345', '000000']) assert.ok(rule.test(code));
		for (const code of ['12345', '1234567', 'abcdef', '123 45', ''])
			assert.equal(rule.test(code), false);
	});
} finally {
	await vite.close();
	delete globalThis.claimArgs;
	delete globalThis.verifyArgs;
}
