// PURPOSE: Owner-only management of account roles and independent feature grants.
// SECURITY: Never permit unauthenticated setup or privilege self-escalation.
import { error, fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decryptUserEmail } from '$lib/server/userEmail';

const grantsAllowed = new Set(['OPERATOR', 'ADMIN', 'BROKER']);

function assertOwner(locals: App.Locals): string {
  if (!locals.user) throw redirect(303, '/auth/login');
  // SECURITY: ADMIN grants do not enable changing account permissions.
  if (locals.user.role !== 'owner') throw error(403, 'Only a system owner can manage account permissions.');
  return locals.user.id;
}

export const load: PageServerLoad = async ({ locals }) => {
  assertOwner(locals);
  const users = await prisma.user.findMany({
    select: { id: true, role: true, email_Enc: true, createdAt: true, capabilityGrants: { select: { capability: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200
  });
  // SECURITY: Decrypt email only on this owner-restricted page, never in common layout data.
  return { users: users.map(user => ({ id: user.id, role: user.role,
    email: decryptUserEmail(user.email_Enc) ?? '(no email)',
    createdAt: user.createdAt.toISOString(),
    grants: user.capabilityGrants.map(grant => grant.capability)
  })) };
};

export const actions: Actions = {
  save: async ({ locals, request }) => {
    const actorId = assertOwner(locals);
    const form = await request.formData();
    const userId = String(form.get('userId') ?? '');
    const role = String(form.get('role') ?? '');
    const grants = [...new Set(form.getAll('capability').map(String))];
    if (!['owner', 'member', 'guest'].includes(role) || grants.some(grant => !grantsAllowed.has(grant))) {
      return fail(400, { error: 'Invalid role or capability.' });
    }
    // SECURITY: Avoid a lost administrator due to self-demotion or concurrent updates.
    if (userId === actorId && role !== 'owner') return fail(400, { error: 'You cannot demote your own owner account.' });
    try {
      await prisma.$transaction(async tx => {
        const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
        if (!target) throw new Error('User not found.');
        if (target.role === 'owner' && role !== 'owner') {
          // IT: Concurrent owner changes are serialised with this transaction lock.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(8154202)`;
          const count = await tx.user.count({ where: { role: 'owner' } });
          if (count < 2) throw new Error('At least one owner account must remain.');
        }
        await tx.user.update({ where: { id: userId }, data: { role: role as 'owner' | 'member' | 'guest' } });
        await tx.userCapabilityGrant.deleteMany({ where: { userId } });
        if (role === 'member' && grants.length) {
          await tx.userCapabilityGrant.createMany({ data: grants.map(capability => ({
            id: randomUUID(), userId, capability, grantedByUserId: actorId
          })) });
        }
      });
      return { success: 'Permissions saved. Changes apply on the next request.' };
    } catch (e: any) {
      return fail(400, { error: e?.message || 'Permissions could not be saved.' });
    }
  }
};
