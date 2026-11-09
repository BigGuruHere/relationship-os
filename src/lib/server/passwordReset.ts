import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from '$lib/auth';
import { prisma } from '$lib/db';
import { requiredEnv } from '$lib/server/config/requiredEnv';
import { sendPasswordResetEmail } from '$lib/server/integrations/resend/verification';
import { decryptUserEmail, findUserByEmail } from '$lib/server/userEmail';

function mac(purpose: string, value: string) {
	return createHmac('sha256', requiredEnv('SESSION_COOKIE_SECRET', 24))
		.update('relish:password-reset:v1:' + purpose + ':' + value)
		.digest('hex');
}

function credential(passwordHash: string, emailIndex: Uint8Array) {
	return mac('credential', passwordHash + ':' + Buffer.from(emailIndex).toString('hex'));
}

export async function requestPasswordReset(email: string, origin: string) {
	await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
	const user = await findUserByEmail(email);
	// An OAuth-only account cannot acquire a password through recovery.
	if (!user?.passwordHash || !user.email_Idx) return;
	const destination = decryptUserEmail(user.email_Enc);
	if (!destination) return;

	const token = randomBytes(32).toString('base64url');
	const tokenHash = mac('token', token);
	await prisma.passwordResetToken.create({
		data: {
			tokenHash, userId: user.id, credential: credential(user.passwordHash, user.email_Idx),
			expiresAt: new Date(Date.now() + 30 * 60 * 1000)
		}
	});
	// Keep reset credentials in the URL fragment so proxies and HTTP access logs never see them.
	const link = new URL('/auth/reset-password', origin);
	link.hash = token;
	await sendPasswordResetEmail(destination, link.href, randomUUID());
}

class ResetUnavailable extends Error {}

export async function completePasswordReset(token: string, password: string) {
	if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
	const tokenHash = mac('token', token);
	const reset = await prisma.passwordResetToken.findUnique({
		where: { tokenHash },
		include: { user: { select: { passwordHash: true, email_Idx: true } } }
	});
	const previous = reset?.user.passwordHash;
	const emailIndex = reset?.user.email_Idx;
	if (!reset || reset.expiresAt <= new Date() || !previous || !emailIndex ||
		reset.credential !== credential(previous, emailIndex)) return false;

	const passwordHash = await hashPassword(password);
	try {
		await prisma.$transaction(async (tx) => {
			// Update the account first. Concurrent resets with the old credential cannot both win.
			const updated = await tx.user.updateMany({
				where: { id: reset.userId, passwordHash: previous, email_Idx: emailIndex },
				data: { passwordHash }
			});
			if (!updated.count) throw new ResetUnavailable();
			const consumed = await tx.passwordResetToken.deleteMany({
				where: { tokenHash, expiresAt: { gt: new Date() } }
			});
			if (!consumed.count) throw new ResetUnavailable();
			await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId } });
			await tx.session.deleteMany({ where: { userId: reset.userId } });
		});
		return true;
	} catch (failure) {
		if (failure instanceof ResetUnavailable) return false;
		throw failure;
	}
}
