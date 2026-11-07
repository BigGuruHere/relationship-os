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
				if (id.endsWith('/foundation/devPilotGate')) return '\0gate';
				if (id.endsWith('/foundation/exchangeClaims')) return '\0claims';
				if (id.endsWith('/foundation/provisioning')) return '\0domain';
			},
			load(id) {
				if (id === '\0gate') return `export function exchangeBrowserEnabled(){return true;}`;
				if (id === '\0domain') return `export async function accountDomain(){return 'ACTIVE';}`;
				if (id === '\0claims')
					return `export async function requestExchangeCode(...a){globalThis.claimArgs=a;return {status:'QUEUED',challengeId:'challenge'};} export async function dispatchExchangeCode(){return {status:'SENT'};} export async function verifyExchangeCode(...a){globalThis.verifyArgs=a;return {status:'SETTLED',personId:'private-person'};}`;
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
} finally {
	await vite.close();
	delete globalThis.claimArgs;
	delete globalThis.verifyArgs;
}
