import { error, fail, redirect, type Cookies } from '@sveltejs/kit';
import { encrypt, decrypt } from '$lib/crypto';
import { foundationPage, peopleRouteDomain } from '$lib/server/foundation/peopleRouting';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { readPerson } from '$lib/server/foundation/subjects';
import { fetchElevenLabsConversation } from '$lib/server/integrations/elevenlabs/conversation';
import { speechFromDorianCall, peopleDorianAgent, personNoteInitiation } from '$lib/server/integrations/elevenlabs/peopleWebNote';
import { prisma } from '$lib/db';
import { summarizeText } from '$lib/ai';
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

type Launch = { reference: string; conversationId: string; expiresAt: number };

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

    const { name, ...binding } = scope;
    cookies.set(cookie, encrypt(JSON.stringify({
      ...binding, conversationId: issued.conversationId, reference: issued.reference,
      expiresAt: Date.now() + ttl * 1000
    }), purpose), { path: url.pathname.replace(/\/$/, ''), httpOnly: true, secure: true, sameSite: 'lax', maxAge: ttl });
    return { token: issued.token, reference: issued.reference, initiation: personNoteInitiation(callerName, name) };
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
      return { state: 'ready' as const, text, ...(text ? {} : { callerSpeech: speech.text }) };
    } catch {
      console.warn(JSON.stringify({ component: 'relish.dorian.people_note', stage: 'draft',
        reference: launch.reference, reason: 'conversation_unavailable' }));
      return fail(502, { error: 'Could not retrieve the conversation. Try again.', reference: launch.reference });
    }
  },
  discard: async ({ locals, url, params, request, cookies }) => {
    requireOrigin(request, url);
    const scope = await context(locals, url, params.id);
    const launch = readLaunch(cookies, scope);
    if (launch?.reference !== (await request.formData()).get('reference'))
      throw error(409, 'This conversation expired or was replaced.');
    cookies.delete(cookie, { path: url.pathname.replace(/\/$/, '') });
    throw redirect(303, '/people/' + params.id);
  }
};
