// PURPOSE: Import a deliberately selected CSV slice as actionable MarketLeads.
// SECURITY: Every row is scoped to the active owner + ContextSpace. Stable external identifiers
// prevent name-based cross-batch duplicates, and imported research is appended rather than overwritten.

import { prisma } from '$lib/db';
import { buildIndexToken, decrypt, encrypt } from '$lib/crypto';
import { resolveOrCreateTagForTenant } from '$lib/tags';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';
import { marketLeadCreateData, type MarketLeadFormValues } from '$lib/server/marketLeads';
import { buildImportedResearchNote, normaliseExternalScheme, normaliseExternalValue, type LeadImportRow } from '$lib/leadImport';


export type LeadImportOptions = {
  userId: string;
  batchName: string;
  sourceFileName?: string;
  leadSourceId: string;
  externalScheme: string;
  projectId: string | null;
  workstreamId: string | null;
  tags: string[];
  leadType: string;
  leadStatus: string;
  priority: number;
  rows: LeadImportRow[];
};

export type LeadImportResult = {
  batchName: string;
  sourceFileName?: string;
  leadSourceId: string;
  totalRows: number;
  createdCompanies: number;
  matchedCompanies: number;
  createdLeads: number;
  skippedExistingBatchLeads: number;
  researchNotesCreated: number;
  failedRows: Array<{ rowNumber: number; companyName: string; externalCode: string; error: string }>;
};

function parseResearchDate(input: string) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function valuesForImportedLead(options: LeadImportOptions, row: LeadImportRow, companyId: string): MarketLeadFormValues {
  return {
    title: row.companyName,
    type: options.leadType || 'COMPANY',
    status: options.leadStatus || 'NOT_CONTACTED',
    source: 'IMPORTED',
    name: row.personName,
    companyName: row.companyName,
    email: row.email,
    phone: row.phone || row.companyPhone,
    website: row.website,
    linkedin: '',
    roleTitle: row.roleTitle,
    geography: row.geography,
    address: '',
    description: '',
    notes: '',
    sourceUrl: row.sourceUrl,
    sourceChoice: '',
    leadSourceId: options.leadSourceId,
    newLeadSource: '',
    usualCommunicationMethod: row.phone || row.companyPhone ? 'PHONE' : row.email ? 'EMAIL' : '',
    contactAttemptStatus: 'NOT_CONTACTED',
    lastContactedAt: '',
    buyerStatus: 'NOT_ASKED',
    sellerStatus: 'NOT_ASKED',
    confidence: 50,
    priority: options.priority,
    valueMin: '',
    valueMax: '',
    currency: 'AUD',
    nextAction: '',
    nextActionAt: '',
    contactId: '',
    companyId,
    dealId: '',
    projectId: options.projectId || '',
    workstreamId: options.workstreamId || ''
  };
}

async function attachCompanyTags(userId: string, contextSpaceId: string, companyId: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const tag = await resolveOrCreateTagForTenant(userId, tagName, 'user');
    await prisma.companyTag.upsert({
      where: { companyId_tagId: { companyId, tagId: tag.id } },
      update: {},
      create: { userId, contextSpaceId, companyId, tagId: tag.id, assignedBy: 'user' as any }
    });
  }
}

function safeErrorMessage(err: any) {
  const message = String(err?.message || err || 'Unknown import error').trim();
  return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

export async function importSelectedLeadBatch(options: LeadImportOptions): Promise<LeadImportResult> {
  const userId = String(options.userId || '').trim();
  const contextSpaceId = contextSpaceIdForOwner(userId);
  const externalScheme = normaliseExternalScheme(options.externalScheme);
  if (!externalScheme) throw new Error('External identifier scheme is required.');
  if (!options.leadSourceId) throw new Error('Import batch LeadSource is required.');

  const uniqueTags = Array.from(new Set(options.tags.map((tag) => String(tag || '').trim()).filter(Boolean))).slice(0, 12);
  const result: LeadImportResult = {
    batchName: options.batchName,
    leadSourceId: options.leadSourceId,
    totalRows: options.rows.length,
    createdCompanies: 0,
    matchedCompanies: 0,
    createdLeads: 0,
    skippedExistingBatchLeads: 0,
    researchNotesCreated: 0,
    failedRows: []
  };

  for (const row of options.rows) {
    const companyName = String(row.companyName || '').trim();
    const externalValue = normaliseExternalValue(row.externalCode);
    if (!companyName || !externalValue) {
      result.failedRows.push({
        rowNumber: row.rowNumber,
        companyName,
        externalCode: externalValue,
        error: !companyName ? 'Missing company name.' : 'Missing external registration/reference code.'
      });
      continue;
    }

    try {
      const valueIdx = buildIndexToken(externalValue);
      const existingIdentifier = await (prisma as any).companyExternalIdentifier.findFirst({
        where: { userId, contextSpaceId, scheme: externalScheme, valueIdx },
        select: {
          id: true,
          sourceUrlEnc: true,
          companyId: true,
          company: {
            select: { id: true, phoneEnc: true, websiteEnc: true, locationEnc: true, industryEnc: true }
          }
        }
      });

      let companyId = existingIdentifier?.companyId || '';
      let companyForFill = existingIdentifier?.company || null;

      // IT: Companies created before Stage 8.8 do not yet have an external identifier. If there is
      // exactly one exact-name match in this ContextSpace, adopt it and attach the stable id now.
      // Multiple exact-name matches fail closed rather than guessing which Company is canonical.
      if (!companyId) {
        const sameName = await prisma.company.findMany({
          where: { userId, contextSpaceId, nameIdx: buildIndexToken(companyName) },
          select: { id: true, phoneEnc: true, websiteEnc: true, locationEnc: true, industryEnc: true },
          orderBy: { updatedAt: 'desc' },
          take: 2
        });
        if (sameName.length > 1) {
          throw new Error(`Multiple existing Companies match the exact name "${companyName}". Resolve the duplicate before importing this row.`);
        }
        if (sameName.length === 1) {
          companyId = sameName[0].id;
          companyForFill = sameName[0];
          await (prisma as any).companyExternalIdentifier.create({
            data: {
              userId,
              contextSpaceId,
              companyId,
              scheme: externalScheme,
              valueEnc: encrypt(externalValue, 'company_external_identifier.value'),
              valueIdx,
              sourceUrlEnc: row.sourceUrl ? encrypt(row.sourceUrl, 'company_external_identifier.source_url') : null
            }
          });
          result.matchedCompanies += 1;
        }
      }

      if (companyId) {
        if (existingIdentifier) result.matchedCompanies += 1;
        const company = companyForFill;
        const fillData: any = {};
        if (!company?.phoneEnc && row.companyPhone) fillData.phoneEnc = encrypt(row.companyPhone, 'company.phone');
        if (!company?.websiteEnc && row.website) fillData.websiteEnc = encrypt(row.website, 'company.website');
        if (!company?.locationEnc && row.geography) fillData.locationEnc = encrypt(row.geography, 'company.location');
        if (Object.keys(fillData).length > 0) {
          if (fillData.phoneEnc) fillData.phoneIdx = buildIndexToken(row.companyPhone);
          if (fillData.websiteEnc) fillData.websiteIdx = buildIndexToken(row.website);
          await prisma.company.updateMany({ where: { id: companyId, userId, contextSpaceId }, data: fillData });
        }
        if (existingIdentifier && !existingIdentifier.sourceUrlEnc && row.sourceUrl) {
          await (prisma as any).companyExternalIdentifier.updateMany({
            where: { id: existingIdentifier.id, userId, contextSpaceId },
            data: { sourceUrlEnc: encrypt(row.sourceUrl, 'company_external_identifier.source_url') }
          });
        }
      } else {
        const company = await prisma.company.create({
          data: {
            userId,
            contextSpaceId,
            nameEnc: encrypt(companyName, 'company.name'),
            nameIdx: buildIndexToken(companyName),
            websiteEnc: row.website ? encrypt(row.website, 'company.website') : null,
            websiteIdx: row.website ? buildIndexToken(row.website) : null,
            phoneEnc: row.companyPhone ? encrypt(row.companyPhone, 'company.phone') : null,
            phoneIdx: row.companyPhone ? buildIndexToken(row.companyPhone) : null,
            locationEnc: row.geography ? encrypt(row.geography, 'company.location') : null
          },
          select: { id: true }
        });
        companyId = company.id;

        await (prisma as any).companyExternalIdentifier.create({
          data: {
            userId,
            contextSpaceId,
            companyId,
            scheme: externalScheme,
            valueEnc: encrypt(externalValue, 'company_external_identifier.value'),
            valueIdx,
            sourceUrlEnc: row.sourceUrl ? encrypt(row.sourceUrl, 'company_external_identifier.source_url') : null
          }
        });
        result.createdCompanies += 1;
      }

      await attachCompanyTags(userId, contextSpaceId, companyId, uniqueTags);

      // IT: One lead per company per imported batch makes re-running the same CSV idempotent,
      // while a later batch gets a fresh lead and therefore a fresh research/call history.
      const existingBatchLead = await prisma.marketLead.findFirst({
        where: { userId, contextSpaceId, companyId, leadSourceId: options.leadSourceId },
        select: { id: true }
      });
      if (existingBatchLead) {
        result.skippedExistingBatchLeads += 1;
        continue;
      }

      const leadData = marketLeadCreateData(userId, valuesForImportedLead(options, row, companyId)) as any;
      leadData.contextSpaceId = contextSpaceId;
      const lead = await prisma.marketLead.create({ data: leadData, select: { id: true } });
      result.createdLeads += 1;

      const researchNote = buildImportedResearchNote({
        batchName: options.batchName,
        sourceFileName: options.sourceFileName,
        row: { ...row, externalCode: externalValue },
        externalScheme
      });
      if (researchNote) {
        await prisma.marketLeadNote.create({
          data: {
            userId,
            contextSpaceId,
            marketLeadId: lead.id,
            channel: 'research',
            occurredAt: parseResearchDate(row.researchDate) || new Date(),
            bodyEnc: encrypt(researchNote, 'market_lead_note.body')
          }
        });
        result.researchNotesCreated += 1;
      }
    } catch (err: any) {
      result.failedRows.push({ rowNumber: row.rowNumber, companyName, externalCode: externalValue, error: safeErrorMessage(err) });
    }
  }

  return result;
}

export function decryptCompanyExternalIdentifier(payload: string | null | undefined, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, 'company_external_identifier.value');
  } catch {
    return fallback;
  }
}

export function decryptCompanyExternalSourceUrl(payload: string | null | undefined, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, 'company_external_identifier.source_url');
  } catch {
    return fallback;
  }
}
