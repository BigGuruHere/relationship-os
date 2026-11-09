import { setTimeout as delay } from 'node:timers/promises';
import { fail } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/auth';
import { emailVerificationConfigured } from '$lib/server/integrations/resend/verification';
import { consumePasswordResetCompletion, consumePasswordResetRequest } from '$lib/server/loginThrottle';
import { completePasswordReset, requestPasswordReset } from '$lib/server/passwordReset';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'same-origin' });
	return { available: emailVerificationConfigured() };
};

export const actions: Actions = {
	request: async ({ request, url, locals, getClientAddress }) => {
		if (request.headers.get('origin') !== url.origin || url.origin !== locals.appOrigin)
			return fail(403, { error: 'Please submit from this page.' });
		if (!emailVerificationConfigured())
			return fail(503, { error: 'Password recovery is temporarily unavailable.' });
		const form = await request.formData();
		const email = String(form.get('email') || '').trim().toLowerCase();
		if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
			return fail(400, { error: 'Enter a valid email address.' });

		// Use the same response for unknown, Google-only, throttled and deliverable
		// addresses. The floor covers normal lookup and the bounded provider call.
		const responseFloor = delay(4000);
		try {
			if (await consumePasswordResetRequest(getClientAddress(), email)) {
				const devRecipients = (process.env.RELISH_EXCHANGE_TEST_EMAILS || '')
					.split(',').map(value => value.trim().toLowerCase());
				if (locals.env !== 'dev' || devRecipients.includes(email))
					await requestPasswordReset(email, locals.appOrigin);
			}
		} catch {
			console.warn('Relish password reset request could not be processed.');
		}
		await responseFloor;
		return { requested: true };
	},
	complete: async ({ request, url, locals, cookies, getClientAddress }) => {
		if (request.headers.get('origin') !== url.origin || url.origin !== locals.appOrigin)
			return fail(403, { error: 'Please submit from this page.' });
		const form = await request.formData();
		const token = String(form.get('token') || '');
		const password = String(form.get('password') || '');
		if (password.length < 8 || password.length > 128)
			return fail(400, { error: 'Use a password with 8 to 128 characters.' });
		if (password !== form.get('confirmation'))
			return fail(400, { error: 'The passwords don’t match.' });
		try {
			if (!await consumePasswordResetCompletion(getClientAddress()))
				return fail(429, { error: 'Too many attempts. Please try again later.' });
			if (!await completePasswordReset(token, password))
				return fail(400, { invalid: true, error: 'This reset link has expired or was already used. Request a new link below.' });
		} catch {
			return fail(503, { error: 'Password recovery is temporarily unavailable.' });
		}
		clearSessionCookie(cookies, locals);
		return { completed: true };
	}
};
