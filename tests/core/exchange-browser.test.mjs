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
                if (id.endsWith('/foundation/devPilotGate')) return '\0gate';
				if (id.endsWith('/foundation/exchangeClaims')) return '\0claims';
				if (id.endsWith('/foundation/provisioning')) return '\0domain';
			},
			load(id) {
				if (id === '\0capture') return `export async function publishedCaptureProfile(){return {id:'target',userId:'mark',slug:'mark',displayName:'Mark'};} export async function capturePrivateContact(){throw Error('unexpected guest capture');}`;
                if (id === '\0gate') return `export function exchangeBrowserEnabled(){return true;}`;
				if (id === '\0domain') return `export async function accountDomain(){return 'ACTIVE';}`;
				if (id === '\0claims')
					return `export async function ownedExchangeChoices(){return [];} export async function confirmOwnedProfileExchange(...a){globalThis.ownedArgs=a;} export async function requestExchangeCode(...a){globalThis.claimArgs=a;if(globalThis.claimFailure)throw globalThis.claimFailure;return {status:'QUEUED',challengeId:'challenge'};} export async function dispatchExchangeCode(){return {status:'SENT'};} export async function verifyExchangeCode(...a){globalThis.verifyArgs=a;return {status:'SETTLED',personId:'private-person'};}`;
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
      await assert.rejects(route.actions.default(ev),e=>e.status===303 && e.location==='/people');
      assert.equal(globalThis.ownedArgs[1],'opaque-preview');assert.equal(globalThis.ownedArgs[3],'target');
      const bad=event(c,{intent:'confirm-profile'},'https://evil.invalid');bad.params={slug:'mark'};
      assert.equal((await route.actions.default(bad)).status,403);
      back.saveProfileExchangeReturn(c,ev.url,'betty','mark');
      assert.equal(back.profileExchangeReturn(c,'betty'),'/u/mark/share-details');
      assert.equal(back.profileExchangeReturn(c,'other'),null);
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
			(e) => e.status === 303 && e.location === '/people'
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
