// PURPOSE: Participant-owned Dorian browser conversation entry.
// SECURITY: Never borrow the inviter's or a platform operator's ElevenLabs deployment.
// ElevenLabs webhook resolution is deployment-scoped. A shared deployment would write
// under its owner's custody, so it is intentionally not eligible here.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { startSharedNetworkSession, configuredSharedBindingId } from '$lib/server/integrations/elevenlabs/networkSession';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const contextSpaceId = locals.contextDomainKey === 'general' ? locals.contextSpaceId : null;
  if (!contextSpaceId) return { status: 'NO_GENERAL_CONTEXT' as const, launch: null, sharedEnabled: false };
  if (configuredSharedBindingId()) return { status: 'SHARED_AVAILABLE' as const, launch: null, sharedEnabled: true };

  // Only the current member's General deployment may be used: the signed post-call
  // webhook resolves the destination from this deployment, not from browser variables.
  const bindings = await prisma.agentProviderBinding.findMany({
    where: {
      userId, contextSpaceId, provider: 'ELEVENLABS', isActive: true,
      validFrom: { lte: new Date() }, OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      providerAgentIdEnc: { not: null },
      agentDefinition: { key: 'DORIAN' }
    },
    select: { providerAgentIdEnc: true },
    take: 2
  });
  // Avoid arbitrary selection across multiple valid deployments.
  if (bindings.length !== 1 || !bindings[0].providerAgentIdEnc) {
    return { status: 'NO_PRIVATE_DEPLOYMENT' as const, launch: null };
  }
  // A participant's self-contact is distinct from the inviter's contact about them.
  // Refuse to create a pseudo-identity or attach the conversation to the inviter.
  const contacts = await prisma.contact.findMany({
    where: { userId, contextSpaceId, linkedUserId: userId },
    select: { id: true }, take: 2
  });
  if (contacts.length !== 1) return { status: 'NO_SELF_IDENTITY' as const, launch: null };
  const agentId = decrypt(bindings[0].providerAgentIdEnc, 'agentProviderBinding.providerAgentId');
  return {
    status: 'READY' as const,
    launch: {
      agentId,
      // These are identification hints, NOT authorization or custody routing.
      // Webhook signatures and the deployment resolver remain authoritative.
      dynamicVariables: JSON.stringify({
        relish_contact_id: contacts[0].id,
        call_type: 'NETWORK_PARTICIPANT_BROWSER',
        call_instruction: 'Have a respectful, exploratory conversation with this participant. Do not presume consent to share, match, or publish personal information.'
      })
    }
  };
};

// A POST from the signed-in member is required to issue a short-lived voice session.
export const actions: Actions = {
  start: async ({ locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const contextSpaceId = locals.contextDomainKey === 'general' ? locals.contextSpaceId : null;
    if (!contextSpaceId) return { sharedError: 'General ContextSpace is unavailable.' };
    const result = await startSharedNetworkSession(locals.user.id, contextSpaceId);
    if (!result || result.status !== 'READY') return { sharedError: 'Shared Dorian is not configured or your self-contact is missing.' };
    return { sharedLaunch: { agentId: result.agentId, dynamicVariables: result.dynamicVariables } };
  }
};
