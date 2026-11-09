// Exercise actual authentication handlers and shared session issuance without provider/network writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
process.env.SESSION_COOKIE_SECRET = 'synthetic-session-secret-for-f203';
process.env.SESSION_DAYS = '7';
for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OAUTH_REDIRECT_URI'])
	process.env[name] = 'synthetic';
let state;
globalThis.__f203routes = {};
const mocks = {
	db: `export const prisma = new Proxy({}, {get:(_,k)=>k==='$transaction'?async fn=>fn(globalThis.__f203routes.db):globalThis.__f203routes.db[k]});`,
	'server/foundation/provisioning': `export async function accountDomain(){return 'LEGACY';} export async function provisionNewFoundationAccount(_tx,id){globalThis.__f203routes.calls.push('activate:'+id);} export async function provisionAccountForSession(id){globalThis.__f203routes.calls.push('provision:'+id); if(globalThis.__f203routes.fail) throw Error('provisioning failed');}`,
	'server/userEmail': `export async function findUserByEmail(){return globalThis.__f203routes.register?null:{id:'account',passwordHash:globalThis.__f203routes.hash};} export const decryptUserEmail=()=> 'test@example.test'; export const encryptedUserEmailFields=()=>({}); export async function setUserEmail(){}`,
	'server/profiles': `export async function ensureDefaultProfile(){} export function defaultProfileData(seed){return seed;}`,
	'server/loginThrottle': `export async function consumePasswordSignupAttempt(){return true;} export async function consumePasswordLoginAttempt(){return true;} export async function clearSuccessfulLoginAccountBucket(){}`,
	'server/tokens': `export async function verifyMagicToken(){if(globalThis.__f203routes.invalid) throw Error('invalid'); return {id:'token',userId:'account'};} export async function markMagicTokenUsed(){globalThis.__f203routes.calls.push('consume');}`
};
const vite = await createServer({
	configFile: false,
	ssr: { noExternal: ['jose'] },
	server: { middlewareMode: true },
	resolve: { alias: { $lib: resolve('src/lib') } },
	plugins: [
		{
			name: 'f203-auth-fixtures',
			enforce: 'pre',
			resolveId(id) {
				for (const dep of Object.keys(mocks))
					if (id === '$lib/' + dep || id === resolve('src/lib', dep)) return '\0fixture:' + dep;
				if (id === '$app/environment' || id === 'jose') return '\0fixture:' + id;
			},
			load(id) {
				if (!id.startsWith('\0fixture:')) return;
				const dep = id.slice(9);
				if (dep === '$app/environment') return 'export const dev=true;';
				if (dep === 'jose')
					return `export const createRemoteJWKSet=()=>({}); export async function jwtVerify(){if(globalThis.__f203routes.invalid) throw Error('invalid signature');return {payload:{sub:'google-id',email:'test@example.test',email_verified:true,nonce:'nonce'}};}`;
				return mocks[dep];
			}
		}
	]
});
try {
	const auth = await vite.ssrLoadModule('/src/lib/auth.ts');
	const hash = await auth.hashPassword('correct-password');
	const register = await vite.ssrLoadModule('/src/routes/auth/register/+page.server.ts');
	const login = await vite.ssrLoadModule('/src/routes/auth/login/+page.server.ts');
	const google = await vite.ssrLoadModule('/src/routes/auth/google/callback/+server.ts');
	const magic = await vite.ssrLoadModule('/src/routes/api/auth/magic-link/+server.ts');
	let ip = 0;
	function reset() {
		state = {
			calls: [],
			hash,
			db: {
				user: {
					create: async () => ({ id: 'account', profiles: [{ id: 'card' }] }),
					findUnique: async () => ({ id: 'account', email_Enc: 'enc', email_Idx: 'idx' }),
					findFirst: async () => ({ id: 'account' })
				},
				session: {
					create: async () => {
						state.calls.push('session');
						return { id: 'session' };
					}
				},
				oAuthAccount: { upsert: async () => ({userId:'account'}), update: async () => ({}) }
			}
		};
		globalThis.__f203routes = state;
	}
	function event(kind, password = 'correct-password') {
		const values = {
			email: 'test@example.test',
			password,
			linkedinUrl: 'https://www.linkedin.com/in/test'
		};
		return {
			url: new URL('https://relish.test/auth?code=code&state=state'),
			locals: { sessionCookie: { name: 'session', options: { secure: true, path: '/' } } },
			getClientAddress: () => String(++ip),
			cookies: {
				get: (k) => ({ oauth_state: 'state', oauth_nonce: 'nonce', oauth_pkce: 'pkce' })[k],
				set: (k) => {
					if (k === 'session') state.calls.push('cookie');
				}
			},
			request: new Request('https://relish.test/auth', {
				method: 'POST',
				headers: {
					'content-type':
						kind === 'magic' ? 'application/json' : 'application/x-www-form-urlencoded'
				},
				body: kind === 'magic' ? JSON.stringify({ token: 'token' }) : new URLSearchParams(values)
			}),
			fetch: async () => Response.json({ id_token: 'synthetic-token' })
		};
	}
	for (const [name, run] of [
		['register', (e) => register.actions.default(e)],
		['password', (e) => login.actions.default(e)],
		['google', (e) => google.GET(e)],
		['magic', (e) => magic.POST(e)]
	]) {
		await test(
			name + ' passes through provisioning before session, cookie and claims',
			async () => {
				reset();
				state.register = name === 'register';
				try {
					await run(event(name));
				} catch (e) {
					assert.equal(e.status, 303);
				}
				assert.deepEqual(
					state.calls.filter((c) => c !== 'consume'),
					name === 'register'
						? ['activate:account', 'provision:account', 'session', 'cookie']
						: ['provision:account', 'session', 'cookie']
				);
			}
		);
		await test(name + ' provisioning failure issues no session or claim', async () => {
			reset();
			state.register = name === 'register';
			state.fail = true;
			await assert.rejects(run(event(name)), /provisioning failed/);
			assert.deepEqual(
				state.calls.filter((c) => c !== 'consume'),
				name === 'register' ? ['activate:account', 'provision:account'] : ['provision:account']
			);
		});
	}
	await test('invalid credentials never reach provisioning', async () => {
		reset();
		assert.equal((await login.actions.default(event('password', 'wrong'))).status, 400);
		assert.deepEqual(state.calls, []);
		for (const [name, run] of [
			['google', (e) => google.GET(e)],
			['magic', (e) => magic.POST(e)]
		]) {
			reset();
			state.invalid = true;
			await assert.rejects(run(event(name)));
			assert.deepEqual(state.calls, []);
		}
	});

} finally {
	await vite.close();
	delete globalThis.__f203routes;
}
