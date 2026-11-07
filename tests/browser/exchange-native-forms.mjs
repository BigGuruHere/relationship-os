// Exercise encrypted browser capability handling and real form boundaries without sending SMS.
import { createServer as httpServer } from 'node:http';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
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
				if (id.endsWith('/foundation/accountChannels')) return '\0channels';
                if (id.endsWith('/foundation/devPilotGate')) return '\0gate';
				if (id.endsWith('/foundation/exchangeClaims')) return '\0claims';
				if (id.endsWith('/foundation/provisioning')) return '\0domain';
			},
			load(id) {
				if(id==='\0channels') return `export async function listAccountChannels(){return [{id:'phone',type:'PHONE',masked:'•••• 0000',status:globalThis.channelVerified?'VERIFIED':'PENDING'}];} export async function addAccountChannel(){return 'phone';} export async function requestAccountChannelCode(){return {status:'QUEUED',challengeId:'account-challenge'};} export async function dispatchAccountChannelCode(){return 'SENT';} export async function verifyAccountChannelCode(...a){globalThis.accountVerifyArgs=a;globalThis.channelVerified=true;return 'VERIFIED';} export async function revokeAccountChannel(){} export async function eraseRevokedAccountChannel(){}`;
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
// Optional local Chromium acceptance. Provider/domain services above are intercepted.
await mkdir('.svelte-kit/browser-check', { recursive: true });
async function component(path, name) {
	const source = await readFile(path, 'utf8');
	const result = compile(source, { generate: 'server', filename: path });
	await writeFile('.svelte-kit/browser-check/' + name + '.js', result.js.code);
	return (await vite.ssrLoadModule('/.svelte-kit/browser-check/' + name + '.js')).default;
}
const ownedUI = await component('src/routes/u/[slug]/share-details/+page.svelte', 'owned');
const channelsUI=await component('src/routes/settings/channels/+page.svelte','channels');
const channelPage=await vite.ssrLoadModule('/src/routes/settings/channels/+page.server.ts');
const claimUI = await component('src/routes/exchange/claim/+page.svelte', 'claim');
const profileUI = await component('src/routes/settings/profile/+page.svelte', 'profile');
const c = cookies();
let policyOverride = null,
	lastProfile;
flow.saveExchange(c, new URL('https://dev.relish.live'), 'a'.repeat(64), 'profile');
const server = httpServer(async (req, res) => {
	try {
		const url = new URL(req.url, 'http://127.0.0.1:' + server.address().port);
		if (process.env.RELISH_BROWSER_SERVE_ONLY === 'YES')
			policyOverride = url.searchParams.get('policy') === 'no-referrer' ? 'no-referrer' : null;
		if (url.pathname === '/profiles') {
			res.end('My Profiles');
			return;
		}
		if (url.pathname === '/owned') {
			res.setHeader('referrer-policy', 'same-origin');
			if (req.method === 'POST') {
				let body = '';
				for await (const part of req) body += part;
				const fields = new URLSearchParams(body);
				assert.equal(req.headers.origin, url.origin);
				assert.equal(fields.get('intent'), 'confirm-profile');
				assert.equal(fields.get('confirmation'), 'opaque-test-preview');
				res.writeHead(303, { location: '/people' });
				res.end();
				return;
			}
			res.setHeader('content-type', 'text/html');
			res.end(
				render(ownedUI, {
					props: {
						data: {
							ownedFlow: true,
							profile: { slug: 'mark', name: 'Mark Test' },
							choices: [
								{
									label: 'My draft',
									name: 'Betty Test',
									email: 'betty@example.invalid',
									phone: '',
									confirmation: 'opaque-test-preview'
								}
							]
						},
						form: null
					}
				}).body
			);
			return;
		}
		let form;
		if (req.method === 'POST') {
			let body = '';
			for await (const part of req) body += part;
			if (url.pathname === '/profile') {
				lastProfile = new URLSearchParams(body);
				res.end('Published');
				return;
			}
			const e = event(c, {});
			e.url = url;
			e.request = new Request(url, { method: 'POST', headers: req.headers, body });
			try {
				const result = await (url.pathname==='/channels'?channelPage:page).actions.default(e);
				form = result.data ?? result;
			} catch (r) {
				if (r.status === 303) {
					res.writeHead(303, { location: r.location });
					res.end();
					return;
				}
				throw r;
			}
		}
		if (url.pathname === '/profile') {
			res.setHeader('content-type', 'text/html');
			res.end(
				render(profileUI, {
					props: {
						data: {
							profile: {
								id: 'p',
								slug: 'mark',
								displayName: 'Mark Test',
								kind: 'business',
								isPublished: false
							}
						},
						form: null
					}
				}).body
			);
			return;
		}
		const data = await (url.pathname==='/channels'?channelPage:page).load({
			...event(c, {}),
			url,
			setHeaders: (h) => {
				for (const [key, value] of Object.entries(h)) res.setHeader(key, value);
			}
		});
		if (policyOverride) res.setHeader('referrer-policy', policyOverride);
		res.setHeader('content-type', 'text/html');
		res.end(render(url.pathname==='/channels'?channelsUI:claimUI, { props: { data, form } }).body);
	} catch (e) {
		res.statusCode = 500;
		res.end(String(e));
	}
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
if (process.env.RELISH_BROWSER_SERVE_ONLY === 'YES') {
	console.log('Fixture: http://127.0.0.1:' + server.address().port);
	await new Promise(() => {});
}
let browser;
try {
	browser = await chromium.launch({
		headless: true,
		...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
			: {})
	});
	const tab = await browser.newPage();
	const base = 'http://127.0.0.1:' + server.address().port;
	// Reproduce the original null-Origin bug using the actual native form and action.
	policyOverride = 'no-referrer';
	await tab.goto(base);
	await tab.getByRole('button', { name: 'Send verification code', exact: true }).click();
	await tab.getByRole('alert').filter({ hasText: 'Please submit from this page.' }).waitFor();
	assert.equal(globalThis.claimArgs, undefined);
	// The application's corrected policy lets the browser submit normally, without client JS.
	policyOverride = null;
	await tab.goto(base);
	await tab.getByRole('button', { name: 'Send verification code', exact: true }).click();
	await tab.getByLabel('Verification code', { exact: true }).waitFor();
	assert.equal(globalThis.claimArgs[3], 'trusted-address');
	// Native constraint validation must reject incomplete codes before any service request.
	await tab.getByLabel('Verification code', { exact: true }).fill('12345');
	assert.equal(
		await tab
			.getByLabel('Verification code', { exact: true })
			.evaluate((input) => input.checkValidity()),
		false
	);

	await tab.getByRole('button', { name: 'Continue later', exact: true }).click();
	await tab.waitForURL(base + '/profiles');
	// Resume after Continue later, then submit a synthetic code with a leading zero.
	await tab.goto(base);
	await tab.getByLabel('Verification code', { exact: true }).fill('012345');
	assert.equal(
		await tab
			.getByLabel('Verification code', { exact: true })
			.evaluate((input) => input.checkValidity()),
		true
	);
	await tab.getByRole('button', { name: 'Verify and save contact', exact: true }).click();
	await tab.waitForURL(base + '/people');
	assert.equal(globalThis.verifyArgs[3], '012345');

	// Real native owned-profile form submits the preview without a code or typed contact fields.
	await tab.goto(base + '/owned');
	assert.equal(
		await tab.locator('input[name="code"],input[name="email"],input[name="phone"]').count(),
		0
	);
	await tab.getByRole('button', { name: 'Confirm exchange with Mark Test', exact: true }).click();
	await tab.waitForURL(base + '/people');
    // Independent account verification also uses the literal six-digit native constraint.
    await tab.goto(base+'/channels');
    await tab.getByRole('button',{name:'Send verification code',exact:true}).click();
    await tab.getByLabel('Verification code',{exact:true}).fill('005321');
    await tab.getByRole('button',{name:'Verify phone number',exact:true}).click();
    await tab.getByRole('status').filter({hasText:'Phone number verified.'}).waitFor();
    assert.equal(globalThis.accountVerifyArgs[2],'005321');
	// The top publication button is associated with the existing form and includes unsaved edits.
	await tab.goto(base + '/profile');
	await tab.getByLabel('Public name', { exact: true }).fill('Edited Mark');
	await tab.getByRole('button', { name: 'Publish profile', exact: true }).click();
	assert.equal(lastProfile.get('publishNow'), 'yes');
	assert.equal(lastProfile.get('displayName'), 'Edited Mark');
	console.log(
		'PASS: reproduced null Origin; corrected native Send, Continue later and six-digit code submission; publish submits current editor fields.'
	);
} finally {
	if (browser) await browser.close();
	await new Promise((r) => server.close(r));
	await vite.close();
}
