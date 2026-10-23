// Stage 8.16: only the participant who accepted a profile's offer may start a private voice session.
import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { readPilotBrowser, resolvePilotEntry, pilotKindLabel, recordPilotEvent } from '$lib/server/pilot';
import { startSharedNetworkSession, configuredSharedBindingId } from '$lib/server/integrations/elevenlabs/networkSession';

export const load: PageServerLoad = async ({ locals, cookies, params }) => {
  const visitorUserId = locals.user?.id || await readPilotBrowser(cookies, locals.env);
  if (!visitorUserId) throw error(403, 'This conversation belongs to another browser session.');
  const entry = await resolvePilotEntry({ entryId: params.entryId, visitorUserId });
  if (!entry) throw error(404, 'Conversation invitation unavailable.');
  const preferences = await prisma.relishContextPreference.findUnique({ where: {
    ownerUserId_domainKey: { ownerUserId: entry.ownerUserId, domainKey: entry.domainKey }
  } });
  const connectionRequest = await prisma.pilotConnectionRequest.findUnique({ where: { entryId: entry.id }, select: { id: true } });
  return { entryId: entry.id, hasConnectionRequest: Boolean(connectionRequest),
    profileName: entry.profile.displayName || 'this person',
    contextLabel: pilotKindLabel(entry.profile.kind), sharedEnabled: Boolean(configuredSharedBindingId()),
    source: entry.entrySource, profileSlug: entry.profile.slug,
    dorianMode: preferences?.dorianMode || 'SMS_CALLBACK' };
};
export const actions: Actions = {
  start: async ({ locals, cookies, params }) => {
    const visitorUserId = locals.user?.id || await readPilotBrowser(cookies, locals.env);
    if (!visitorUserId) return fail(403, { error: 'Your browser invitation has expired.' });
    const entry = await resolvePilotEntry({ entryId: params.entryId, visitorUserId });
    if (!entry) return fail(404, { error: 'Conversation invitation unavailable.' });
    const preferences = await prisma.relishContextPreference.findUnique({ where: {
      ownerUserId_domainKey: { ownerUserId: entry.ownerUserId, domainKey: entry.domainKey }
    } });
    if (preferences?.dorianMode !== 'BROWSER') return fail(409, { error: 'Use the telephone option for this context.' });
    // A session must remain in the participant's selected domain, never in the profile owner's space.
    const space = await prisma.contextSpace.findFirst({ where: {
      ownerUserId: visitorUserId, domainKey: entry.domainKey
    }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], select: { id: true } });
    if (!space) return fail(409, { error: 'Your private conversation space is not ready.' });
    const result = await startSharedNetworkSession(visitorUserId, space.id, { pilotEntryId: entry.id,
      domainKey: entry.domainKey as 'business' | 'general' | 'dating',
      profileName: entry.profile.displayName || '', profileKind: entry.profile.kind });
    if (!result || result.status !== 'READY') {
      // Failures here mean a server-controlled launch failed, not a completed conversation.
      if (result?.status !== 'UNDERSTANDING_PENDING') await recordPilotEvent({ type: 'dorian.conversation_failed', env: locals.env,
        profileId: entry.profileId, ownerUserId: entry.ownerUserId,
        domainKey: entry.domainKey as any, entryId: entry.id, visitorUserId, source: entry.entrySource });
      return fail(503, { error: result?.status === 'UNDERSTANDING_PENDING'
        ? 'Your previous conversation is still being processed. Please return later.'
        : 'Dorian is not configured for safe private conversations.' });
    }
    await recordPilotEvent({ type: 'dorian.session_issued', env: locals.env, profileId: entry.profileId,
      ownerUserId: entry.ownerUserId, domainKey: entry.domainKey as any, entryId: entry.id,
      visitorUserId, source: entry.entrySource, dedup: 'session:' + result.sessionId });
    return { launch: { agentId: result.agentId, dynamicVariables: result.dynamicVariables } };
  },
  requestConnection: async ({ locals, cookies, params, request }) => {
    const visitorUserId = locals.user?.id || await readPilotBrowser(cookies, locals.env);
    if (!visitorUserId) return fail(403, { error: 'Browser session expired.' });
    const entry = await resolvePilotEntry({ entryId: params.entryId, visitorUserId });
    if (!entry || entry.ownerUserId === visitorUserId) return fail(404, { error: 'Invitation unavailable.' });
    const data = await request.formData();
    const name = String(data.get('name') || '').trim().slice(0, 90);
    const email = String(data.get('email') || '').trim().slice(0, 254);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || data.get('consent') !== 'yes')
      return fail(400, { error: 'Enter your name, a valid email and agree to share them with the profile owner.' });
    const preference = await prisma.relishContextPreference.findUnique({ where: {
      ownerUserId_domainKey: { ownerUserId: entry.ownerUserId, domainKey: entry.domainKey }
    } });
    const automaticallyAccepted = preference?.connectionMode !== 'APPROVAL';
    try {
      await prisma.pilotConnectionRequest.create({ data: {
        entryId: entry.id, profileId: entry.profileId,
        ownerUserId: entry.ownerUserId, visitorUserId,
        domainKey: entry.domainKey, nameEnc: encrypt(name, 'pilot.connection.name'),
        emailEnc: encrypt(email, 'pilot.connection.email'), status: automaticallyAccepted ? 'ACCEPTED' : 'REQUESTED'
      } });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      return { connectionRequested: true };
    }
    await recordPilotEvent({ type: 'relationship.connection_requested', env: locals.env,
      profileId: entry.profileId, ownerUserId: entry.ownerUserId,
      domainKey: entry.domainKey as any, entryId: entry.id,
      visitorUserId, source: entry.entrySource, dedup: 'connection:' + entry.id });
    if (automaticallyAccepted) await recordPilotEvent({ type: 'relationship.connection_accepted', env: locals.env,
      profileId: entry.profileId, ownerUserId: entry.ownerUserId, domainKey: entry.domainKey as any,
      entryId: entry.id, visitorUserId, source: entry.entrySource, dedup: 'accepted:' + entry.id });
    return { connectionRequested: true };
  },
  helpful: async ({ locals, cookies, params, request }) => {
    const visitorUserId = locals.user?.id || await readPilotBrowser(cookies, locals.env);
    if (!visitorUserId) return fail(403, { error: 'Browser session expired.' });
    const entry = await resolvePilotEntry({ entryId: params.entryId, visitorUserId });
    if (!entry) return fail(404, { error: 'Invitation unavailable.' });
    const data = await request.formData();
    if (data.get('value') !== 'yes' && data.get('value') !== 'no') return fail(400, { error: 'Invalid response.' });
    await recordPilotEvent({ type: 'value.reported', env: locals.env, profileId: entry.profileId,
      ownerUserId: entry.ownerUserId, domainKey: entry.domainKey as any, entryId: entry.id,
      visitorUserId, source: entry.entrySource, value: data.get('value') === 'yes',
      dedup: 'value:' + entry.id });
    return { feedbackSaved: true };
  }
};
