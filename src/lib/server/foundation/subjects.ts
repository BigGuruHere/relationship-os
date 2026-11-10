// Private directory primitives. All projections are explicit; associations never confer access.
import { randomUUID } from 'node:crypto';
import { encrypt, decrypt } from '$lib/crypto';
import { withFoundationAccess, type FoundationAccess } from './policy';
import { FoundationDenied } from './internal';
import { validateContactDetails } from '$lib/server/core/contacts';
import type { AppTransactionClient } from '$lib/db';

type Custody = Pick<FoundationAccess, 'ownerUserId' | 'vaultId'>;
type Kind = 'PERSON' | 'RELATIONSHIP' | 'GROUP';
const select = {
	id: true,
	kind: true,
	displayNameEnc: true,
	state: true,
	selfUserId: true
} as const;
function label(value: string) {
	if (typeof value !== 'string' || !value.trim() || value.trim().length > 200)
		throw new Error('A name of 1 to 200 characters is required.');
	return value.trim();
}
function aad(access: Custody, id: string) {
	return `foundation:v1:FoundationSubject:displayNameEnc:${access.ownerUserId}:${access.vaultId}:${id}`;
}
function view(
	access: Custody,
	row: { id: string; kind: Kind; displayNameEnc: string; state: string; selfUserId: string | null }
) {
	return {
		id: row.id,
		kind: row.kind,
		name: decrypt(row.displayNameEnc, aad(access, row.id)),
		state: row.state,
		isSelf: row.selfUserId === access.ownerUserId
	};
}
async function insert(
	tx: AppTransactionClient,
	access: Custody,
	kind: Kind,
	name: string,
	details?: {
		email: string;
		phone: string;
		origin?: { submittedAt: string; profileId: string; sourceId: string };
	},
	id: string = randomUUID()
) {
	return tx.foundationSubject.create({
		data: {
			id,
			ownerUserId: access.ownerUserId,
			vaultId: access.vaultId,
			kind,
			displayNameEnc: encrypt(label(name), aad(access, id)),
			...(details
				? {
						detailsEnc: encrypt(
							JSON.stringify({ version: 1, kind: 'PERSON_DETAILS', ...details }),
							detailsAad(access, id)
						)
					}
				: {})
		},
		select
	});
}
// Optional directory details reuse the existing encrypted column. They assert no verified identity.
function detailsAad(access: Custody, id: string) {
	return `foundation:v1:FoundationSubject:detailsEnc:${access.ownerUserId}:${access.vaultId}:${id}`;
}
const personSelect = { ...select, detailsEnc: true } as const;
function personView(
	access: FoundationAccess,
	row: Parameters<typeof view>[1] & { detailsEnc: string | null }
) {
	const details = row.detailsEnc
		? JSON.parse(decrypt(row.detailsEnc, detailsAad(access, row.id)))
		: { version: 1, kind: 'PERSON_DETAILS', email: '', phone: '' };
	if (
		!details ||
		details.version !== 1 ||
		details.kind !== 'PERSON_DETAILS' ||
		typeof details.email !== 'string' ||
		typeof details.phone !== 'string'
	)
		throw new FoundationDenied();
	// Explicit projection keeps future private metadata out of directory responses.
	return {
		...view(access, row),
		email: typeof details.email === 'string' ? details.email : '',
		phone: typeof details.phone === 'string' ? details.phone : '',
		origin:
			details.origin && typeof details.origin.submittedAt === 'string'
				? { submittedAt: details.origin.submittedAt, channel: 'Profile detail sharing' }
				: null
	};
}
// This helper cannot establish authority. The guarded transaction must already authorize creation.
export function insertPrivatePerson(
	tx: AppTransactionClient,
	custody: Custody,
	input: { name: string; email: string; phone: string },
	origin?: { submittedAt: string; profileId: string; sourceId: string }
) {
	return insert(tx, custody, 'PERSON', input.name, {
		email: input.email,
		phone: input.phone,
		...(origin ? { origin } : {})
	});
}
export function createPerson(
	access: FoundationAccess,
	name: string,
	details: { email?: string; phone?: string } = {}
) {
	const input = validateContactDetails({ name, email: details.email, phone: details.phone });
	return withFoundationAccess(access, 'WRITE', async (tx) => {
		// Name and contact details are inserted together. No identity matching or merging.
		const row = await insertPrivatePerson(tx, access, input);
		return view(access, row);
	});
}
export function readPerson(access: FoundationAccess, id: string) {
	return withFoundationAccess(access, 'READ', async (tx) => {
		const row = await tx.foundationSubject.findFirst({
			where: { id, kind: 'PERSON', state: 'ACTIVE', selfUserId: null },
			select: personSelect
		});
		if (!row) throw new FoundationDenied();
		return personView(access, row);
	});
}
// Scan a bounded owner-only page before decrypting. Continue even if this page has no matches.
// No plaintext search index or global identity lookup is created.
export function searchPeople(access: FoundationAccess, query = '', afterId?: string) {
	if (query.length > 200 || (afterId && !/^[0-9a-f-]{36}$/i.test(afterId)))
		throw new Error('Invalid directory search.');
	return withFoundationAccess(access, 'READ', async (tx) => {
		const people = { kind: 'PERSON', state: 'ACTIVE', selfUserId: null } as const;
		// Resolve the cursor inside this vault before applying the same sort keys to the next page.
		const anchor = afterId ? await tx.foundationSubject.findFirst({
			where: { ...people, id: afterId }, select: { id: true, updatedAt: true }
		}) : null;
		if (afterId && !anchor) return { items: [], next: null };
		const rows = await tx.foundationSubject.findMany({
			where: {
				...people,
				...(anchor ? { OR: [
					{ updatedAt: { lt: anchor.updatedAt } },
					{ updatedAt: anchor.updatedAt, id: { lt: anchor.id } }
				] } : {})
			},
			orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
			take: 51,
			select: personSelect
		});
		const q = query.trim().toLowerCase();
		return {
			items: rows
				.slice(0, 50)
				.map((row) => personView(access, row))
				.filter((p) => !q || [p.name, p.email, p.phone].some((v) => v.toLowerCase().includes(q))),
			next: rows.length > 50 ? rows[49].id : null
		};
	});
}
export function readSubject(access: FoundationAccess, id: string) {
	return withFoundationAccess(access, 'READ', async (tx) => {
		const row = await tx.foundationSubject.findFirst({ where: { id, state: 'ACTIVE' }, select });
		if (!row) throw new FoundationDenied();
		return view(access, row);
	});
}
export function listPeople(access: FoundationAccess, afterId?: string) {
	return withFoundationAccess(access, 'READ', async (tx) => {
		// Keyset pages are bounded before decryption. This is a directory, not global text search.
		const rows = await tx.foundationSubject.findMany({
			where: { kind: 'PERSON', state: 'ACTIVE', ...(afterId ? { id: { gt: afterId } } : {}) },
			orderBy: { id: 'asc' },
			take: 51,
			select
		});
		return {
			items: rows.slice(0, 50).map((r) => view(access, r)),
			next: rows.length > 50 ? rows[49].id : null
		};
	});
}
export function createRelationship(
	access: FoundationAccess,
	name: string,
	personIds: string[],
	kind: 'RELATIONSHIP' | 'GROUP' = 'RELATIONSHIP'
) {
	return withFoundationAccess(access, 'WRITE', (tx) => insertRelationship(tx, access, name, personIds, kind));
}

// Uses an already-scoped transaction so relationship creation can commit with its first statement.
export async function insertRelationship(tx: AppTransactionClient, access: Custody, name: string,
	personIds: string[], kind: 'RELATIONSHIP' | 'GROUP', relationshipId?: string) {
	if (
		!['RELATIONSHIP', 'GROUP'].includes(kind) ||
		!Array.isArray(personIds) ||
		personIds.length > 50 ||
		personIds.some((id) => typeof id !== 'string') ||
		new Set(personIds).size !== personIds.length ||
		personIds.length < (kind === 'RELATIONSHIP' ? 2 : 1)
	)
		throw new Error('Invalid relationship members.');
	const members = await tx.foundationSubject.findMany({
		where: { id: { in: personIds }, kind: 'PERSON', state: 'ACTIVE' },
		select: { id: true }
	});
	if (members.length !== personIds.length) throw new FoundationDenied();
	const row = await insert(tx, access, kind, name, undefined, relationshipId);
	for (const personSubjectId of personIds)
		await tx.foundationMembership.create({
			data: {
				ownerUserId: access.ownerUserId,
				vaultId: access.vaultId,
				containerSubjectId: row.id,
				containerKind: kind,
				personSubjectId,
				personKind: 'PERSON'
			}
		});
	return view(access, row);
}
export function readRelationship(access: FoundationAccess, id: string) {
	return withFoundationAccess(access, 'READ', async (tx) => {
		const row = await tx.foundationSubject.findFirst({
			where: { id, kind: { in: ['RELATIONSHIP', 'GROUP'] }, state: 'ACTIVE' },
			select
		});
		if (!row) throw new FoundationDenied();
		const members = await tx.foundationMembership.findMany({
			where: { containerSubjectId: id, leftAt: null },
			select: { personSubjectId: true },
			take: 51
		});
		if (members.length > 50) throw new FoundationDenied();
		// Each member is independently scoped and active; membership cannot expose archived names.
		const people = await tx.foundationSubject.findMany({
			where: { id: { in: members.map((m) => m.personSubjectId) }, kind: 'PERSON', state: 'ACTIVE' },
			select
		});
		return { ...view(access, row), members: people.map((p) => view(access, p)) };
	});
}
export function archiveSubject(access: FoundationAccess, id: string, kind?: Kind) {
	return withFoundationAccess(access, 'WRITE', async (tx) => {
		const row = await tx.foundationSubject.findFirst({
			where: { id, state: 'ACTIVE', ...(kind ? { kind } : {}) },
			select: { id: true, selfUserId: true }
		});
		if (!row || row.selfUserId) throw new FoundationDenied();
		await tx.foundationSubject.update({
			where: { id },
			data: { state: 'ARCHIVED' },
			select: { id: true }
		});
	});
}
export function createPerspective(
	access: FoundationAccess,
	kind: 'OWNER_RECORDED' | 'ATTRIBUTED_PERSON' | 'AI_INTERPRETATION',
	holderSubjectId?: string
) {
	return withFoundationAccess(access, 'WRITE', async (tx) => {
		if (
			!['OWNER_RECORDED', 'ATTRIBUTED_PERSON', 'AI_INTERPRETATION'].includes(kind) ||
			(kind === 'ATTRIBUTED_PERSON') !== Boolean(holderSubjectId)
		)
			throw new Error('Invalid private perspective.');
		if (
			holderSubjectId &&
			!(await tx.foundationSubject.findFirst({
				where: { id: holderSubjectId, kind: 'PERSON', state: 'ACTIVE' },
				select: { id: true }
			}))
		)
			throw new FoundationDenied();
		return tx.foundationPerspective.create({
			data: {
				ownerUserId: access.ownerUserId,
				vaultId: access.vaultId,
				kind,
				holderSubjectId: holderSubjectId ?? null,
				holderKind: holderSubjectId ? 'PERSON' : null
			},
			select: { id: true, kind: true, holderSubjectId: true }
		});
	});
}
