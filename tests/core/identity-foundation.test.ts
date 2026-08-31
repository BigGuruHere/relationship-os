// tests/core/identity-foundation.test.ts
// PURPOSE: Guard the non-destructive Person bridge and linkedUserId subsumption strategy.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260831123000_stage8_1_identity_agent_access_foundation/migration.sql', 'utf8');

test('Person is an identity-only model with User and Contact back-relations', () => {
  assert.match(schema, /model Person \{[\s\S]*accounts User\[\][\s\S]*contacts Contact\[\][\s\S]*\}/);
  assert.doesNotMatch(schema.match(/model Person \{[\s\S]*?\n\}/)?.[0] ?? '', /email|phone|fullName|profile/i);
});

test('User and Contact both have Person bridges while linkedUserId remains for compatibility', () => {
  assert.match(schema, /model User \{[\s\S]*personId String\? @unique[\s\S]*person\s+Person\?/);
  assert.match(schema, /model Contact \{[\s\S]*personId String\?[\s\S]*person\s+Person\?[\s\S]*linkedUserId String\?/);
});

test('migration preserves existing users and maps linked contacts through User.personId', () => {
  assert.match(migration, /INSERT INTO "Person"[\s\S]*SELECT "id", "createdAt", "updatedAt"[\s\S]*FROM "User"/);
  assert.match(migration, /UPDATE "User"[\s\S]*SET "personId" = "id"/);
  assert.match(migration, /UPDATE "Contact" AS c[\s\S]*SET "personId" = u\."personId"[\s\S]*c\."linkedUserId" = u\."id"/);
  assert.doesNotMatch(migration, /DELETE FROM|DROP TABLE|TRUNCATE/i);
});

test('all current User creation paths create a Person at the same time', () => {
  const files = [
    'src/routes/auth/register/+page.server.ts',
    'src/routes/auth/google/callback/+server.ts',
    'src/routes/api/auth/magic-link/+server.ts',
    'src/routes/api/leads/+server.ts'
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /person:\s*\{\s*create:\s*\{\s*\}\s*\}/, `${file} must create Person with User`);
  }
});

test('account connection and lead-claim paths write personId as well as linkedUserId', () => {
  const connections = readFileSync('src/lib/connections.ts', 'utf8');
  const leadLink = readFileSync('src/lib/leads/link.ts', 'utf8');
  const reciprocal = readFileSync('src/lib/leads/reciprocal.ts', 'utf8');

  assert.match(connections, /linkedUserId:\s*otherUserId,[\s\S]*personId:\s*otherPersonId/);
  assert.match(leadLink, /data:\s*\{\s*linkedUserId:\s*userId,\s*personId\s*\}/);
  assert.match(reciprocal, /linkedUserId:\s*ownerUserId,[\s\S]*personId:\s*ownerPersonId/);
});
