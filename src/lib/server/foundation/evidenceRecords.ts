// Shared version and encryption conventions for owner-scoped evidence writers.
import { randomUUID } from 'node:crypto';
import { buildScopedMacToken, encrypt } from '$lib/crypto';
import type { AppTransactionClient } from '$lib/db';
import { FoundationDenied } from './internal';

type Custody = { ownerUserId: string; vaultId: string };
export class FoundationConflict extends Error {
	constructor() {
		super('The revision or replay key conflicts with saved work.');
	}
}
export function scope(access: Custody) {
	return { ownerUserId: access.ownerUserId, vaultId: access.vaultId };
}
export function mac(access: Custody, purpose: string, value: string) {
	return buildScopedMacToken(value, 'foundation:v1:' + access.vaultId + ':' + purpose);
}
export function aad(access: Custody, table: string, field: string, row: string) {
	return ['foundation', 'v1', table, field, access.ownerUserId, access.vaultId, row].join(':');
}
export async function activeSubjects(tx: AppTransactionClient, ids: string[]) {
	const count = await tx.foundationSubject.count({ where: { id: { in: ids }, state: 'ACTIVE' } });
	if (!ids.length || count !== ids.length) throw new FoundationDenied();
}
export function lineage(previous: { id: string; version: number } | null) {
	return {
		version: (previous?.version ?? 0) + 1,
		previousVersionId: previous?.id ?? null,
		previousVersionNumber: previous?.version ?? null
	};
}
// Stable per-vault opaque UUIDv8 for scoped creation and retry keys.
export function scopedId(access: Custody, purpose: string, key: string) {
	const hash = mac(access, purpose, key);
	return [
		hash.slice(0, 8),
		hash.slice(8, 12),
		'8' + hash.slice(13, 16),
		'8' + hash.slice(17, 20),
		hash.slice(20, 32)
	].join('-');
}

export async function recordEvidenceSegment(
	tx: AppTransactionClient,
	access: Custody,
	versionId: string,
	contentMac: string,
	start: number,
	end: number,
	quote: string,
	subjectIds: string[],
	speakerId?: string,
	turn?: { turnId: string; speakerRole: string }
) {
	const custody = scope(access);
	const segmentId = randomUUID();
	const anchor = JSON.stringify({ encoding: 'UTF-16', start, end, contentMac, ...turn });
	const anchorMac = mac(access, 'anchor:' + versionId, anchor);
	if (turn) {
		const existing = await tx.foundationEvidenceSegment.findFirst({
			where: { sourceVersionId: versionId, anchorMac },
			select: { id: true }
		});
		if (existing) return existing.id;
	}
	await tx.foundationEvidenceSegment.create({
		data: {
			...custody,
			id: segmentId,
			sourceVersionId: versionId,
			speakerSubjectId: speakerId,
			speakerKind: speakerId ? 'PERSON' : null,
			anchorMac,
			anchorEnc: encrypt(anchor, aad(access, 'FoundationEvidenceSegment', 'anchorEnc', segmentId)),
			excerptEnc: encrypt(quote, aad(access, 'FoundationEvidenceSegment', 'excerptEnc', segmentId))
		}
	});
	for (const subjectId of subjectIds)
		await tx.foundationEvidenceSubject.create({ data: { ...custody, segmentId, subjectId } });
	return segmentId;
}
