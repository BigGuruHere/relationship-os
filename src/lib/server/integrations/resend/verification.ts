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
		throw new Error('EMAIL_UNAVAILABLE');
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
	if (!response.ok) throw new Error('EMAIL_DELIVERY_FAILED');
}
