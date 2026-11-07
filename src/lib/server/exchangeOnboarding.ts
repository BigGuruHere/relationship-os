// Browser continuation is encrypted, HttpOnly and bound to a separate random browser cookie.
// This grants no account assurance; the claim service still requires a fresh session-bound SMS proof.
import type { Cookies } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { encrypt, decrypt } from '$lib/crypto';
export const EXCHANGE_RETURN = '/exchange/claim';
const CLAIM = 'relish_exchange_claim',
	BROWSER = 'relish_exchange_browser';
const purpose = 'exchange.browser.v1';
type Continuation = {
	token: string;
	profileId: string;
	browser: string;
	at: number;
    version?: 2;
	challengeId?: string;
    channelType?: string;
	accountId?: string;
	sessionId?: string;
};
export function readExchange(cookies: Cookies): Continuation | null {
	try {
		const raw = cookies.get(CLAIM);
		if (!raw || raw.length > 3000) return null;
		const value = JSON.parse(decrypt(raw, purpose));
		if (
			!/^[0-9a-f]{64}$/.test(value.token) ||
			typeof value.profileId !== 'string' ||
			value.browser !== cookies.get(BROWSER) ||
			!Number.isFinite(value.at) ||
			value.at > Date.now() ||
			Date.now() - value.at >= 86400000
		)
			return null;
		return value;
	} catch {
		return null;
	}
}
export function saveExchange(cookies: Cookies, url: URL, token: string, profileId: string, version?: 2) {
	const browser = randomUUID();
	const options = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		maxAge: 86400
	};
	cookies.set(BROWSER, browser, options);
	cookies.set(
		CLAIM,
		encrypt(JSON.stringify({ token, profileId, browser, at: Date.now(), ...(version?{version}:{}) }), purpose),
		options
	);
}
export function bindExchangeChallenge(
	cookies: Cookies,
	url: URL,
	value: Continuation,
	challengeId: string,
	accountId: string,
	sessionId: string, channelType?: string
) {
	cookies.set(
		CLAIM,
		encrypt(JSON.stringify({ ...value, challengeId, accountId, sessionId, channelType }), purpose),
		{
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: Math.max(1, Math.floor((value.at + 86400000 - Date.now()) / 1000))
		}
	);
}
export function clearExchange(cookies: Cookies) {
	cookies.delete(CLAIM, { path: '/' });
	cookies.delete(BROWSER, { path: '/' });
}
