// src/lib/server/core/interactions.ts
// PURPOSE: Channel-neutral Core Interaction ingestion/read seam.
// SECURITY: Canonical subjects are resolved through the scoped Core repository. Person identity never widens tenant access.

import { prisma } from '$lib/db';
import { encrypt, decrypt } from '$lib/crypto';
import { upsertInteractionEmbedding } from '$lib/embeddings';
import type { CoreAccessContext } from '$lib/server/core/accessPolicy';
import { findAccessibleCorePerson, findCoreCompany, findCoreContact, findCoreInteraction } from '$lib/server/core/relationshipRepository';

export type CreateCoreInteractionInput = {
  contactId?: string | null;
  personId?: string | null;
  companyId?: string | null;
  channel: string;
  rawText: string;
  summary?: string | null;
  occurredAt?: Date | null;
  sourceType?: 'WORKSPACE' | 'AGENT' | 'EMAIL_CONNECTOR' | 'CALENDAR_CONNECTOR' | 'IMPORT' | 'API' | 'SYSTEM' | 'OTHER';
  externalRef?: string | null;
};

function clean(value: string | null | undefined) {
  return String(value || '').trim() || null;
}

export async function createCoreInteraction(context: CoreAccessContext, input: CreateCoreInteractionInput) {
  const contactId = clean(input.contactId);
  const companyId = clean(input.companyId);
  let personId = clean(input.personId);

  let contact: { id: string; personId: string | null } | null = null;
  if (contactId) {
    contact = await findCoreContact(context, contactId, { id: true, personId: true });
    if (!contact) throw new Error('Contact not found in this workspace.');
    if (personId && contact.personId && personId !== contact.personId) {
      throw new Error('Interaction Person does not match the Contact identity bridge.');
    }
    personId = personId || contact.personId || null;
  }

  if (companyId) {
    const company = await findCoreCompany(context, companyId, { id: true });
    if (!company) throw new Error('Company not found in this workspace.');
  }

  if (personId) {
    const person = await findAccessibleCorePerson(context, personId, { id: true });
    if (!person) throw new Error('Person identity is not accessible from this workspace.');
  }

  if (!contactId && !personId && !companyId) {
    throw new Error('An Interaction requires an accessible Contact, Person, or Company subject.');
  }

  const rawText = String(input.rawText || '').trim();
  if (!rawText) throw new Error('Interaction text is required.');
  const channel = String(input.channel || '').trim();
  if (!channel) throw new Error('Interaction channel is required.');
  const summary = String(input.summary || '').trim();

  const created = await prisma.interaction.create({
    data: {
      userId: context.workspaceUserId,
      contactId,
      personId,
      companyId,
      channel,
      sourceType: (input.sourceType || 'WORKSPACE') as any,
      externalRef: clean(input.externalRef),
      occurredAt: input.occurredAt || undefined,
      rawTextEnc: encrypt(rawText, 'interaction.raw_text'),
      summaryEnc: summary ? encrypt(summary, 'interaction.raw_text') : null
    },
    select: { id: true, contactId: true, personId: true, companyId: true, occurredAt: true }
  });

  // IT: Private workspace semantic search only. This vector is sensitive derived data and is not a future network-match embedding.
  try {
    await upsertInteractionEmbedding(context.workspaceUserId, created.id, rawText);
  } catch (err: any) {
    console.warn('[core:interaction] failed to store private interaction embedding', { interactionId: created.id, message: err?.message });
  }

  return created;
}

export async function loadCoreInteraction(context: CoreAccessContext, interactionId: string) {
  const row = await findCoreInteraction(context, interactionId, {
    id: true,
    contactId: true,
    personId: true,
    companyId: true,
    channel: true,
    sourceType: true,
    externalRef: true,
    occurredAt: true,
    rawTextEnc: true,
    summaryEnc: true,
    contact: { select: { id: true, fullNameEnc: true } },
    company: { select: { id: true, nameEnc: true } }
  });
  if (!row) return null;
  let text = '';
  let summary = '';
  try { text = decrypt(row.rawTextEnc, 'interaction.raw_text'); } catch {}
  try { summary = row.summaryEnc ? decrypt(row.summaryEnc, 'interaction.raw_text') : ''; } catch {}
  return { ...row, text, summary };
}
