// PURPOSE: Owner-only management of account roles and independent feature grants.
// SECURITY: Never permit unauthenticated setup or privilege self-escalation.
import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { hashPassword } from '$lib/auth';
import { devPilotEnabled, DEV_PILOT_ID_PREFIX } from '$lib/server/foundation/devPilotGate';
import { createDevPilotAccount } from '$lib/server/foundation/provisioning';
import { captureFailureMetadata } from '$lib/server/core/contactCaptureDiagnostics';
import { decryptUserEmail } from '$lib/server/userEmail';

const grantsAllowed = new Set(['OPERATOR', 'ADMIN', 'BROKER']);

function assertOwner(locals: App.Locals): string {
  if (!locals.user) throw redirect(303, '/auth/login');
  // SECURITY: ADMIN grants do not enable changing account permissions.
  if (locals.user.role !== 'owner') throw error(403, 'Only a system owner can manage account permissions.');
  return locals.user.id;
}

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  assertOwner(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  const users = await prisma.user.findMany({
    select: { id: true, role: true, email_Enc: true, createdAt: true, capabilityGrants: { select: { capability: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200
  });
  // SECURITY: Decrypt email only on this owner-restricted page, never in common layout data.
  const pilotEnabled = devPilotEnabled(locals, url.origin);
  const pilot = pilotEnabled ? await prisma.user.findFirst({
    where: { id: { startsWith: DEV_PILOT_ID_PREFIX } },
    select: { email_Enc: true }
  }) : null;
  return { pilotEnabled, pilotEmail: pilot ? decryptUserEmail(pilot.email_Enc) : null,
    users: users.map(user => ({ id: user.id, role: user.role,
    email: decryptUserEmail(user.email_Enc) ?? '(no email)',
    createdAt: user.createdAt.toISOString(),
    grants: user.capabilityGrants.map(grant => grant.capability)
  })) };
};

export const actions: Actions = {
  createFoundationTest: async ({ locals, request, url }) => {
    assertOwner(locals);
    if (!devPilotEnabled(locals, url.origin)) throw error(404, 'DEV foundation pilot unavailable.');
    if (request.headers.get('origin') !== url.origin) throw error(403, 'Submit from the DEV account page.');
    const form = await request.formData();
    const password = form.get('pilotPassword');
    if (typeof password !== 'string' || password.length < 16 || password.length > 128) {
      return fail(400, { error: 'Use a test password of 16 to 128 characters.' });
    }
    try {
      const { email } = await createDevPilotAccount(locals, url.origin, await hashPassword(password));
      return { success: 'DEV foundation test account created.', pilotEmail: email };
    } catch (e) {
      if (isHttpError(e)) throw e;
      // Never log a password, credential email or raw Prisma diagnostics.
      const reference = randomUUID();
      console.error(JSON.stringify({ component: 'relish.foundation.dev-pilot', reference, ...captureFailureMetadata(e) }));
      return fail(503, { error: 'Could not create the DEV test account. Reference: ' + reference });
    }
  },
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
