import { ChannelDenied } from '$lib/server/foundation/channelDiagnostics';
// Fixed API endpoint, bounded delivery and safe errors. No credential, recipient, code or response logging.
export function emailVerificationConfigured() {
	return Boolean(
		process.env.RESEND_API_KEY &&
			process.env.RELISH_VERIFICATION_EMAIL_FROM &&
			/^[^\r\n]+@[^\r\n]+$/.test(process.env.RELISH_VERIFICATION_EMAIL_FROM)
	);
}
export async function sendVerificationEmail(to: string, code: string, deliveryId: string) {
	if (!emailVerificationConfigured() || !/^[0-9]{6}$/.test(code))
		throw new ChannelDenied('EMAIL_NOT_CONFIGURED');
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
			'Content-Type': 'application/json',
			'Idempotency-Key': 'relish-verification/' + deliveryId
		},
		body: JSON.stringify({
			from: process.env.RELISH_VERIFICATION_EMAIL_FROM,
			to: [to],
			subject: 'Your Relish verification code',
			text: `Your Relish verification code: ${code}. It expires in 15 minutes. If you did not request it, ignore this email.`
		}),
		signal: AbortSignal.timeout(12000)
	});
	if (!response.ok) {
		const reason =
			response.status === 401
				? 'EMAIL_API_UNAUTHORIZED'
				: response.status === 403
					? 'EMAIL_API_FORBIDDEN'
					: response.status === 429
						? 'EMAIL_API_RATE_LIMITED'
						: response.status >= 500
							? 'EMAIL_API_UNAVAILABLE'
							: 'EMAIL_API_INVALID_REQUEST';
		// Classify the HTTP status only. Resend bodies may contain recipient addresses.
		throw new ChannelDenied(reason);
	}
}
