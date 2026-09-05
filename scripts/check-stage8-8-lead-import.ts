// PURPOSE: Real PostgreSQL verification for Stage 8.8 selected lead batch import.
// SAFETY: Uses random temporary rows/users and removes them in a finally block.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db.ts';
import { buildIndexToken, decrypt, encrypt } from '../src/lib/crypto.ts';
import { importSelectedLeadBatch } from '../src/lib/server/leadImport.ts';
import { runWithWorkspaceCustody } from '../src/lib/server/core/contextSpace.ts';

async function expectRejected(label: string, fn: () => Promise<unknown>, pattern: RegExp) {
  let error: unknown = null;
  try {
    await fn();
  } catch (err) {
    error = err;
  }
  assert.ok(error, `${label} should have been rejected`);
  assert.match(String((error as any)?.message ?? error), pattern, `${label} failed for an unexpected reason`);
}

async function createBatchSource(userId: string, contextSpaceId: string, label: string) {
  return prisma.leadSource.create({
    data: {
      id: randomUUID(),
      userId,
      contextSpaceId,
      nameEnc: encrypt(label, 'lead_source.name'),
      nameIdx: buildIndexToken(label)
    },
    select: { id: true }
  });
}

function importRow(overrides: Record<string, unknown> = {}) {
  return {
    rowNumber: 2,
    companyName: 'Stage 8.8 Training Co',
    externalCode: `RTO-${randomUUID()}`,
    companyPhone: '03 9000 0000',
    website: 'https://stage88.example.test',
    geography: 'Victoria',
    personName: 'Jamie Example',
    roleTitle: 'Director',
    email: 'jamie@example.test',
    phone: '0400 000 000',
    research: 'Stage 8.8 initial imported research.',
    researchProvider: 'Test harness',
    researchDate: '2026-09-04',
    sourceUrl: 'https://training.gov.au/stage88-test',
    ...overrides
  } as any;
}

async function main() {
  const userId = randomUUID();
  const personId = randomUUID();
  const secondContextId = randomUUID();

  try {
    await prisma.person.create({ data: { id: personId } });
    await prisma.user.create({ data: { id: userId, personId } });

    const defaultSpace = await prisma.contextSpace.findUnique({ where: { id: userId }, select: { id: true, ownerUserId: true } });
    assert.equal(defaultSpace?.ownerUserId, userId, 'Temporary user should receive the deterministic default ContextSpace.');

    const row = importRow();
    let canonicalCompanyId = '';

    await runWithWorkspaceCustody({ userId, contextSpaceId: userId }, async () => {
      const batch1 = await createBatchSource(userId, userId, 'Stage 8.8 Batch 1');
      const batch2 = await createBatchSource(userId, userId, 'Stage 8.8 Batch 2');

      // IT: Exercise the real importer. The first batch should create durable Company identity,
      // one active MarketLead and one append-only Research note.
      const first = await importSelectedLeadBatch({
        userId,
        batchName: 'Stage 8.8 Batch 1',
        sourceFileName: 'stage88-batch-1.csv',
        leadSourceId: batch1.id,
        externalScheme: 'ASQA_RTO',
        projectId: null,
        workstreamId: null,
        tags: [],
        leadType: 'COMPANY',
        leadStatus: 'NOT_CONTACTED',
        priority: 3,
        rows: [row]
      });
      assert.equal(first.createdCompanies, 1);
      assert.equal(first.matchedCompanies, 0);
      assert.equal(first.createdLeads, 1);
      assert.equal(first.researchNotesCreated, 1);
      assert.equal(first.failedRows.length, 0);

      const identifier = await (prisma as any).companyExternalIdentifier.findFirst({
        where: { userId, scheme: 'ASQA_RTO', valueIdx: buildIndexToken(row.externalCode) },
        select: { id: true, companyId: true }
      });
      assert.ok(identifier?.companyId, 'Importer should create the stable external Company identifier.');
      canonicalCompanyId = identifier.companyId;

      // IT: Re-running the exact same batch must not create a second lead or research note.
      const repeated = await importSelectedLeadBatch({
        userId,
        batchName: 'Stage 8.8 Batch 1',
        sourceFileName: 'stage88-batch-1.csv',
        leadSourceId: batch1.id,
        externalScheme: 'ASQA_RTO',
        projectId: null,
        workstreamId: null,
        tags: [],
        leadType: 'COMPANY',
        leadStatus: 'NOT_CONTACTED',
        priority: 3,
        rows: [{ ...row, research: 'This duplicate batch research must not be appended.' }]
      });
      assert.equal(repeated.createdCompanies, 0);
      assert.equal(repeated.matchedCompanies, 1);
      assert.equal(repeated.createdLeads, 0);
      assert.equal(repeated.skippedExistingBatchLeads, 1);
      assert.equal(repeated.researchNotesCreated, 0);

      // IT: A later selected batch reuses Company identity but intentionally creates a fresh
      // MarketLead and fresh research evidence for the new call context.
      const later = await importSelectedLeadBatch({
        userId,
        batchName: 'Stage 8.8 Batch 2',
        sourceFileName: 'stage88-batch-2.csv',
        leadSourceId: batch2.id,
        externalScheme: 'ASQA_RTO',
        projectId: null,
        workstreamId: null,
        tags: [],
        leadType: 'COMPANY',
        leadStatus: 'NOT_CONTACTED',
        priority: 4,
        rows: [{ ...row, research: 'Stage 8.8 later-batch research changed.' }]
      });
      assert.equal(later.createdCompanies, 0);
      assert.equal(later.matchedCompanies, 1);
      assert.equal(later.createdLeads, 1);
      assert.equal(later.researchNotesCreated, 1);

      const leads = await prisma.marketLead.findMany({
        where: { userId, companyId: canonicalCompanyId },
        select: { id: true, leadSourceId: true }
      });
      assert.equal(leads.length, 2, 'Same Company should have one lead per selected batch.');
      assert.deepEqual(new Set(leads.map((lead) => lead.leadSourceId)), new Set([batch1.id, batch2.id]));

      const notes = await prisma.marketLeadNote.findMany({
        where: { userId, channel: 'research', marketLead: { companyId: canonicalCompanyId } },
        select: { bodyEnc: true }
      });
      assert.equal(notes.length, 2, 'Only the first and later batch should have Research notes.');
      const noteBodies = notes.map((note) => decrypt(note.bodyEnc, 'market_lead_note.body')).join('\n');
      assert.match(noteBodies, /initial imported research/i);
      assert.match(noteBodies, /later-batch research changed/i);
      assert.doesNotMatch(noteBodies, /duplicate batch research/i);

      await expectRejected(
        'duplicate external identifier in the same Workspace',
        () => (prisma as any).companyExternalIdentifier.create({
          data: {
            userId,
            contextSpaceId: userId,
            companyId: canonicalCompanyId,
            scheme: 'ASQA_RTO',
            valueEnc: encrypt(row.externalCode, 'company_external_identifier.value'),
            valueIdx: buildIndexToken(row.externalCode)
          }
        }),
        /unique constraint|P2002/i
      );

      // IT: Legacy Companies may pre-date external identifiers. Exactly one exact name match may
      // be adopted; multiple exact matches must stop the row rather than guess.
      const legacyName = `Stage 8.8 Legacy ${randomUUID()}`;
      const legacyCompany = await prisma.company.create({
        data: { userId, contextSpaceId: userId, nameEnc: encrypt(legacyName, 'company.name'), nameIdx: buildIndexToken(legacyName) },
        select: { id: true }
      });
      const batch3 = await createBatchSource(userId, userId, 'Stage 8.8 Batch 3');
      const adopted = await importSelectedLeadBatch({
        userId,
        batchName: 'Stage 8.8 Batch 3',
        sourceFileName: 'stage88-batch-3.csv',
        leadSourceId: batch3.id,
        externalScheme: 'ASQA_RTO',
        projectId: null,
        workstreamId: null,
        tags: [],
        leadType: 'COMPANY',
        leadStatus: 'NOT_CONTACTED',
        priority: 3,
        rows: [importRow({ companyName: legacyName, externalCode: `LEGACY-${randomUUID()}`, research: '' })]
      });
      assert.equal(adopted.createdCompanies, 0);
      assert.equal(adopted.matchedCompanies, 1);
      const adoptedIdentifier = await (prisma as any).companyExternalIdentifier.findFirst({
        where: { userId, companyId: legacyCompany.id },
        select: { companyId: true }
      });
      assert.equal(adoptedIdentifier?.companyId, legacyCompany.id, 'Exactly one legacy exact-name Company should receive the new external identifier.');

      const ambiguousName = `Stage 8.8 Ambiguous ${randomUUID()}`;
      for (let index = 0; index < 2; index += 1) {
        await prisma.company.create({
          data: { userId, contextSpaceId: userId, nameEnc: encrypt(ambiguousName, 'company.name'), nameIdx: buildIndexToken(ambiguousName) }
        });
      }
      const batch4 = await createBatchSource(userId, userId, 'Stage 8.8 Batch 4');
      const ambiguous = await importSelectedLeadBatch({
        userId,
        batchName: 'Stage 8.8 Batch 4',
        sourceFileName: 'stage88-batch-4.csv',
        leadSourceId: batch4.id,
        externalScheme: 'ASQA_RTO',
        projectId: null,
        workstreamId: null,
        tags: [],
        leadType: 'COMPANY',
        leadStatus: 'NOT_CONTACTED',
        priority: 3,
        rows: [importRow({ companyName: ambiguousName, externalCode: `AMB-${randomUUID()}` })]
      });
      assert.equal(ambiguous.createdCompanies, 0);
      assert.equal(ambiguous.createdLeads, 0);
      assert.equal(ambiguous.failedRows.length, 1);
      assert.match(ambiguous.failedRows[0].error, /Multiple existing Companies match the exact name/i);
    });

    await prisma.contextSpace.create({ data: { id: secondContextId, ownerUserId: userId, kind: 'OTHER', isDefault: false } });
    const secondContextCompany = randomUUID();
    await runWithWorkspaceCustody({ userId, contextSpaceId: secondContextId }, async () => {
      await prisma.company.create({
        data: { id: secondContextCompany, userId, contextSpaceId: secondContextId, nameEnc: 'company-b', nameIdx: `stage88-${secondContextCompany}` }
      });
    });

    await runWithWorkspaceCustody({ userId, contextSpaceId: userId }, async () => {
      await expectRejected(
        'cross-context external identifier Company reference',
        () => (prisma as any).companyExternalIdentifier.create({
          data: {
            userId,
            contextSpaceId: userId,
            companyId: secondContextCompany,
            scheme: 'ASQA_RTO',
            valueEnc: encrypt(`bad-${randomUUID()}`, 'company_external_identifier.value'),
            valueIdx: buildIndexToken(`bad-${randomUUID()}`)
          }
        }),
        /cross-context reference blocked/i
      );
    });

    console.log('PASS: First selected batch creates Company identity, MarketLead and Research note.');
    console.log('PASS: Same-batch re-import is idempotent; a later batch reuses Company and appends fresh lead research.');
    console.log('PASS: One legacy exact-name Company may be adopted; ambiguous name matches fail closed.');
    console.log('PASS: External identifier uniqueness and ContextSpace reference guards are enforced.');
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.person.deleteMany({ where: { id: personId } }).catch(() => undefined);
  }

  assert.equal(await prisma.user.count({ where: { id: userId } }), 0, 'Stage 8.8 temporary user was not removed.');
  console.log('PASS: Stage 8.8 temporary verification rows were removed.');
}

main()
  .catch((error) => {
    console.error('FAIL: Stage 8.8 lead import verification failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
