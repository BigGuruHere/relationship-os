// Private directory primitives. All projections are explicit; associations never confer access.
import { randomUUID } from 'node:crypto';
import { encrypt, decrypt } from '$lib/crypto';
import { withFoundationAccess, type FoundationAccess } from './policy';
import { FoundationDenied } from './internal';
import type { AppTransactionClient } from '$lib/db';

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
function aad(access: FoundationAccess, id: string) {
	return `foundation:v1:FoundationSubject:displayNameEnc:${access.ownerUserId}:${access.vaultId}:${id}`;
}
function view(
	access: FoundationAccess,
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
	access: FoundationAccess,
	kind: Kind,
	name: string
) {
	const id = randomUUID();
	return tx.foundationSubject.create({
		data: {
			id,
			ownerUserId: access.ownerUserId,
			vaultId: access.vaultId,
			kind,
			displayNameEnc: encrypt(label(name), aad(access, id))
		},
		select
	});
}
export function createPerson(access: FoundationAccess, name: string) {
	return withFoundationAccess(access, 'WRITE', async (tx) =>
		view(access, await insert(tx, access, 'PERSON', name))
	);
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
	return withFoundationAccess(access, 'WRITE', async (tx) => {
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
		const row = await insert(tx, access, kind, name);
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
	});
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
export function archiveSubject(access: FoundationAccess, id: string) {
	return withFoundationAccess(access, 'WRITE', async (tx) => {
		const row = await tx.foundationSubject.findFirst({
			where: { id, state: 'ACTIVE' },
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
