import { randomUUID } from 'node:crypto';
import { error, fail, redirect, type Cookies } from '@sveltejs/kit';
import { createSession, hashPassword, setSessionCookie } from '$lib/auth';
import { encrypt, decrypt } from '$lib/crypto';
import { consumePasswordSignupAttempt } from '$lib/server/loginThrottle';
import { safeAuthReturn } from '$lib/server/networkJoinReturn';
import { exchangeAuthReturn, EXCHANGE_RETURN, startExchangeAfterAuth } from '$lib/server/exchangeOnboarding';
import { profileReturnForAccount, PROFILE_ONBOARDING_RETURN } from '$lib/server/profileOnboarding';
import { verificationPhone } from '$lib/server/foundation/exchangeCrypto';
import {
	activateDorianPhoneSignup, dorianPhoneSignupAvailable, sendDorianPhoneSignupCode
} from '$lib/server/foundation/accountChannels';
import type { Actions, PageServerLoad } from './$types';

const path = '/auth/register/phone';
const cookieName = 'relish-dorian-phone-signup';
const proofWindowSeconds = 15 * 60;
const cookiePurpose = 'dorian-phone-signup:v1';
type SignupFlow = { phone: string; browserBinding: string; challengeId: string; expires: number };

function readSignupFlow(cookies: Cookies, origin: string): SignupFlow | null {
	try {
		const token = cookies.get(cookieName);
		if (!token) return null;
		const value = decrypt(token, cookiePurpose + ':' + origin);
		if (!value) return null;
		const flow = JSON.parse(value) as SignupFlow;
		return flow.expires > Date.now() ? flow : null;
	} catch {
		return null;
	}
}

function requireSignup(locals: App.Locals, url: URL, request?: Request) {
	if (locals.user) throw redirect(303, '/people');
	if (!dorianPhoneSignupAvailable(locals) || url.origin !== locals.appOrigin)
		throw error(404, 'Phone signup is unavailable.');
	if (request && request.headers.get('origin') !== url.origin) throw error(403, 'Invalid signup origin.');
}

export const load: PageServerLoad = async ({ locals, url, cookies, setHeaders }) => {
	requireSignup(locals, url);
	setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'same-origin' });
	const next = await exchangeAuthReturn(cookies, url, locals, safeAuthReturn(url.searchParams.get('next')));
	return { codeRequested: Boolean(readSignupFlow(cookies, url.origin)), next };
};

export const actions: Actions = {
	send: async ({ locals, request, url, cookies, getClientAddress }) => {
		requireSignup(locals, url, request);
		const form = await request.formData();
		let phone: string;
		try {
			phone = verificationPhone(String(form.get('mobile') ?? ''));
		} catch {
			return fail(400, { error: 'Enter a valid Australian mobile number.' });
		}
		const address = getClientAddress();
		if (!await consumePasswordSignupAttempt(address))
			return fail(429, { error: 'Too many signup attempts. Please try again in 15 minutes.' });
		const flow: SignupFlow = {
			phone, browserBinding: 'dorian-phone-signup:' + randomUUID(), challengeId: randomUUID(),
			expires: Date.now() + proofWindowSeconds * 1000
		};
		const previous = readSignupFlow(cookies, url.origin);
		let queued = false;
		try {
			queued = await sendDorianPhoneSignupCode(locals, flow, address);
		} catch {
			// A public response never identifies which mobile numbers have a caller account.
		}
		// A cooldown without a new challenge leaves the prior code usable.
		const stored = !queued && previous?.phone === phone ? previous : flow;
		cookies.set(cookieName, encrypt(JSON.stringify(stored), cookiePurpose + ':' + url.origin), {
			path, maxAge: Math.max(0, Math.ceil((stored.expires - Date.now()) / 1000)), sameSite: 'lax', httpOnly: true, secure: true
		});
		return { codeRequested: true };
	},
	activate: async ({ locals, request, url, cookies, getClientAddress }) => {
		requireSignup(locals, url, request);
		const flow = readSignupFlow(cookies, url.origin);
		if (!flow) return fail(400, { error: 'Request a new verification code.' });
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const code = String(form.get('code') ?? '').trim();
		if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
			return fail(400, { error: 'Enter a valid email address.' });
		if (password.length < 8 || password.length > 128)
			return fail(400, { error: 'Use a password with 8 to 128 characters.' });
		if (!/^[0-9]{6}$/.test(code)) return fail(400, { error: 'Enter the six-digit code.' });
		const address = getClientAddress();
		if (!await consumePasswordSignupAttempt(address))
			return fail(429, { error: 'Too many signup attempts. Please try again in 15 minutes.' });
		let userId: string | null;
		try {
			userId = await activateDorianPhoneSignup(locals, flow, code, address, email, await hashPassword(password));
		} catch (cause) {
			if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'P2002')
				return fail(400, { error: 'That email is already in use. Enter a different email.' });
			userId = null;
		}
		if (!userId) return fail(400, { error: 'Could not verify that code. Try again or request a new code.' });
		cookies.delete(cookieName, { path });
		const next = await exchangeAuthReturn(cookies, url, locals, safeAuthReturn(url.searchParams.get('next')));
		const { cookie, expiresAt, sessionId } = await createSession(userId);
		setSessionCookie(cookies, locals, cookie, expiresAt);
		await startExchangeAfterAuth(cookies, url, locals, next, userId, sessionId);
		throw redirect(303, profileReturnForAccount(cookies, next === EXCHANGE_RETURN ? next : PROFILE_ONBOARDING_RETURN, userId));
	}
};
