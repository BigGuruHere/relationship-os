// Offline support command. Read the P-305 runbook before handling a verified case.
import { open, realpath, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkOperatorTarget } from './foundation/operator-target';
import { captureFailureMetadata } from '../src/lib/server/core/contactCaptureDiagnostics';

const [command, caseRef, account, output] = process.argv.slice(2);
const reference = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validCommand = ['inspect', 'review', 'suspend', 'erase', 'expire-exchanges'].includes(
	command
);
let stage = 'preflight';

async function exportPath() {
	if (!isAbsolute(output) || !output.endsWith('.json')) throw new Error('Invalid review path.');
	const parent = await realpath(dirname(output));
	const directory = relative(await realpath(process.cwd()), parent);
	// Keep the review artifact out of the checkout, even when a directory is symlinked.
	if (!directory || (!isAbsolute(directory) && directory !== '..' && !directory.startsWith('../')))
		throw new Error('Review path must be outside the checkout.');
	return join(parent, basename(output));
}

async function writeReview(path: string, data: unknown) {
	const file = await open(path, 'wx', 0o600);
	try {
		await file.writeFile(JSON.stringify(data, null, 2) + '\n');
		await file.close();
	} catch (error) {
		await file.close().catch(() => {});
		await unlink(path).catch(() => {});
		throw error;
	}
}

async function main() {
	if (
		!validCommand ||
		!reference.test(caseRef ?? '') ||
		!/^[a-z0-9_-]{1,128}$/i.test(account ?? '') ||
		process.argv.length !== (command === 'review' ? 6 : 5)
	)
		throw new Error('Invalid command.');
	checkOperatorTarget(process.env.P305_EXPECTED_TARGET);
	if (
		['suspend', 'erase', 'expire-exchanges'].includes(command) &&
		process.env.P305_CONFIRM !== command + ':' + account + ':' + caseRef
	)
		throw new Error('Case confirmation required.');
	const path = command === 'review' ? await exportPath() : null;

	stage = 'operation';
	const privacy = await import('../src/lib/server/foundation/privacyOperations');
	const { prisma } = await import('../src/lib/db');
	try {
		if (path) {
			const review = await privacy.reviewFoundationPrivacy(account);
			stage = 'write_review';
			await writeReview(path, review);
			console.log(
				JSON.stringify({ component: 'relish.foundation.privacy', caseRef, command, written: true })
			);
			return;
		}
		const result =
			command === 'expire-exchanges'
				? await privacy.expireFoundationExchanges(account)
				: command === 'erase'
					? await privacy.eraseFoundationPrivacy(account)
					: command === 'suspend'
						? await privacy.suspendFoundationPrivacy(account)
						: await privacy.inspectFoundationPrivacy(account);
		console.log(
			JSON.stringify({ component: 'relish.foundation.privacy', caseRef, command, ...result })
		);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((failure) => {
	// Avoid echoing submitted IDs, credentials, paths, queries or provider/Prisma errors.
	console.error(
		JSON.stringify({
			component: 'relish.foundation.privacy',
			stage,
			command: validCommand ? command : 'invalid',
			reference: randomUUID(),
			...(reference.test(caseRef ?? '') ? { caseRef } : {}),
			...captureFailureMetadata(failure)
		})
	);
	process.exitCode = 1;
});
