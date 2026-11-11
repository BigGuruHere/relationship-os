import { error, fail, redirect, type Cookies } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { buildScopedMacToken, encrypt, decrypt } from '$lib/crypto';
import { foundationPage, peopleRouteDomain } from '$lib/server/foundation/peopleRouting';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { readPerson } from '$lib/server/foundation/subjects';
import { fetchElevenLabsConversation } from '$lib/server/integrations/elevenlabs/conversation';
import { capturedPeopleConversation, speechFromDorianCall, peopleDorianAgent, personNoteInitiation } from '$lib/server/integrations/elevenlabs/peopleWebNote';
import { prisma } from '$lib/db';
import { privateDraftModel, summarizeText } from '$lib/ai';
import { conversationSummary, savePersonConversation, savedConversationReceipt } from '$lib/server/foundation/conversations';
import { FoundationConflict } from '$lib/server/foundation/evidenceRecords';
import { resolveDraftProcessing } from '$lib/server/foundation/drafts';
import { issueDorianWebToken } from '$lib/server/integrations/elevenlabs/webToken';
import type { Actions, PageServerLoad } from './$types';

const cookie = 'relish_dorian_note';
const purpose = 'dorian-people-note:v1';
const ttl = 3600;

async function context(locals: App.Locals, url: URL, personId: string) {
  const agentId = peopleDorianAgent(locals, url);
  if (!agentId || !locals.user || !locals.sessionId ||
      await peopleRouteDomain(locals.user.id, url.pathname) !== 'FOUNDATION')
    throw error(404, 'Dorian is unavailable.');
  const { access, person } = await foundationPage(async () => {
    const access = await resolveFoundationAccess(locals, 'READ');
    return { access, person: await readPerson(access, personId) };
  });
  return { agentId, sessionId: locals.sessionId, vaultId: access.vaultId, epoch: access.epoch,
    personId: person.id, name: person.name };
}

type Launch = { reference: string; conversationId: string; expiresAt: number; draft?: { mac: string; invocationId: string; model: string } };

function readLaunch(cookies: Cookies, scope: Awaited<ReturnType<typeof context>>): Launch | null {
  try {
    const raw = cookies.get(cookie);
    if (!raw) return null;
    const { name, ...binding } = scope;
    // These authenticated cookie fields bind a launch to this account session, person and vault epoch.
    const launch = JSON.parse(decrypt(raw, purpose));
    if (Object.entries(binding).some(([key, value]) => launch[key] !== value) ||
        !Number.isFinite(launch.expiresAt) || launch.expiresAt <= Date.now()) return null;
    return launch;
  } catch {
    return null;
  }
}

function writeLaunch(cookies: Cookies, url: URL, scope: Awaited<ReturnType<typeof context>>, launch: Launch) {
  const { name, ...binding } = scope;
  cookies.set(cookie, encrypt(JSON.stringify({ ...binding, ...launch }), purpose), {
    path: url.pathname.replace(/\/$/, ''), httpOnly: true, secure: true, sameSite: 'lax',
    maxAge: Math.max(1, Math.ceil((launch.expiresAt - Date.now()) / 1000))
  });
}
function summaryMac(reference: string, summary: string) {
  return buildScopedMacToken(summary, 'dorian-people-note-summary:' + reference);
}

async function accountDisplayName(userId: string) {
  // Account-owned default profile, independent of public profile publication.
  const profile = await prisma.profile.findFirst({
    where: { userId, isDefault: true }, select: { displayName: true }, orderBy: { id: 'asc' }
  });
  const name = profile?.displayName?.replace(/\s+/g, ' ').trim().slice(0, 120);
  return name && name !== 'New Relish user' ? name : '';
}

function requireOrigin(request: Request, url: URL) {
  if (request.headers.get('origin') !== url.origin) throw error(403, 'Submit from the Dorian page.');
}

export const load: PageServerLoad = async ({ locals, url, params, cookies, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const scope = await context(locals, url, params.id);
  return { name: scope.name, personId: scope.personId, reference: readLaunch(cookies, scope)?.reference };
};

export const actions: Actions = {
  start: async ({ locals, url, params, request, fetch, cookies, setHeaders }) => {
    requireOrigin(request, url);
    setHeaders({ 'cache-control': 'private, no-store' });
    const scope = await context(locals, url, params.id);
    const callerName = await accountDisplayName(locals.user!.id);
    const issued = await issueDorianWebToken(scope.agentId, fetch);
    if (!('token' in issued)) return issued;
    if (!issued.conversationId || !/^conv_[a-z0-9_-]{1,235}$/i.test(issued.conversationId))
      return fail(502, { error: 'Dorian did not return a conversation ID.', reference: issued.reference });

    writeLaunch(cookies, url, scope, {
      conversationId: issued.conversationId, reference: issued.reference,
      expiresAt: Date.now() + ttl * 1000
    });
    return { token: issued.token, reference: issued.reference, initiation: personNoteInitiation(callerName, scope.name) };
  },
  draft: async ({ locals, url, params, request, fetch, cookies, setHeaders }) => {
    requireOrigin(request, url);
    setHeaders({ 'cache-control': 'private, no-store' });
    const scope = await context(locals, url, params.id);
    const launch = readLaunch(cookies, scope);
    if (!launch || (await request.formData()).get('reference') !== launch.reference)
      return fail(409, { error: 'This conversation expired or was replaced. Start a new conversation.' });
    try {
      const result = await fetchElevenLabsConversation(launch.conversationId, undefined, fetch, AbortSignal.timeout(8000));
      const speech = speechFromDorianCall(result, launch.conversationId, scope.agentId);
      if (speech.state !== 'ready') return speech;
      // Recheck the subject and draft-processing authority before sending speech for summarisation.
      const current = await context(locals, url, params.id);
      if (readLaunch(cookies, current)?.reference !== launch.reference)
        return fail(409, { error: 'This conversation is no longer available.' });
      const callerName = await accountDisplayName(locals.user!.id);
      const processing = await resolveDraftProcessing(locals);
      await processing.authorize();
      let text = '';
      try {
        const result = await summarizeText(JSON.stringify({
          callerName, personName: current.name, callerSpeech: speech.text
        }), { purpose: 'person-note', request: fetch, signal: AbortSignal.timeout(12000) });
        text = result.summary.trim();
      } catch {
        // A provider failure leaves the user in control of the note text.
        console.warn(JSON.stringify({ component: 'relish.dorian.people_note', stage: 'summary',
          reference: launch.reference, reason: 'summary_unavailable' }));
      }
      await processing.authorize();
      if (readLaunch(cookies, await context(locals, url, params.id))?.reference !== launch.reference)
        return fail(409, { error: 'This conversation is no longer available.' });
      if (text) writeLaunch(cookies, url, current, {
        ...launch, draft: { mac: summaryMac(launch.reference, text), invocationId: randomUUID(), model: privateDraftModel }
      });
      return { state: 'ready' as const, text, ...(text ? {} : { callerSpeech: speech.text }) };
    } catch {
      console.warn(JSON.stringify({ component: 'relish.dorian.people_note', stage: 'draft',
        reference: launch.reference, reason: 'conversation_unavailable' }));
      return fail(502, { error: 'Could not retrieve the conversation. Try again.', reference: launch.reference });
    }
  },
  save: async ({ locals, url, params, request, fetch, cookies, setHeaders }) => {
    requireOrigin(request, url);
    setHeaders({ 'cache-control': 'private, no-store' });
    const scope = await context(locals, url, params.id);
    const launch = readLaunch(cookies, scope);
    const fields = await request.formData();
    if (!launch || fields.get('reference') !== launch.reference)
      return fail(409, { error: 'This conversation expired or was replaced.' });
    const input = conversationSummary.safeParse(fields.get('summary'));
    if (!input.success) return fail(400, { error: 'Enter a summary of up to 20,000 characters.' });
    const summary = input.data;
    const binding = { provider: 'ELEVENLABS' as const, conversationId: launch.conversationId, agentId: scope.agentId };
    let saved: { sourceId: string } | null;
    try {
      const access = await resolveFoundationAccess(locals, 'SAVE_CONVERSATION');
      saved = await savedConversationReceipt(access, params.id, binding, summary);
      if (!saved) {
        const result = await fetchElevenLabsConversation(launch.conversationId, undefined, fetch, AbortSignal.timeout(8000));
        const capture = capturedPeopleConversation(result, launch.conversationId, scope.agentId);
        if (readLaunch(cookies, await context(locals, url, params.id))?.reference !== launch.reference)
          return fail(409, { error: 'This conversation is no longer available.' });
        saved = await savePersonConversation(access, params.id, capture, summary, launch.draft ? {
          kind: launch.draft.mac === summaryMac(launch.reference, summary) ? 'MODEL_DRAFTED' : 'HUMAN_EDITED_MODEL_DRAFT',
          model: launch.draft.model, invocationId: launch.draft.invocationId
        } : { kind: 'HUMAN_AUTHORED' });
      }
    } catch (e) {
      if (e instanceof FoundationConflict)
        return fail(409, { error: 'This conversation is already saved. You can edit its summary in My People.' });
      return fail(502, { error: 'Could not save the conversation. Your summary is still here. Try again.' });
    }
    throw redirect(303, '/people/' + encodeURIComponent(params.id) + '?conversation=' + encodeURIComponent(saved.sourceId));
  },
  discard: async ({ locals, url, params, request, cookies }) => {
    requireOrigin(request, url);
    const scope = await context(locals, url, params.id);
    const launch = readLaunch(cookies, scope);
    if (!launch || launch.reference !== (await request.formData()).get('reference'))
      throw error(409, 'This conversation expired or was replaced.');
    cookies.delete(cookie, { path: url.pathname.replace(/\/$/, '') });
    throw redirect(303, '/people/' + params.id);
  }
};
