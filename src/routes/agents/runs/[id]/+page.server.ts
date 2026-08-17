// src/routes/agents/runs/[id]/+page.server.ts
// PURPOSE: Detailed run console showing steps, tool calls, model calls, artifacts, approvals, linked entities, and Stage 2 outreach candidates.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { loadAgentArtifacts } from '$lib/server/agents/artifacts';
import { safeDecryptCompany } from '$lib/companies';

function dec(payload: string | null | undefined, aad: string, fallback = '') {
  return safeDecryptCompany(payload, aad, fallback);
}

function usableUrl(value: string) {
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : '';
}


function inferredFactorPolarity(factor: { criterionKey?: string | null; criterionLabel?: string | null; score: number; polarity?: string | null }) {
  const criterion = `${factor.criterionKey || ''} ${factor.criterionLabel || ''}`.toLowerCase();
  const supplied = String(factor.polarity || '').toLowerCase();
  const isRisk = criterion.includes('risk');

  // IT: For risk, higher score means worse risk. For all other factors, higher score means better fit.
  if (isRisk) {
    if (factor.score >= 60) return 'negative';
    if (factor.score >= 40) return 'neutral';
    return 'positive';
  }

  if (factor.score >= 65) return ['positive', 'neutral', 'negative'].includes(supplied) ? supplied : 'positive';
  if (factor.score >= 40) return supplied === 'negative' ? 'negative' : 'neutral';
  return 'negative';
}

function factorScore(factors: Array<{ criterionKey: string; criterionLabel: string; score: number }>, aliases: string[], fallback: number | null | undefined) {
  const lowered = aliases.map((alias) => alias.toLowerCase());
  const match = factors.find((factor) => {
    const key = String(factor.criterionKey || '').toLowerCase();
    const label = String(factor.criterionLabel || '').toLowerCase();
    return lowered.some((alias) => key.includes(alias) || label.includes(alias));
  });
  return match?.score ?? fallback ?? null;
}


async function loadResearchSources(userId: string, agentRunId: string) {
  const rows = await prisma.researchSource.findMany({
    where: { userId, agentRunId },
    select: {
      id: true,
      sourceType: true,
      provider: true,
      confidence: true,
      queryEnc: true,
      titleEnc: true,
      urlEnc: true,
      snippetEnc: true,
      evidenceJson: true,
      researchCandidateId: true,
      companyId: true,
      contactId: true,
      fetchedAt: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' },
    take: 100
  });

  return rows.map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    provider: row.provider,
    confidence: row.confidence,
    query: dec(row.queryEnc, 'research_source.query', ''),
    title: dec(row.titleEnc, 'research_source.title', 'Untitled source'),
    url: dec(row.urlEnc, 'research_source.url', ''),
    snippet: dec(row.snippetEnc, 'research_source.snippet', ''),
    evidenceJson: row.evidenceJson,
    researchCandidateId: row.researchCandidateId,
    companyId: row.companyId,
    contactId: row.contactId,
    fetchedAt: row.fetchedAt,
    createdAt: row.createdAt
  }));
}



async function loadContactEnrichments(userId: string, agentRunId: string) {
  const rows = await prisma.contactEnrichment.findMany({
    where: { userId, agentRunId },
    select: {
      id: true,
      status: true,
      confidence: true,
      contactId: true,
      companyId: true,
      researchCandidateId: true,
      groupKey: true,
      fieldKey: true,
      fieldLabel: true,
      proposedValueEnc: true,
      existingValueEnc: true,
      evidenceType: true,
      sourceKind: true,
      conflictStatus: true,
      isApplyable: true,
      targetNameEnc: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      linkedinEnc: true,
      companyNameEnc: true,
      roleTitleEnc: true,
      websiteEnc: true,
      sourceUrlEnc: true,
      sourceLabelEnc: true,
      evidenceEnc: true,
      notesEnc: true,
      structuredJson: true,
      appliedAt: true,
      appliedEntityType: true,
      appliedEntityId: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'asc' },
    take: 50
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    confidence: row.confidence,
    contactId: row.contactId,
    companyId: row.companyId,
    researchCandidateId: row.researchCandidateId,
    groupKey: row.groupKey,
    fieldKey: row.fieldKey,
    fieldLabel: row.fieldLabel,
    proposedValue: dec(row.proposedValueEnc, 'contact_enrichment.proposed_value', ''),
    existingValue: dec(row.existingValueEnc, 'contact_enrichment.existing_value', ''),
    evidenceType: row.evidenceType,
    sourceKind: row.sourceKind,
    conflictStatus: row.conflictStatus,
    isApplyable: row.isApplyable,
    targetName: dec(row.targetNameEnc, 'contact_enrichment.target_name', ''),
    fullName: dec(row.fullNameEnc, 'contact_enrichment.full_name', ''),
    email: dec(row.emailEnc, 'contact_enrichment.email', ''),
    phone: dec(row.phoneEnc, 'contact_enrichment.phone', ''),
    linkedin: dec(row.linkedinEnc, 'contact_enrichment.linkedin', ''),
    companyName: dec(row.companyNameEnc, 'contact_enrichment.company_name', ''),
    roleTitle: dec(row.roleTitleEnc, 'contact_enrichment.role_title', ''),
    website: dec(row.websiteEnc, 'contact_enrichment.website', ''),
    sourceUrl: usableUrl(dec(row.sourceUrlEnc, 'contact_enrichment.source_url', '')),
    sourceLabel: dec(row.sourceLabelEnc, 'contact_enrichment.source_label', ''),
    evidence: dec(row.evidenceEnc, 'contact_enrichment.evidence', ''),
    notes: dec(row.notesEnc, 'contact_enrichment.notes', ''),
    structuredJson: row.structuredJson,
    appliedAt: row.appliedAt,
    appliedEntityType: row.appliedEntityType,
    appliedEntityId: row.appliedEntityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function loadOpportunityScores(userId: string, agentRunId: string) {
  const rows = await prisma.opportunityScore.findMany({
    where: { userId, agentRunId },
    select: {
      id: true,
      researchCandidateId: true,
      companyId: true,
      contactId: true,
      dealId: true,
      scoreVersion: true,
      scoreLabel: true,
      priority: true,
      recommendedAction: true,
      totalScore: true,
      sectorFitScore: true,
      ownerLedScore: true,
      dealLikelihoodScore: true,
      outreachFitScore: true,
      timingScore: true,
      confidenceScore: true,
      strategicFitScore: true,
      valuePotentialScore: true,
      relationshipPathScore: true,
      evidenceQualityScore: true,
      riskScore: true,
      rationaleJson: true,
      createdAt: true,
      factors: {
        select: { id: true, criterionKey: true, criterionLabel: true, score: true, weight: true, polarity: true, confidence: true, evidenceEnc: true, rationaleEnc: true, sourceUrlEnc: true },
        orderBy: { createdAt: 'asc' },
        take: 25
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  return rows.map((row) => {
    const factors = row.factors.map((factor) => ({
      id: factor.id,
      criterionKey: factor.criterionKey,
      criterionLabel: factor.criterionLabel,
      score: factor.score,
      weight: factor.weight,
      polarity: inferredFactorPolarity(factor),
      confidence: factor.confidence,
      evidence: dec(factor.evidenceEnc, 'opportunity_score_factor.evidence', ''),
      rationale: dec(factor.rationaleEnc, 'opportunity_score_factor.rationale', ''),
      sourceUrl: usableUrl(dec(factor.sourceUrlEnc, 'opportunity_score_factor.source_url', ''))
    }));

    return {
      ...row,
      factors,
      displayScores: {
        sectorFitScore: factorScore(factors, ['sector'], row.sectorFitScore),
        ownerLedScore: factorScore(factors, ['owner', 'principal', 'founder'], row.ownerLedScore),
        dealLikelihoodScore: factorScore(factors, ['deal likelihood', 'deal_likelihood'], row.dealLikelihoodScore),
        outreachFitScore: factorScore(factors, ['outreach'], row.outreachFitScore),
        timingScore: factorScore(factors, ['timing'], row.timingScore),
        evidenceQualityScore: factorScore(factors, ['evidence'], row.evidenceQualityScore ?? row.confidenceScore),
        valuePotentialScore: factorScore(factors, ['value'], row.valuePotentialScore),
        riskScore: factorScore(factors, ['risk'], row.riskScore)
      }
    };
  });
}

async function loadCandidates(userId: string, agentRunId: string) {
  const rows = await prisma.researchCandidate.findMany({
    where: { userId, agentRunId },
    select: {
      id: true,
      entityType: true,
      status: true,
      nameEnc: true,
      websiteEnc: true,
      sourceUrlEnc: true,
      sourceLabelEnc: true,
      confidence: true,
      structuredJson: true,
      notesEnc: true,
      createdEntityType: true,
      createdEntityId: true,
      createdAt: true,
      updatedAt: true,
      opportunityScores: {
        select: {
          id: true,
          scoreVersion: true,
          scoreLabel: true,
          priority: true,
          recommendedAction: true,
          totalScore: true,
          sectorFitScore: true,
          ownerLedScore: true,
          dealLikelihoodScore: true,
          outreachFitScore: true,
          timingScore: true,
          confidenceScore: true,
          strategicFitScore: true,
          valuePotentialScore: true,
          relationshipPathScore: true,
          evidenceQualityScore: true,
          riskScore: true,
          rationaleJson: true,
          createdAt: true,
          factors: {
            select: { id: true, criterionKey: true, criterionLabel: true, score: true, weight: true, polarity: true, confidence: true, evidenceEnc: true, rationaleEnc: true, sourceUrlEnc: true },
            orderBy: { createdAt: 'asc' },
            take: 20
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
  });

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    status: row.status,
    name: dec(row.nameEnc, 'research_candidate.name', 'Untitled candidate'),
    website: dec(row.websiteEnc, 'research_candidate.website', ''),
    sourceUrl: dec(row.sourceUrlEnc, 'research_candidate.source_url', ''),
    sourceLabel: dec(row.sourceLabelEnc, 'research_candidate.source_label', ''),
    confidence: row.confidence,
    notes: dec(row.notesEnc, 'research_candidate.notes', ''),
    structuredJson: row.structuredJson,
    createdEntityType: row.createdEntityType,
    createdEntityId: row.createdEntityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    score: row.opportunityScores[0] ?? null
  }));
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const run = await prisma.agentRun.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      status: true,
      triggerType: true,
      triggerEntityType: true,
      triggerEntityId: true,
      inputJson: true,
      resultJson: true,
      errorMessage: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      agentDefinition: { select: { id: true, key: true, name: true, description: true, category: true, defaultModelProvider: true, defaultModelName: true } },
      promptVersion: { select: { id: true, version: true, createdAt: true } },
      steps: {
        select: { id: true, stepKey: true, stepName: true, status: true, inputJson: true, outputJson: true, errorMessage: true, startedAt: true, completedAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      },
      toolCalls: {
        select: { id: true, toolKey: true, status: true, inputJson: true, outputJson: true, errorMessage: true, createdEntityType: true, createdEntityId: true, startedAt: true, completedAt: true, createdAt: true, agentStepId: true },
        orderBy: { createdAt: 'asc' }
      },
      modelInvocations: {
        select: { id: true, provider: true, model: true, purpose: true, status: true, inputTokens: true, outputTokens: true, requestJsonRedacted: true, responseJsonRedacted: true, structuredOutputJson: true, errorMessage: true, createdAt: true, agentStepId: true },
        orderBy: { createdAt: 'asc' }
      },
      approvals: {
        select: { id: true, actionType: true, status: true, entityType: true, entityId: true, proposedActionJson: true, reviewerNote: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' }
      },
      entities: {
        select: { id: true, entityType: true, entityId: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!run) throw redirect(303, '/agents/runs');

  const [artifacts, candidates, researchSources, opportunityScores, contactEnrichments] = await Promise.all([
    loadAgentArtifacts({ userId, agentRunId: run.id, take: 30 }),
    loadCandidates(userId, run.id),
    loadResearchSources(userId, run.id),
    loadOpportunityScores(userId, run.id),
    loadContactEnrichments(userId, run.id)
  ]);

  return { run, artifacts, candidates, researchSources, opportunityScores, contactEnrichments };
};

function redirectBack(runId: string) {
  throw redirect(303, `/agents/runs/${runId}`);
}


async function getOwnedEnrichment(userId: string, enrichmentId: string, runId: string) {
  return prisma.contactEnrichment.findFirst({ where: { id: enrichmentId, userId, agentRunId: runId } });
}

function decryptEnrichmentValue(payload: string | null | undefined, aad: string) {
  return dec(payload, aad, '').trim();
}

async function getOwnedCandidate(userId: string, candidateId: string, runId: string) {
  return prisma.researchCandidate.findFirst({ where: { id: candidateId, userId, agentRunId: runId } });
}

export const actions: Actions = {
  approveEnrichment: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const enrichmentId = String(form.get('enrichmentId') || '').trim();
    if (!enrichmentId) return fail(400, { error: 'Missing enrichment id.' });
    await prisma.contactEnrichment.updateMany({ where: { id: enrichmentId, userId: locals.user.id, agentRunId: params.id }, data: { status: 'APPROVED' } });
    redirectBack(params.id);
  },

  rejectEnrichment: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const enrichmentId = String(form.get('enrichmentId') || '').trim();
    if (!enrichmentId) return fail(400, { error: 'Missing enrichment id.' });
    await prisma.contactEnrichment.updateMany({ where: { id: enrichmentId, userId: locals.user.id, agentRunId: params.id }, data: { status: 'REJECTED' } });
    redirectBack(params.id);
  },

  applyEnrichment: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const enrichmentId = String(form.get('enrichmentId') || '').trim();
    const overwrite = form.get('overwrite') === 'on';
    if (!enrichmentId) return fail(400, { error: 'Missing enrichment id.' });

    const enrichment = await getOwnedEnrichment(locals.user.id, enrichmentId, params.id);
    if (!enrichment || enrichment.status === 'REJECTED') return fail(404, { error: 'Enrichment not found or rejected.' });
    if (enrichment.isApplyable === false) return fail(400, { error: 'This enrichment is marked as not applyable. Verify manually instead.' });

    const fieldKey = String(enrichment.fieldKey || '').trim();
    const proposedValue = decryptEnrichmentValue(enrichment.proposedValueEnc, 'contact_enrichment.proposed_value');

    // IT: Legacy Stage 5 rows stored a package of values instead of one field. Keep applying those for backwards compatibility.
    if (!fieldKey || !proposedValue) {
      const fullName = decryptEnrichmentValue(enrichment.fullNameEnc || enrichment.targetNameEnc, 'contact_enrichment.full_name') || decryptEnrichmentValue(enrichment.targetNameEnc, 'contact_enrichment.target_name');
      const email = decryptEnrichmentValue(enrichment.emailEnc, 'contact_enrichment.email');
      const phone = decryptEnrichmentValue(enrichment.phoneEnc, 'contact_enrichment.phone');
      const linkedin = decryptEnrichmentValue(enrichment.linkedinEnc, 'contact_enrichment.linkedin');
      const companyName = decryptEnrichmentValue(enrichment.companyNameEnc, 'contact_enrichment.company_name');
      const roleTitle = decryptEnrichmentValue(enrichment.roleTitleEnc, 'contact_enrichment.role_title');

      let contactId = enrichment.contactId;

      if (contactId) {
        const existing = await prisma.contact.findFirst({ where: { id: contactId, userId: locals.user.id }, select: { id: true, emailEnc: true, phoneEnc: true, linkedinEnc: true, companyEnc: true, positionEnc: true } });
        if (!existing) return fail(404, { error: 'Linked contact not found.' });
        const data: any = {};
        if (email && (overwrite || !existing.emailEnc)) { data.emailEnc = encrypt(email, 'contact.email'); data.emailIdx = buildIndexToken(email); }
        if (phone && (overwrite || !existing.phoneEnc)) { data.phoneEnc = encrypt(phone, 'contact.phone'); data.phoneIdx = buildIndexToken(phone); }
        if (linkedin && (overwrite || !existing.linkedinEnc)) { data.linkedinEnc = encrypt(linkedin, 'contact.linkedin'); data.linkedinIdx = buildIndexToken(linkedin); }
        if (companyName && (overwrite || !existing.companyEnc)) { data.companyEnc = encrypt(companyName, 'contact.company'); data.companyIdx = buildIndexToken(companyName); }
        if (roleTitle && (overwrite || !existing.positionEnc)) { data.positionEnc = encrypt(roleTitle, 'contact.position'); data.positionIdx = buildIndexToken(roleTitle); }
        if (Object.keys(data).length) await prisma.contact.update({ where: { id: contactId }, data });
      } else {
        if (!fullName) return fail(400, { error: 'Cannot create a contact without a proposed name.' });
        const contact = await prisma.contact.create({
          data: {
            userId: locals.user.id,
            fullNameEnc: encrypt(fullName, 'contact.full_name'),
            fullNameIdx: buildIndexToken(fullName),
            emailEnc: email ? encrypt(email, 'contact.email') : null,
            emailIdx: email ? buildIndexToken(email) : null,
            phoneEnc: phone ? encrypt(phone, 'contact.phone') : null,
            phoneIdx: phone ? buildIndexToken(phone) : null,
            linkedinEnc: linkedin ? encrypt(linkedin, 'contact.linkedin') : null,
            linkedinIdx: linkedin ? buildIndexToken(linkedin) : null,
            companyEnc: companyName ? encrypt(companyName, 'contact.company') : null,
            companyIdx: companyName ? buildIndexToken(companyName) : null,
            positionEnc: roleTitle ? encrypt(roleTitle, 'contact.position') : null,
            positionIdx: roleTitle ? buildIndexToken(roleTitle) : null
          }
        });
        contactId = contact.id;
      }

      if (enrichment.companyId && contactId) {
        await prisma.companyContact.upsert({
          where: { companyId_contactId: { companyId: enrichment.companyId, contactId } },
          update: roleTitle ? { titleEnc: encrypt(roleTitle, 'company_contact.title') } : {},
          create: { userId: locals.user.id, companyId: enrichment.companyId, contactId, titleEnc: roleTitle ? encrypt(roleTitle, 'company_contact.title') : null, isPrimary: false }
        });
      }

      await prisma.contactEnrichment.update({ where: { id: enrichment.id }, data: { status: 'APPLIED', appliedAt: new Date(), appliedEntityType: 'contact', appliedEntityId: contactId } });
      redirectBack(params.id);
    }

    if (fieldKey.startsWith('company.')) {
      const companyId = enrichment.companyId;
      if (!companyId) return fail(400, { error: 'This company enrichment is not linked to a company.' });
      const existing = await prisma.company.findFirst({ where: { id: companyId, userId: locals.user.id }, select: { id: true, nameEnc: true, websiteEnc: true, industryEnc: true, locationEnc: true, descriptionEnc: true, criteriaEnc: true, notesEnc: true } });
      if (!existing) return fail(404, { error: 'Linked company not found.' });
      const data: any = {};
      if (fieldKey === 'company.name' && (overwrite || !existing.nameEnc)) { data.nameEnc = encrypt(proposedValue, 'company.name'); data.nameIdx = buildIndexToken(proposedValue); }
      if (fieldKey === 'company.website' && (overwrite || !existing.websiteEnc)) { data.websiteEnc = encrypt(proposedValue, 'company.website'); data.websiteIdx = buildIndexToken(proposedValue); }
      if (fieldKey === 'company.industry' && (overwrite || !existing.industryEnc)) data.industryEnc = encrypt(proposedValue, 'company.industry');
      if (fieldKey === 'company.location' && (overwrite || !existing.locationEnc)) data.locationEnc = encrypt(proposedValue, 'company.location');
      if (fieldKey === 'company.description' && (overwrite || !existing.descriptionEnc)) data.descriptionEnc = encrypt(proposedValue, 'company.description');
      if (fieldKey === 'company.criteria' && (overwrite || !existing.criteriaEnc)) data.criteriaEnc = encrypt(proposedValue, 'company.criteria');
      if (fieldKey === 'company.notes' && (overwrite || !existing.notesEnc)) data.notesEnc = encrypt(proposedValue, 'company.notes');
      if (!Object.keys(data).length) {
        await prisma.contactEnrichment.update({ where: { id: enrichment.id }, data: { status: 'NO_CHANGE' } });
        redirectBack(params.id);
      }
      await prisma.company.update({ where: { id: companyId }, data });
      await prisma.contactEnrichment.update({ where: { id: enrichment.id }, data: { status: 'APPLIED', appliedAt: new Date(), appliedEntityType: 'company', appliedEntityId: companyId } });
      redirectBack(params.id);
    }

    if (!fieldKey.startsWith('contact.')) return fail(400, { error: `Unsupported enrichment field: ${fieldKey}` });

    let contactId = enrichment.contactId;
    if (!contactId) {
      const groupRows = enrichment.groupKey
        ? await prisma.contactEnrichment.findMany({ where: { userId: locals.user.id, agentRunId: params.id, groupKey: enrichment.groupKey } })
        : [enrichment];
      const valueFor = (key: string, aad: string) => {
        const row = groupRows.find((item: any) => item.fieldKey === key);
        return row ? decryptEnrichmentValue(row.proposedValueEnc, aad) : '';
      };
      const fullName = valueFor('contact.fullName', 'contact_enrichment.proposed_value') || decryptEnrichmentValue(enrichment.targetNameEnc, 'contact_enrichment.target_name');
      if (!fullName) return fail(400, { error: 'Cannot create a contact without a proposed name.' });
      const email = valueFor('contact.email', 'contact_enrichment.proposed_value');
      const phone = valueFor('contact.phone', 'contact_enrichment.proposed_value');
      const linkedin = valueFor('contact.linkedin', 'contact_enrichment.proposed_value');
      const companyName = valueFor('contact.company', 'contact_enrichment.proposed_value') || decryptEnrichmentValue(enrichment.companyNameEnc, 'contact_enrichment.company_name');
      const roleTitle = valueFor('contact.position', 'contact_enrichment.proposed_value');

      const contact = await prisma.contact.create({
        data: {
          userId: locals.user.id,
          fullNameEnc: encrypt(fullName, 'contact.full_name'),
          fullNameIdx: buildIndexToken(fullName),
          emailEnc: email ? encrypt(email, 'contact.email') : null,
          emailIdx: email ? buildIndexToken(email) : null,
          phoneEnc: phone ? encrypt(phone, 'contact.phone') : null,
          phoneIdx: phone ? buildIndexToken(phone) : null,
          linkedinEnc: linkedin ? encrypt(linkedin, 'contact.linkedin') : null,
          linkedinIdx: linkedin ? buildIndexToken(linkedin) : null,
          companyEnc: companyName ? encrypt(companyName, 'contact.company') : null,
          companyIdx: companyName ? buildIndexToken(companyName) : null,
          positionEnc: roleTitle ? encrypt(roleTitle, 'contact.position') : null,
          positionIdx: roleTitle ? buildIndexToken(roleTitle) : null
        }
      });
      contactId = contact.id;
      if (enrichment.groupKey) await prisma.contactEnrichment.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, groupKey: enrichment.groupKey }, data: { contactId } });
    } else {
      const existing = await prisma.contact.findFirst({ where: { id: contactId, userId: locals.user.id }, select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, linkedinEnc: true, companyEnc: true, positionEnc: true } });
      if (!existing) return fail(404, { error: 'Linked contact not found.' });
      const data: any = {};
      if (fieldKey === 'contact.fullName' && (overwrite || !existing.fullNameEnc)) { data.fullNameEnc = encrypt(proposedValue, 'contact.full_name'); data.fullNameIdx = buildIndexToken(proposedValue); }
      if (fieldKey === 'contact.email' && (overwrite || !existing.emailEnc)) { data.emailEnc = encrypt(proposedValue, 'contact.email'); data.emailIdx = buildIndexToken(proposedValue); }
      if (fieldKey === 'contact.phone' && (overwrite || !existing.phoneEnc)) { data.phoneEnc = encrypt(proposedValue, 'contact.phone'); data.phoneIdx = buildIndexToken(proposedValue); }
      if (fieldKey === 'contact.linkedin' && (overwrite || !existing.linkedinEnc)) { data.linkedinEnc = encrypt(proposedValue, 'contact.linkedin'); data.linkedinIdx = buildIndexToken(proposedValue); }
      if (fieldKey === 'contact.company' && (overwrite || !existing.companyEnc)) { data.companyEnc = encrypt(proposedValue, 'contact.company'); data.companyIdx = buildIndexToken(proposedValue); }
      if (fieldKey === 'contact.position' && (overwrite || !existing.positionEnc)) { data.positionEnc = encrypt(proposedValue, 'contact.position'); data.positionIdx = buildIndexToken(proposedValue); }
      if (Object.keys(data).length) await prisma.contact.update({ where: { id: contactId }, data });
    }

    if (enrichment.companyId && contactId) {
      const roleTitle = fieldKey === 'contact.position' ? proposedValue : '';
      await prisma.companyContact.upsert({
        where: { companyId_contactId: { companyId: enrichment.companyId, contactId } },
        update: roleTitle ? { titleEnc: encrypt(roleTitle, 'company_contact.title') } : {},
        create: { userId: locals.user.id, companyId: enrichment.companyId, contactId, titleEnc: roleTitle ? encrypt(roleTitle, 'company_contact.title') : null, isPrimary: false }
      });
    }

    await prisma.contactEnrichment.update({ where: { id: enrichment.id }, data: { status: 'APPLIED', appliedAt: new Date(), appliedEntityType: 'contact', appliedEntityId: contactId } });
    redirectBack(params.id);
  },
  approveCandidate: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const candidateId = String(form.get('candidateId') || '').trim();
    if (!candidateId) return fail(400, { error: 'Missing candidate id.' });

    await prisma.researchCandidate.updateMany({ where: { id: candidateId, userId: locals.user.id, agentRunId: params.id }, data: { status: 'APPROVED' as any } });
    await prisma.approvalRequest.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, entityType: 'research_candidate', entityId: candidateId, status: 'pending' }, data: { status: 'approved', approvedAt: new Date() } });
    redirectBack(params.id);
  },

  rejectCandidate: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const candidateId = String(form.get('candidateId') || '').trim();
    if (!candidateId) return fail(400, { error: 'Missing candidate id.' });

    await prisma.researchCandidate.updateMany({ where: { id: candidateId, userId: locals.user.id, agentRunId: params.id }, data: { status: 'REJECTED' as any } });
    await prisma.approvalRequest.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, entityType: 'research_candidate', entityId: candidateId, status: 'pending' }, data: { status: 'rejected', rejectedAt: new Date() } });
    redirectBack(params.id);
  },

  importCandidate: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const candidateId = String(form.get('candidateId') || '').trim();
    if (!candidateId) return fail(400, { error: 'Missing candidate id.' });

    const candidate = await getOwnedCandidate(locals.user.id, candidateId, params.id);
    if (!candidate) return fail(404, { error: 'Candidate not found.' });

    const name = dec(candidate.nameEnc, 'research_candidate.name', '').trim();
    const website = dec(candidate.websiteEnc, 'research_candidate.website', '').trim();
    const notes = dec(candidate.notesEnc, 'research_candidate.notes', '').trim();
    if (!name) return fail(400, { error: 'Candidate name is missing.' });

    if (candidate.entityType === 'CONTACT') {
      const existing = await prisma.contact.findFirst({ where: { userId: locals.user.id, fullNameIdx: buildIndexToken(name) }, select: { id: true } });
      const contact = existing ?? await prisma.contact.create({
        data: {
          userId: locals.user.id,
          fullNameEnc: encrypt(name, 'contact.fullName'),
          fullNameIdx: buildIndexToken(name),
          companyEnc: website ? encrypt(website, 'contact.company') : null,
          companyIdx: website ? buildIndexToken(website) : null
        }
      });

      // IT: If this run was launched from an existing company, attach the imported person to that company as an employee/contact.
      const targetCompany = await prisma.agentRunEntity.findFirst({
        where: { agentRunId: params.id, entityType: 'company', role: 'research_target' },
        select: { entityId: true }
      });
      if (targetCompany?.entityId) {
        const structured: any = candidate.structuredJson || {};
        await prisma.companyContact.upsert({
          where: { companyId_contactId: { companyId: targetCompany.entityId, contactId: contact.id } },
          update: {
            titleEnc: structured.roleTitle ? encrypt(String(structured.roleTitle), 'company_contact.title') : undefined,
            notesEnc: notes ? encrypt(notes, 'company_contact.notes') : undefined
          },
          create: {
            userId: locals.user.id,
            companyId: targetCompany.entityId,
            contactId: contact.id,
            titleEnc: structured.roleTitle ? encrypt(String(structured.roleTitle), 'company_contact.title') : null,
            notesEnc: notes ? encrypt(notes, 'company_contact.notes') : null,
            status: 'UNKNOWN' as any
          }
        });
      }

      await prisma.researchCandidate.update({ where: { id: candidate.id }, data: { status: 'IMPORTED' as any, createdEntityType: 'contact', createdEntityId: contact.id } });
      await prisma.agentRunEntity.create({ data: { agentRunId: params.id, entityType: 'contact', entityId: contact.id, role: 'imported_candidate' } });
      await prisma.approvalRequest.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, entityType: 'research_candidate', entityId: candidate.id, status: 'pending' }, data: { status: 'approved', approvedAt: new Date(), reviewerNote: 'Imported as contact.' } });
    } else {
      const existing = await prisma.company.findFirst({ where: { userId: locals.user.id, nameIdx: buildIndexToken(name) }, select: { id: true } });
      const company = existing ?? await prisma.company.create({
        data: {
          userId: locals.user.id,
          nameEnc: encrypt(name, 'company.name'),
          nameIdx: buildIndexToken(name),
          websiteEnc: website ? encrypt(website, 'company.website') : null,
          websiteIdx: website ? buildIndexToken(website) : null,
          descriptionEnc: notes ? encrypt(notes, 'company.description') : null,
          kind: 'OPERATING_BUSINESS' as any,
          status: 'WATCHLIST' as any
        }
      });

      await prisma.researchCandidate.update({ where: { id: candidate.id }, data: { status: 'IMPORTED' as any, createdEntityType: 'company', createdEntityId: company.id } });
      await prisma.agentRunEntity.create({ data: { agentRunId: params.id, entityType: 'company', entityId: company.id, role: 'imported_candidate' } });
      await prisma.approvalRequest.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, entityType: 'research_candidate', entityId: candidate.id, status: 'pending' }, data: { status: 'approved', approvedAt: new Date(), reviewerNote: 'Imported as company.' } });
    }

    redirectBack(params.id);
  },

  createReviewTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const candidateId = String(form.get('candidateId') || '').trim();
    const candidate = await getOwnedCandidate(locals.user.id, candidateId, params.id);
    if (!candidate) return fail(404, { error: 'Candidate not found.' });
    const name = dec(candidate.nameEnc, 'research_candidate.name', 'candidate');

    await prisma.task.create({
      data: {
        userId: locals.user.id,
        titleEnc: encrypt(`Review outreach candidate: ${name}`, 'task.title'),
        notesEnc: encrypt(`Review staged Outreach Agent candidate ${name}. Approve/reject, import if useful, and edit outreach before sending anything.`, 'task.notes'),
        status: 'OPEN' as any,
        urgency: 'HIGH' as any,
        importance: 'HIGH' as any,
        taskType: 'REVIEW' as any,
        sourceType: 'research_candidate',
        sourceId: candidate.id
      }
    });

    redirectBack(params.id);
  }
};
