// Copy only the selected published card into recipient-owned evidence. Private origin history stays private.
import { randomUUID } from 'node:crypto';
import type { AppTransactionClient } from '$lib/db';
import { claimMac, seal } from './exchangeCrypto';

export async function insertExchangeReceipt(
	tx: AppTransactionClient,
	root: { ownerUserId: string; vaultId: string },
	subjectId: string,
	snapshot: { name: string; email: string; phone: string },
	exchangeId: string,
	profileId: string,
	authority: 'PUBLISHED_PROFILE' | 'VERIFIED_EXCHANGE' = 'VERIFIED_EXCHANGE'
) {
	const sourceId = randomUUID(),
		versionId = randomUUID(),
		segmentId = randomUUID();
	const payload = { version: 1, kind: 'CONTACT_EXCHANGE', ...snapshot };
	const text = JSON.stringify(payload);
	const contentMac = claimMac(text, 'shared-card:' + root.vaultId + ':' + exchangeId);
	await tx.foundationSource.create({
		data: { ...root, id: sourceId, kind: 'CONTACT_EXCHANGE', ingestKey: 's402:' + exchangeId }
	});
	await tx.foundationSourceVersion.create({
		data: {
			...root,
			id: versionId,
			sourceId,
			version: 1,
			recordedByKind: 'SERVICE',
			processingAdmission: 'STORED_ONLY',
			occurredAt: new Date(),
			contentMac,
			payloadEnc: seal('FoundationSourceVersion', 'payloadEnc', root, versionId, payload),
			provenanceEnc: seal('FoundationSourceVersion', 'provenanceEnc', root, versionId, {
				version: 1,
				kind: 'SHARED_PROFILE',
				exchangeId,
				profileId,
				copiedAt: new Date().toISOString(),
				authority,
				ongoingUpdates: false
			})
		}
	});
	const anchor = { encoding: 'UTF-16', start: 0, end: text.length, contentMac };
	await tx.foundationEvidenceSegment.create({
		data: {
			...root,
			id: segmentId,
			sourceVersionId: versionId,
			anchorMac: claimMac(JSON.stringify(anchor), 'shared-anchor:' + versionId),
			anchorEnc: seal('FoundationEvidenceSegment', 'anchorEnc', root, segmentId, anchor),
			excerptEnc: seal('FoundationEvidenceSegment', 'excerptEnc', root, segmentId, payload)
		}
	});
	await tx.foundationEvidenceSubject.create({ data: { ...root, segmentId, subjectId } });
	return sourceId;
}
