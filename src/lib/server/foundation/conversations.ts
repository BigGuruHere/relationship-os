// Owner-private conversation storage. Transcript and summary have independent lineages.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { decrypt, encrypt } from '$lib/crypto';
import type { AppTransactionClient } from '$lib/db';
import { FoundationDenied } from './internal';
import { withFoundationAccess, type FoundationAccess } from './policy';
import { aad, FoundationConflict, lineage, mac, scope } from './evidenceRecords';

const turnSchema = z.strictObject({
	id: z.string().min(1).max(200),
	role: z.enum(['OWNER', 'AGENT', 'UNRESOLVED']),
	text: z
		.string()
		.min(1)
		.refine((text) => Boolean(text.trim()))
});
const turnsSchema = z
	.array(turnSchema)
	.min(1)
	.max(10000)
	.superRefine((turns, ctx) => {
		if (
			new Set(turns.map((t) => t.id)).size !== turns.length ||
			turns.reduce((total, turn) => total + turn.text.length + 1, 0) > 1_000_000
		)
			ctx.addIssue({
				code: 'custom',
				message: 'Conversation turns are invalid or exceed the storage limit.'
			});
	});
const bindingSchema = z.strictObject({
	provider: z.literal('ELEVENLABS'),
	conversationId: z.string().regex(/^conv_[a-z0-9_-]{1,235}$/i),
	agentId: z.string().min(1).max(240)
});
const captureSchema = z.strictObject({
	format: z.literal('conversation-v1'),
	binding: bindingSchema,
	occurredAt: z.iso.datetime().nullable(),
	completeness: z.enum(['COMPLETE', 'INCOMPLETE']),
	turns: turnsSchema
});
export type CapturedConversation = z.infer<typeof captureSchema>;
type Binding = CapturedConversation['binding'];
export const conversationSummary = z.string().trim().min(1).max(20000);
type SummaryOrigin =
	| { kind: 'HUMAN_AUTHORED' }
	| {
			kind: 'MODEL_DRAFTED' | 'HUMAN_EDITED_MODEL_DRAFT';
			model: string;
			invocationId: string;
	  };

async function requirePerson(tx: AppTransactionClient, personId: string) {
	const person = await tx.foundationSubject.findFirst({
		where: { id: personId, kind: 'PERSON', selfUserId: null, state: 'ACTIVE' },
		select: { id: true }
	});
	if (!person) throw new FoundationDenied();
}
const presentationTable = 'FoundationSourcePresentationVersion';
const sourceVersionTable = 'FoundationSourceVersion';
function sourceKey(access: FoundationAccess, binding: Binding) {
	return mac(
		access,
		'conversation-ingest',
		JSON.stringify([binding.provider, binding.conversationId])
	);
}
function parseCapture(raw: unknown) {
	const capture = captureSchema.parse(raw);
	if (
		capture.completeness === 'COMPLETE' &&
		(!capture.turns.some((t) => t.role === 'OWNER') ||
			!capture.turns.some((t) => t.role === 'AGENT'))
	)
		throw new FoundationDenied();
	return capture;
}

async function replaySave(
	tx: AppTransactionClient,
	access: FoundationAccess,
	personId: string,
	binding: Binding,
	summary: string
) {
	const source = await tx.foundationSource.findFirst({
		where: { ingestKey: sourceKey(access, binding) }
	});
	if (!source) return null;
	const first = await tx.foundationSourcePresentationVersion.findFirst({
		where: { sourceId: source.id, subjectId: personId, version: 1 },
		select: { requestMac: true }
	});
	if (!first || source.kind !== 'IMPORTED_CONVERSATION' || source.state !== 'ACTIVE')
		throw new FoundationDenied();
	if (
		first.requestMac !==
		mac(access, 'conversation-save', JSON.stringify([binding, personId, summary]))
	)
		throw new FoundationConflict();
	return { sourceId: source.id };
}

// A successful save can be retried even after ElevenLabs no longer retains the original.
export function savedConversationReceipt(
	access: FoundationAccess,
	personId: string,
	binding: Binding,
	summary: string
) {
	return withFoundationAccess(access, 'SAVE_CONVERSATION', async (tx) => {
		await requirePerson(tx, personId);
		return replaySave(
			tx,
			access,
			personId,
			bindingSchema.parse(binding),
			conversationSummary.parse(summary)
		);
	});
}

async function appendSourceVersion(
	tx: AppTransactionClient,
	access: FoundationAccess,
	sourceId: string,
	capture: CapturedConversation,
	admission: 'STORED_ONLY' | 'PRIVATE_ANALYSIS',
	previous: { id: string; version: number } | null,
	provenance: object
) {
	const id = randomUUID();
	const payload = JSON.stringify(capture);
	return tx.foundationSourceVersion.create({
		data: {
			...scope(access),
			id,
			sourceId,
			...lineage(previous),
			processingAdmission: admission,
			occurredAt: capture.occurredAt ? new Date(capture.occurredAt) : null,
			recordedByKind: 'SERVICE',
			contentMac: mac(access, 'conversation-content', payload),
			payloadEnc: encrypt(payload, aad(access, sourceVersionTable, 'payloadEnc', id)),
			provenanceEnc: encrypt(
				JSON.stringify(provenance),
				aad(access, sourceVersionTable, 'provenanceEnc', id)
			)
		}
	});
}
async function appendSummary(
	tx: AppTransactionClient,
	access: FoundationAccess,
	personId: string,
	sourceVersion: { id: string; sourceId: string; version: number },
	summary: string,
	origin: SummaryOrigin,
	requestMac: string,
	previous: { id: string; version: number } | null
) {
	const id = randomUUID();
	return tx.foundationSourcePresentationVersion.create({
		data: {
			...scope(access),
			id,
			subjectId: personId,
			sourceId: sourceVersion.sourceId,
			sourceVersionId: sourceVersion.id,
			sourceVersionNumber: sourceVersion.version,
			...lineage(previous),
			summaryEnc: encrypt(summary, aad(access, presentationTable, 'summaryEnc', id)),
			provenanceEnc: encrypt(
				JSON.stringify({
					editorUserId: access.actorId,
					origin: origin.kind,
					...(origin.kind !== 'HUMAN_AUTHORED'
						? {
								generator: 'OpenAI',
								model: origin.model,
								invocationId: origin.invocationId,
								promptVersion: 'person-note-v1'
							}
						: {})
				}),
				aad(access, presentationTable, 'provenanceEnc', id)
			),
			requestMac
		}
	});
}

// Capture comes only from a server-verified provider response. The form supplies only its summary.
export function savePersonConversation(
	access: FoundationAccess,
	personId: string,
	rawCapture: CapturedConversation,
	rawSummary: string,
	origin: SummaryOrigin
) {
	const capture = parseCapture(rawCapture);
	const summary = conversationSummary.parse(rawSummary);
	return withFoundationAccess(access, 'SAVE_CONVERSATION', async (tx) => {
		await requirePerson(tx, personId);
		const replay = await replaySave(tx, access, personId, capture.binding, summary);
		if (replay) return replay;
		const source = await tx.foundationSource.create({
			data: {
				...scope(access),
				kind: 'IMPORTED_CONVERSATION',
				ingestKey: sourceKey(access, capture.binding)
			}
		});
		const version = await appendSourceVersion(tx, access, source.id, capture, 'STORED_ONLY', null, {
			capture: 'DORIAN_WEB'
		});
		await appendSummary(
			tx,
			access,
			personId,
			version,
			summary,
			origin,
			mac(access, 'conversation-save', JSON.stringify([capture.binding, personId, summary])),
			null
		);
		return { sourceId: source.id };
	});
}

export async function currentConversation(
	tx: AppTransactionClient,
	access: FoundationAccess,
	personId: string,
	sourceId: string
) {
	await requirePerson(tx, personId);
	const saved = await tx.foundationSourcePresentationVersion.findFirst({
		where: { sourceId, subjectId: personId, version: 1 },
		select: { id: true }
	});
	const source = await tx.foundationSource.findFirst({
		where: { id: sourceId, state: 'ACTIVE', kind: 'IMPORTED_CONVERSATION' },
		select: { id: true }
	});
	if (!saved || !source) throw new FoundationDenied();
	const version = await tx.foundationSourceVersion.findFirst({
		where: { sourceId },
		orderBy: { version: 'desc' }
	});
	if (!version) throw new FoundationDenied();
	const payload = decrypt(
		version.payloadEnc,
		aad(access, sourceVersionTable, 'payloadEnc', version.id)
	);
	if (version.contentMac !== mac(access, 'conversation-content', payload))
		throw new FoundationDenied();
	return { version, capture: parseCapture(JSON.parse(payload)) };
}

export function listPersonConversations(
	access: FoundationAccess,
	personId: string,
	after?: string
) {
	return withFoundationAccess(access, 'READ_CONVERSATION', async (tx) => {
		await requirePerson(tx, personId);
		const base = { subjectId: personId, version: 1 };
		const cursor = after
			? await tx.foundationSourcePresentationVersion.findFirst({
					where: { ...base, sourceId: after },
					select: { createdAt: true, id: true }
				})
			: null;
		if (after && !cursor) throw new FoundationDenied();
		const rows = await tx.foundationSourcePresentationVersion.findMany({
			where: {
				...base,
				...(cursor
					? {
							OR: [
								{ createdAt: { lt: cursor.createdAt } },
								{ createdAt: cursor.createdAt, id: { lt: cursor.id } }
							]
						}
					: {})
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: 21,
			select: { sourceId: true, createdAt: true }
		});
		const visible = await tx.foundationSource.findMany({
			where: {
				id: { in: rows.slice(0, 20).map((row) => row.sourceId) },
				state: 'ACTIVE',
				kind: 'IMPORTED_CONVERSATION'
			},
			select: { id: true }
		});
		const ids = new Set(visible.map((source) => source.id));
		return {
			items: rows
				.slice(0, 20)
				.filter((row) => ids.has(row.sourceId))
				.map((row) => ({ id: row.sourceId, at: row.createdAt.toISOString() })),
			next: rows.length > 20 ? rows[19].sourceId : null
		};
	});
}
export function readPersonConversation(
	access: FoundationAccess,
	personId: string,
	sourceId: string
) {
	return withFoundationAccess(access, 'READ_CONVERSATION', async (tx) => {
		const { version, capture } = await currentConversation(tx, access, personId, sourceId);
		const latest = await tx.foundationSourcePresentationVersion.findFirst({
			where: { sourceId, subjectId: personId },
			orderBy: { version: 'desc' }
		});
		if (!latest) throw new FoundationDenied();
		return {
			id: sourceId,
			at: (version.occurredAt ?? version.createdAt).toISOString(),
			completeness: capture.completeness,
			turns: capture.turns,
			summary: decrypt(latest.summaryEnc, aad(access, presentationTable, 'summaryEnc', latest.id)),
			summaryVersion: latest.version
		};
	});
}
export function editConversationSummary(
	access: FoundationAccess,
	personId: string,
	sourceId: string,
	expected: number,
	rawSummary: string
) {
	const summary = conversationSummary.parse(rawSummary);
	if (!Number.isSafeInteger(expected) || expected < 1 || expected >= 2147483647)
		throw new FoundationConflict();
	return withFoundationAccess(access, 'SAVE_CONVERSATION', async (tx) => {
		const { version } = await currentConversation(tx, access, personId, sourceId);
		const requestMac = mac(
			access,
			'conversation-summary-edit',
			JSON.stringify([sourceId, expected, summary])
		);
		const replay = await tx.foundationSourcePresentationVersion.findFirst({
			where: { sourceId, version: expected + 1 }
		});
		if (replay?.requestMac === requestMac) return { version: replay.version };
		const latest = await tx.foundationSourcePresentationVersion.findFirst({
			where: { sourceId },
			orderBy: { version: 'desc' }
		});
		if (!latest || latest.version !== expected) throw new FoundationConflict();
		return {
			version: (
				await appendSummary(
					tx,
					access,
					personId,
					version,
					summary,
					{ kind: 'HUMAN_AUTHORED' },
					requestMac,
					latest
				)
			).version
		};
	});
}

// A separate internal operation records explicit admission or an owner correction.
// Draft summarisation and ordinary summary edits never call this operation.
export function reviseConversationSource(
	access: FoundationAccess,
	personId: string,
	sourceId: string,
	expected: number,
	admission: 'STORED_ONLY' | 'PRIVATE_ANALYSIS',
	correction?: {
		turns: CapturedConversation['turns'];
		completeness: CapturedConversation['completeness'];
		reason: string;
	}
) {
	return withFoundationAccess(access, 'REVISE_CONVERSATION_SOURCE', async (tx) => {
		const { version, capture } = await currentConversation(tx, access, personId, sourceId);
		if (!Number.isSafeInteger(expected) || expected < 1 || version.version !== expected)
			throw new FoundationConflict();
		const next = correction
			? parseCapture({ ...capture, turns: correction.turns, completeness: correction.completeness })
			: capture;
		if (admission === 'PRIVATE_ANALYSIS' && next.completeness !== 'COMPLETE')
			throw new FoundationDenied();
		if (!correction && version.processingAdmission === admission)
			return { version: version.version, id: version.id };
		if (correction && !z.string().trim().min(1).max(1000).safeParse(correction.reason).success)
			throw new FoundationDenied();
		const saved = await appendSourceVersion(tx, access, sourceId, next, admission, version, {
			actor: access.actorId,
			...(correction ? { correction: correction.reason } : { admission })
		});
		return { version: saved.version, id: saved.id };
	});
}
