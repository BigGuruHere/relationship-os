// tests/core/stage8-2-provenance-introductions.test.ts
// PURPOSE: Lock down Stage 8.2 provenance separation and manual Introduction/Outcome foundations.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260831150000_stage8_2_provenance_introductions_outcomes/migration.sql', 'utf8');
const introductions = readFileSync('src/lib/server/introductions.ts', 'utf8');
const wants = readFileSync('src/lib/server/wants.ts', 'utf8');
const offers = readFileSync('src/lib/server/offers.ts', 'utf8');

function modelBlock(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  return match?.[0] || '';
}

test('authority is a separate enum from existing confidence', () => {
  assert.match(schema, /enum KnowledgeAuthority \{[\s\S]*SELF_DECLARED[\s\S]*THIRD_PARTY_REPORTED[\s\S]*PUBLIC_SOURCE[\s\S]*INFERRED[\s\S]*SYSTEM_DERIVED[\s\S]*\}/);
  assert.match(schema, /confidence IntentConfidence/);
  assert.match(modelBlock('Want'), /authority\s+KnowledgeAuthority/);
  assert.match(modelBlock('Offer'), /authority\s+KnowledgeAuthority/);
});

test('existing Want/Offer rows are preserved as legacy authority rather than guessed', () => {
  assert.match(migration, /ADD COLUMN "authority" "KnowledgeAuthority" NOT NULL DEFAULT 'LEGACY_UNSPECIFIED'/);
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE/i);
});

test('Want and Offer provenance can point to source interactions and encrypted source notes', () => {
  for (const model of ['Want', 'Offer']) {
    const block = modelBlock(model);
    assert.match(block, /sourceType\s+KnowledgeSourceType/);
    assert.match(block, /sourceInteractionId String\?/);
    assert.match(block, /sourceNoteEnc\s+String\?/);
    assert.match(block, /confirmedAt\s+DateTime\?/);
  }
  assert.match(wants, /encrypt\(sourceNote, 'want\.source_note'\)/);
  assert.match(offers, /encrypt\(sourceNote, 'offer\.source_note'\)/);
});

test('new manual Want/Offer writes distinguish authority from confidence', () => {
  assert.match(wants, /normaliseKnowledgeAuthority\(form\.get\('authority'\), 'THIRD_PARTY_REPORTED'\)/);
  assert.match(wants, /normaliseKnowledgeSourceType\(form\.get\('sourceType'\), 'MANUAL'\)/);
  assert.match(offers, /normaliseKnowledgeAuthority\(form\.get\('authority'\), 'THIRD_PARTY_REPORTED'\)/);
  assert.match(offers, /normaliseKnowledgeSourceType\(form\.get\('sourceType'\), 'MANUAL'\)/);
});

test('Introduction is first-class and independent of PotentialMatch/ExchangeItem', () => {
  const block = modelBlock('Introduction');
  assert.match(block, /participants IntroductionParticipant\[\]/);
  assert.match(block, /outcomes\s+Outcome\[\]/);
  assert.doesNotMatch(block, /PotentialMatch|ExchangeItem|wantId|offerId/);
});

test('Introduction has exactly one A side and one B side at the database level', () => {
  const block = modelBlock('IntroductionParticipant');
  assert.match(block, /side IntroductionSide/);
  assert.match(block, /@@unique\(\[introductionId, side\]\)/);
  assert.match(migration, /IntroductionParticipant_party_required/);
});

test('manual Introduction creation validates Contact/Company/Interaction ownership before write', () => {
  assert.match(introductions, /validateParty\(userId, partyAContactId, partyACompanyId, 'Party A'\)/);
  assert.match(introductions, /validateParty\(userId, partyBContactId, partyBCompanyId, 'Party B'\)/);
  assert.match(introductions, /where: \{ id: contactId, userId \}/);
  assert.match(introductions, /where: \{ id: companyId, userId \}/);
  assert.match(introductions, /where: \{ id: interactionId, userId \}/);
});

test('Outcome creation first proves the parent Introduction belongs to the current workspace', () => {
  assert.match(introductions, /where: \{ id: introductionId, userId \}/);
  assert.match(modelBlock('Outcome'), /introduction\s+Introduction/);
  assert.match(modelBlock('Outcome'), /authority\s+KnowledgeAuthority/);
  assert.match(modelBlock('Outcome'), /sourceType\s+KnowledgeSourceType/);
});
