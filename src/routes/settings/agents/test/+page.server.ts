import { requiredEnv } from '$lib/server/config/requiredEnv';
// PURPOSE: Development-only harness for exercising the ElevenLabs initiation bridge and then
// feeding the exact returned dynamic variables into the ElevenLabs web widget.
// SECURITY: The initiation secret stays server-side. Only owner-scoped active bindings can be used.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { runWithWorkspaceCustody } from '$lib/server/core/contextSpace';

const PROVIDER_AGENT_AAD = 'agentProviderBinding.providerAgentId';
// Development harness identifiers must be explicit. Never insert another person's ID or URL.
const testPersonId = () => requiredEnv('ELEVENLABS_TEST_PERSON_ID').trim();
const testOrigin = () => requiredEnv('ELEVENLABS_TEST_PUBLIC_ORIGIN').trim();

function clean(value: FormDataEntryValue | null, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
    return url.origin;
  } catch {
    throw new Error('ELEVENLABS_TEST_PUBLIC_ORIGIN must be a valid http/https origin.');
  }
}

async function activeBindingsForUser(userId: string) {
  const rows = await prisma.agentProviderBinding.findMany({
    where: { userId, provider: 'ELEVENLABS', isActive: true, providerAgentIdEnc: { not: null } },
    select: {
      id: true,
      contextSpaceId: true,
      environment: true,
      providerAgentIdEnc: true,
      agentDefinition: { select: { key: true, name: true } },
      contextSpace: { select: { domainKey: true } }
    },
    orderBy: [{ environment: 'asc' }, { createdAt: 'desc' }]
  });
  return rows.map(row => ({
    id: row.id,
    contextSpaceId: row.contextSpaceId,
    environment: row.environment,
    agentId: row.providerAgentIdEnc ? decrypt(row.providerAgentIdEnc, PROVIDER_AGENT_AAD) : '',
    agentKey: row.agentDefinition.key,
    agentName: row.agentDefinition.name,
    domainKey: row.contextSpace.domainKey
  }));
}

async function resolveHarnessParticipant(userId: string, contextSpaceId: string, inputId: string) {
  const exactContact = await prisma.contact.findFirst({
    where: { id: inputId, userId, contextSpaceId },
    select: { id: true, personId: true }
  });
  if (exactContact) {
    return {
      status: 'RESOLVED' as const,
      matchedAs: 'CONTACT_ID' as const,
      contactId: exactContact.id,
      personId: exactContact.personId,
      payloadIdentity: { relish_contact_id: exactContact.id }
    };
  }

  const byPerson = await prisma.contact.findMany({
    where: { personId: inputId, userId, contextSpaceId },
    select: { id: true, personId: true },
    take: 3
  });
  if (byPerson.length === 1) {
    return {
      status: 'RESOLVED' as const,
      matchedAs: 'PERSON_ID' as const,
      contactId: byPerson[0].id,
      personId: byPerson[0].personId,
      payloadIdentity: { relish_person_id: inputId }
    };
  }
  if (byPerson.length > 1) {
    return { status: 'AMBIGUOUS' as const, matchedAs: 'PERSON_ID' as const, contactId: null, personId: inputId, payloadIdentity: {} };
  }
  return { status: 'NO_MATCH' as const, matchedAs: null, contactId: null, personId: null, payloadIdentity: {} };
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  return {
    bindings: await activeBindingsForUser(locals.user.id),
    defaultTestPersonId: testPersonId(),
    testPublicOrigin: normalizeOrigin(testOrigin())
  };
};

export const actions: Actions = {
  mockInitiation: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const secret = requiredEnv('ELEVENLABS_INITIATION_SECRET');

    const form = await request.formData();
    const bindingId = clean(form.get('bindingId'), 80);
    const participantId = clean(form.get('personId'), 80) || testPersonId();
    if (!validUuid(participantId)) return fail(400, { error: 'Enter a valid Relish Contact or Person UUID.', personId: participantId, bindingId });

    const binding = await prisma.agentProviderBinding.findFirst({
      where: { id: bindingId, userId: locals.user.id, provider: 'ELEVENLABS', isActive: true },
      select: {
        id: true,
        contextSpaceId: true,
        environment: true,
        providerAgentIdEnc: true,
        agentDefinition: { select: { key: true, name: true } },
        contextSpace: { select: { domainKey: true } }
      }
    });
    if (!binding?.providerAgentIdEnc) return fail(404, { error: 'Choose an active ElevenLabs binding with an agent ID.', personId: participantId, bindingId });

    // SECURITY: This authenticated settings request may currently be in a different same-owner
    // ContextSpace than the selected agent deployment. Enter that exact deployment custody for
    // the participant lookup rather than issuing an explicitly cross-context Prisma query.
    const participantResolution = await runWithWorkspaceCustody(
      { userId: locals.user.id, contextSpaceId: binding.contextSpaceId },
      () => resolveHarnessParticipant(locals.user!.id, binding.contextSpaceId, participantId)
    );
    if (participantResolution.status === 'NO_MATCH') {
      return fail(404, {
        error: 'That UUID did not match a Contact ID or Person ID inside the selected agent ContextSpace.',
        personId: participantId,
        bindingId,
        participantResolution
      });
    }
    if (participantResolution.status === 'AMBIGUOUS') {
      return fail(409, {
        error: 'That Person ID maps to more than one Contact in the selected ContextSpace. Use the Contact ID for this test.',
        personId: participantId,
        bindingId,
        participantResolution
      });
    }

    const agentId = decrypt(binding.providerAgentIdEnc, PROVIDER_AGENT_AAD);
    const publicOrigin = normalizeOrigin(testOrigin());
    const endpoint = `${publicOrigin}/api/webhooks/elevenlabs/initiation`;
    const conversationId = `relish-init-test-${randomUUID()}`;
    const payload = {
      agent_id: agentId,
      conversation_id: conversationId,
      ...participantResolution.payloadIdentity,
      source: 'RELISH_WIDGET_TEST_HARNESS'
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const raw = await response.text();
      let parsed: any = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = { raw }; }

      if (!response.ok) {
        return fail(response.status >= 400 && response.status < 600 ? response.status : 502, {
          error: `Initiation endpoint returned HTTP ${response.status}.`,
          personId: participantId,
          bindingId,
          endpoint,
          participantResolution,
          requestPayload: payload,
          responsePayload: parsed
        });
      }

      const dynamicVariables = parsed?.dynamic_variables && typeof parsed.dynamic_variables === 'object'
        ? parsed.dynamic_variables
        : null;
      if (!dynamicVariables) {
        return fail(502, {
          error: 'Initiation endpoint succeeded but did not return dynamic_variables.',
          personId: participantId,
          bindingId,
          endpoint,
          participantResolution,
          requestPayload: payload,
          responsePayload: parsed
        });
      }

      return {
        success: 'Mock initiation succeeded. The widget below is using the exact dynamic variables returned by Relish.',
        personId: participantId,
        bindingId,
        endpoint,
        conversationId,
        agentId,
        agentName: binding.agentDefinition.name,
        agentKey: binding.agentDefinition.key,
        environment: binding.environment,
        domainKey: binding.contextSpace.domainKey,
        participantResolution,
        requestPayload: payload,
        responsePayload: parsed,
        dynamicVariablesJson: JSON.stringify(dynamicVariables)
      };
    } catch (error: any) {
      return fail(502, {
        error: `Could not reach the public initiation endpoint: ${error?.message || 'unknown error'}`,
        personId: participantId,
        bindingId,
        endpoint,
        participantResolution,
        requestPayload: payload
      });
    }
  }
};
