// Anonymous exchange intake. Token/publication/root checks grant creation only, never owner impersonation.
import { randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { encrypt, buildScopedMacToken } from '$lib/crypto';
import { validateContactDetails } from '$lib/server/core/contacts';
import { CAPTURE_CONSENT_VERSION } from '$lib/server/core/contactCaptureToken';
import { withPublicCapture } from './policy';
import { insertPrivatePerson } from './subjects';

const visitorLimits = new Map<string, { at: number; count: number }>();
export async function captureFoundationContact(
	profileId: string,
	input: {
		name: unknown;
		email?: unknown;
		phone?: unknown;
		captureToken?: unknown;
		browser: string;
	}
) {
	const details = validateContactDetails(input);
	await withPublicCapture(profileId, input.captureToken, input.browser, async (tx, intake) => {
		const { ownerUserId, vaultId, prefix } = intake;
		const custody = { ownerUserId, vaultId };
		const mac = (purpose: string, value: string) =>
			buildScopedMacToken(value, 'foundation:v1:' + vaultId + ':' + purpose);
		const aad = (table: string, field: string, id: string) =>
			['foundation', 'v1', table, field, ownerUserId, vaultId, id].join(':');
		const payload = JSON.stringify({ version: 1, kind: 'CONTACT_EXCHANGE', ...details });
		// Scope both retry and content comparison to this profile. Never match a person's email/name.
		const ingestKey = prefix + mac('capture-receipt', intake.nonce);
		const contentMac = mac('capture-content:' + profileId, payload);
		const prior = await tx.foundationSource.findFirst({
			where: { kind: 'CONTACT_EXCHANGE', ingestKey },
			select: { id: true }
		});
		if (prior) {
			const version = await tx.foundationSourceVersion.findFirst({
				where: { sourceId: prior.id, version: 1 },
				select: { contentMac: true }
			});
			if (version?.contentMac !== contentMac)
				throw error(
					409,
					'This form was already submitted with different details. Reload to share again.'
				);
			return;
		}
		const now = Date.now();
		const visitorKey = mac('capture-visitor', profileId + ':' + input.browser);
		for (const [key, value] of visitorLimits)
			if (now - value.at > 3600000) visitorLimits.delete(key);
		const recent = visitorLimits.get(visitorKey) ?? { at: now, count: 0 };
		if (
			visitorLimits.size >= 10000 ||
			recent.count >= 10 ||
			(await tx.foundationSource.count({
				where: {
					kind: 'CONTACT_EXCHANGE',
					ingestKey: { startsWith: prefix },
					createdAt: { gte: new Date(now - 3600000) }
				}
			})) >= 100
		)
			throw error(429, 'Please try again later.');
		visitorLimits.set(visitorKey, { at: recent.at, count: recent.count + 1 });
		const submittedAt = new Date(now);
		const sourceId = randomUUID(),
			versionId = randomUUID(),
			segmentId = randomUUID();
		const person = await insertPrivatePerson(tx, custody, details, {
			submittedAt: submittedAt.toISOString(),
			profileId,
			sourceId
		});
		await tx.foundationSource.create({
			data: { ...custody, id: sourceId, kind: 'CONTACT_EXCHANGE', ingestKey },
			select: { id: true }
		});
		const provenance = {
			version: 1,
			kind: 'CONTACT_CAPTURE',
			profileId,
			profileKind: intake.profileKind,
			captureChannel: 'PROFILE_DETAILS_FORM',
			entryHint: intake.via,
			entryHintAssurance: 'UNVERIFIED_LINK_HINT',
			submittedAt: submittedAt.toISOString(),
			identityStatus: 'UNVERIFIED_SELF_SUBMISSION',
			submittedFields: [
				'name',
				...(details.email ? ['email'] : []),
				...(details.phone ? ['phone'] : [])
			],
			consent: {
				version: CAPTURE_CONSENT_VERSION,
				purpose: 'PRIVATE_CONTACT_AND_FOLLOWUP',
				acceptedAt: submittedAt.toISOString()
			}
		};
		await tx.foundationSourceVersion.create({
			data: {
				...custody,
				id: versionId,
				sourceId,
				version: 1,
				recordedByKind: 'VISITOR',
				processingAdmission: 'STORED_ONLY',
				occurredAt: submittedAt,
				contentMac,
				payloadEnc: encrypt(payload, aad('FoundationSourceVersion', 'payloadEnc', versionId)),
				provenanceEnc: encrypt(
					JSON.stringify(provenance),
					aad('FoundationSourceVersion', 'provenanceEnc', versionId)
				)
			},
			select: { id: true }
		});
		// A typed subject association preserves origin without declaring the submitter's verified identity.
		const anchor = JSON.stringify({
			encoding: 'UTF-16',
			start: 0,
			end: payload.length,
			contentMac
		});
		await tx.foundationEvidenceSegment.create({
			data: {
				...custody,
				id: segmentId,
				sourceVersionId: versionId,
				anchorMac: mac('anchor:' + versionId, anchor),
				anchorEnc: encrypt(anchor, aad('FoundationEvidenceSegment', 'anchorEnc', segmentId)),
				excerptEnc: encrypt(payload, aad('FoundationEvidenceSegment', 'excerptEnc', segmentId))
			},
			select: { id: true }
		});
		await tx.foundationEvidenceSubject.create({
			data: { ...custody, segmentId, subjectId: person.id },
			select: { id: true }
		});
	});
}
