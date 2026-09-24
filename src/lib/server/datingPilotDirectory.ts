// PURPOSE: Minimal Dating pilot people and Introduction directory.
// SECURITY: Callers must already be inside an authenticated Dating ContextSpace request.

import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';

export async function listDatingPeople(userId: string) {
	const rows = await prisma.contact.findMany({
		where: { userId },
		select: { id: true, fullNameEnc: true, linkedUserId: true, createdAt: true },
		orderBy: { updatedAt: 'desc' },
		take: 500
	});
	return Promise.all(
		rows.map(async (row) => ({
			id: row.id,
			name: await contactDisplayName(row),
			createdAt: row.createdAt
		}))
	);
}

export async function createDatingPerson(params: {
	userId: string;
	contextSpaceId: string;
	name: string;
}) {
	const name = String(params.name || '').trim();
	if (!name) throw new Error('Name is required.');
	if (name.length > 200) throw new Error('Name is too long.');

	// IT: Equality checks remain local to the active Dating ContextSpace through the Prisma custody extension.
	const existing = await prisma.contact.findFirst({
		where: { userId: params.userId, fullNameIdx: buildIndexToken(name) },
		select: { id: true }
	});
	if (existing) throw new Error('A Dating person with this name already exists.');

	return prisma.contact.create({
		data: {
			userId: params.userId,
			contextSpaceId: params.contextSpaceId,
			fullNameEnc: encrypt(name, 'contact.full_name'),
			fullNameIdx: buildIndexToken(name),
			source: 'MANUAL'
		},
		select: { id: true }
	});
}

export function datingPartyLabel(party: any) {
	return party?.contact?.name || party?.company?.name || `Participant ${party?.side || ''}`.trim();
}
