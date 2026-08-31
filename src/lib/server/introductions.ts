// src/lib/server/introductions.ts
// PURPOSE: Tenant-scoped manual Introduction/Outcome capture for Stage 8.2.
// SECURITY: All relationship references are verified against the current Relish workspace before writes.
// DATA: Narrative fields are encrypted at rest. No cross-workspace visibility or matching is enabled here.

import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { commercialValueInputError, parseMoneyToCents, formatDealValue, safeDecrypt } from '$lib/deals';
import { contactDisplayName } from '$lib/server/contactDisplay';
import {
  introductionStatusLabel,
  normaliseIntroductionStatus,
  normaliseOutcomeCommerciality,
  normaliseOutcomeStatus,
  outcomeCommercialityLabel,
  outcomeStatusLabel,
  parseOptionalBoolean
} from '$lib/introductions';
import {
  knowledgeAuthorityLabel,
  knowledgeSourceTypeLabel,
  normaliseKnowledgeAuthority,
  normaliseKnowledgeSourceType
} from '$lib/provenance';

function safeDecryptIntro(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
}

function parseDateTime(value: FormDataEntryValue | null, fallback = new Date()): Date {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

async function assertOwnedContact(userId: string, contactId: string | null) {
  if (!contactId) return;
  const row = await prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } });
  if (!row) throw new Error('Contact is not available in this workspace.');
}

async function assertOwnedCompany(userId: string, companyId: string | null) {
  if (!companyId) return;
  const row = await prisma.company.findFirst({ where: { id: companyId, userId }, select: { id: true } });
  if (!row) throw new Error('Company is not available in this workspace.');
}

async function assertOwnedInteraction(userId: string, interactionId: string | null) {
  if (!interactionId) return;
  const row = await prisma.interaction.findFirst({ where: { id: interactionId, userId }, select: { id: true } });
  if (!row) throw new Error('Source interaction is not available in this workspace.');
}

async function validateParty(userId: string, contactId: string | null, companyId: string | null, label: string) {
  if (!contactId && !companyId) throw new Error(`${label} needs a Contact, Company, or both.`);
  await Promise.all([assertOwnedContact(userId, contactId), assertOwnedCompany(userId, companyId)]);
}

export async function createIntroductionFromForm(userId: string, form: FormData) {
  const partyAContactId = String(form.get('partyAContactId') || '').trim() || null;
  const partyACompanyId = String(form.get('partyACompanyId') || '').trim() || null;
  const partyBContactId = String(form.get('partyBContactId') || '').trim() || null;
  const partyBCompanyId = String(form.get('partyBCompanyId') || '').trim() || null;
  const facilitatorContactId = String(form.get('facilitatorContactId') || '').trim() || null;
  const sourceInteractionId = String(form.get('sourceInteractionId') || '').trim() || null;

  await Promise.all([
    validateParty(userId, partyAContactId, partyACompanyId, 'Party A'),
    validateParty(userId, partyBContactId, partyBCompanyId, 'Party B'),
    assertOwnedContact(userId, facilitatorContactId),
    assertOwnedInteraction(userId, sourceInteractionId)
  ]);

  if (
    partyAContactId === partyBContactId &&
    partyACompanyId === partyBCompanyId &&
    (partyAContactId || partyACompanyId)
  ) {
    throw new Error('Party A and Party B cannot be the same record combination.');
  }

  const reason = String(form.get('reason') || '').trim();
  if (!reason) throw new Error('Introduction reason/context is required.');

  const notes = String(form.get('notes') || '').trim();
  const evidence = String(form.get('evidence') || '').trim();
  const partyARole = String(form.get('partyARole') || '').trim();
  const partyBRole = String(form.get('partyBRole') || '').trim();
  const status = normaliseIntroductionStatus(form.get('status'));
  const authority = normaliseKnowledgeAuthority(form.get('authority'), 'WORKSPACE_RECORDED');
  const sourceType = normaliseKnowledgeSourceType(form.get('sourceType'), 'MANUAL');
  const occurredAt = parseDateTime(form.get('occurredAt'));

  return prisma.$transaction(async (tx) => {
    const introduction = await tx.introduction.create({
      data: {
        userId,
        status: status as any,
        occurredAt,
        reasonEnc: encrypt(reason, 'introduction.reason'),
        notesEnc: notes ? encrypt(notes, 'introduction.notes') : null,
        evidenceEnc: evidence ? encrypt(evidence, 'introduction.evidence') : null,
        authority: authority as any,
        sourceType: sourceType as any,
        sourceInteractionId,
        facilitatorContactId
      },
      select: { id: true }
    });

    await tx.introductionParticipant.create({
      data: {
        userId,
        introductionId: introduction.id,
        side: 'A' as any,
        contactId: partyAContactId,
        companyId: partyACompanyId,
        roleEnc: partyARole ? encrypt(partyARole, 'introduction_participant.role') : null
      }
    });

    await tx.introductionParticipant.create({
      data: {
        userId,
        introductionId: introduction.id,
        side: 'B' as any,
        contactId: partyBContactId,
        companyId: partyBCompanyId,
        roleEnc: partyBRole ? encrypt(partyBRole, 'introduction_participant.role') : null
      }
    });

    return introduction;
  });
}

export async function updateIntroductionStatusFromForm(userId: string, introductionId: string, form: FormData) {
  const status = normaliseIntroductionStatus(form.get('status'));
  const result = await prisma.introduction.updateMany({
    where: { id: introductionId, userId },
    data: { status: status as any }
  });
  if (result.count !== 1) throw new Error('Introduction not found.');
}

export async function createOutcomeFromForm(userId: string, introductionId: string, form: FormData) {
  const introduction = await prisma.introduction.findFirst({
    where: { id: introductionId, userId },
    select: { id: true }
  });
  if (!introduction) throw new Error('Introduction not found.');

  const sourceInteractionId = String(form.get('sourceInteractionId') || '').trim() || null;
  await assertOwnedInteraction(userId, sourceInteractionId);

  const valueRaw = String(form.get('value') || '').trim();
  const valueError = commercialValueInputError(valueRaw);
  if (valueError) throw new Error(`Outcome value: ${valueError}`);

  const resultText = String(form.get('result') || '').trim();
  const notes = String(form.get('notes') || '').trim();
  const evidence = String(form.get('evidence') || '').trim();
  const currency = String(form.get('currency') || 'AUD').trim().toUpperCase() || 'AUD';
  const authority = normaliseKnowledgeAuthority(form.get('authority'), 'WORKSPACE_RECORDED');
  const sourceType = normaliseKnowledgeSourceType(form.get('sourceType'), 'MANUAL');

  return prisma.outcome.create({
    data: {
      userId,
      introductionId,
      status: normaliseOutcomeStatus(form.get('status')) as any,
      commerciality: normaliseOutcomeCommerciality(form.get('commerciality')) as any,
      useful: parseOptionalBoolean(form.get('useful')),
      continued: parseOptionalBoolean(form.get('continued')),
      valueCents: parseMoneyToCents(valueRaw),
      currency,
      resultEnc: resultText ? encrypt(resultText, 'outcome.result') : null,
      notesEnc: notes ? encrypt(notes, 'outcome.notes') : null,
      evidenceEnc: evidence ? encrypt(evidence, 'outcome.evidence') : null,
      authority: authority as any,
      sourceType: sourceType as any,
      sourceInteractionId,
      occurredAt: parseDateTime(form.get('occurredAt'))
    },
    select: { id: true }
  });
}

const introductionSelect = {
  id: true,
  status: true,
  occurredAt: true,
  reasonEnc: true,
  notesEnc: true,
  evidenceEnc: true,
  authority: true,
  sourceType: true,
  sourceInteractionId: true,
  facilitatorContactId: true,
  createdAt: true,
  updatedAt: true,
  facilitatorContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
  sourceInteraction: {
    select: {
      id: true,
      occurredAt: true,
      channel: true,
      summaryEnc: true,
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
    }
  },
  participants: {
    select: {
      id: true,
      side: true,
      contactId: true,
      companyId: true,
      roleEnc: true,
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      company: { select: { id: true, nameEnc: true } }
    },
    orderBy: { side: 'asc' as const }
  },
  outcomes: {
    select: {
      id: true,
      status: true,
      commerciality: true,
      useful: true,
      continued: true,
      valueCents: true,
      currency: true,
      resultEnc: true,
      notesEnc: true,
      evidenceEnc: true,
      authority: true,
      sourceType: true,
      sourceInteractionId: true,
      occurredAt: true,
      createdAt: true,
      sourceInteraction: {
        select: {
          id: true,
          occurredAt: true,
          channel: true,
          summaryEnc: true,
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
        }
      }
    },
    orderBy: { occurredAt: 'desc' as const }
  }
} as const;

async function mapInteraction(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    occurredAt: row.occurredAt,
    channel: row.channel,
    summary: safeDecryptIntro(row.summaryEnc, 'interaction.summary', '') || safeDecryptIntro(row.summaryEnc, 'interaction.raw_text', ''),
    contact: row.contact ? { id: row.contact.id, name: await contactDisplayName(row.contact) } : null
  };
}

async function mapIntroduction(row: any) {
  const participants = await Promise.all((row.participants || []).map(async (p: any) => ({
    id: p.id,
    side: p.side,
    contactId: p.contactId,
    companyId: p.companyId,
    role: safeDecryptIntro(p.roleEnc, 'introduction_participant.role', ''),
    contact: p.contact ? { id: p.contact.id, name: await contactDisplayName(p.contact) } : null,
    company: p.company ? { id: p.company.id, name: safeDecrypt(p.company.nameEnc, 'company.name', 'Untitled company') } : null
  })));

  const outcomes = await Promise.all((row.outcomes || []).map(async (o: any) => ({
    id: o.id,
    status: o.status,
    statusLabel: outcomeStatusLabel(o.status),
    commerciality: o.commerciality,
    commercialityLabel: outcomeCommercialityLabel(o.commerciality),
    useful: o.useful,
    continued: o.continued,
    valueCents: o.valueCents === null || o.valueCents === undefined ? null : o.valueCents.toString(),
    valueLabel: o.valueCents === null || o.valueCents === undefined ? '' : formatDealValue(o.valueCents, o.currency || 'AUD'),
    currency: o.currency,
    result: safeDecryptIntro(o.resultEnc, 'outcome.result', ''),
    notes: safeDecryptIntro(o.notesEnc, 'outcome.notes', ''),
    evidence: safeDecryptIntro(o.evidenceEnc, 'outcome.evidence', ''),
    authority: o.authority,
    authorityLabel: knowledgeAuthorityLabel(o.authority),
    sourceType: o.sourceType,
    sourceTypeLabel: knowledgeSourceTypeLabel(o.sourceType),
    occurredAt: o.occurredAt,
    createdAt: o.createdAt,
    sourceInteraction: await mapInteraction(o.sourceInteraction)
  })));

  const partyA = participants.find((p: any) => p.side === 'A') || null;
  const partyB = participants.find((p: any) => p.side === 'B') || null;

  return {
    id: row.id,
    status: row.status,
    statusLabel: introductionStatusLabel(row.status),
    occurredAt: row.occurredAt,
    reason: safeDecryptIntro(row.reasonEnc, 'introduction.reason', ''),
    notes: safeDecryptIntro(row.notesEnc, 'introduction.notes', ''),
    evidence: safeDecryptIntro(row.evidenceEnc, 'introduction.evidence', ''),
    authority: row.authority,
    authorityLabel: knowledgeAuthorityLabel(row.authority),
    sourceType: row.sourceType,
    sourceTypeLabel: knowledgeSourceTypeLabel(row.sourceType),
    sourceInteractionId: row.sourceInteractionId,
    facilitatorContactId: row.facilitatorContactId,
    facilitatorContact: row.facilitatorContact ? { id: row.facilitatorContact.id, name: await contactDisplayName(row.facilitatorContact) } : null,
    sourceInteraction: await mapInteraction(row.sourceInteraction),
    participants,
    partyA,
    partyB,
    outcomes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function loadIntroductions(userId: string, take = 200) {
  const rows = await prisma.introduction.findMany({
    where: { userId },
    select: introductionSelect,
    orderBy: [{ occurredAt: 'desc' }, { updatedAt: 'desc' }],
    take
  });
  return Promise.all(rows.map(mapIntroduction));
}

export async function loadIntroduction(userId: string, introductionId: string) {
  const row = await prisma.introduction.findFirst({
    where: { id: introductionId, userId },
    select: introductionSelect
  });
  return row ? mapIntroduction(row) : null;
}
