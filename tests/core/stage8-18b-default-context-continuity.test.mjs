// Stage 8.18b: exercise real context-selection functions using a mocked Prisma boundary.
// The tests never connect to Neon or use customer phone numbers or private content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const src = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

function service({ defaultId = null, invited = null, legacyCount = 0, ownerFor = null } = {}) {
  const caller = { id: 'phone1', userId: 'user1', contextSpaceId: 'space-general', contactId: 'self-general' };
  const data = { defaultContextSpaceId: defaultId };
  const contexts = {
    'space-general': { id: 'space-general', ownerUserId: 'user1', domainKey: 'general' },
    'space-business': { id: 'space-business', ownerUserId: 'user1', domainKey: 'business' },
    'space-dating': { id: 'space-dating', ownerUserId: 'user1', domainKey: 'dating' },
    'space-other': { id: 'space-other', ownerUserId: 'other-user', domainKey: 'business' }
  };
  const contacts = {
    'space-general': { id: 'self-general', personId: 'person1' },
    'space-business': { id: 'self-business', personId: 'person1' },
    'space-dating': { id: 'self-dating', personId: 'person1' }
  };
  const prisma = {
    user: {
      findUnique: async () => ({ personId: 'person1', ...data }),
      updateMany: async ({ where, data: patch }) => {
        if (where.defaultContextSpaceId === null && data.defaultContextSpaceId === null) {
          data.defaultContextSpaceId = patch.defaultContextSpaceId;
          return { count: 1 };
        }
        return { count: 0 };
      },
      update: async ({ data: patch }) => { data.defaultContextSpaceId = patch.defaultContextSpaceId; }
    },
    contextSpace: { findFirst: async ({ where }) => {
      const c = contexts[where.id];
      return c?.ownerUserId === where.ownerUserId && (!where.domainKey || where.domainKey === c.domainKey) ? c : null;
    } },
    contact: { findMany: async ({ where }) => contacts[where.contextSpaceId] ? [contacts[where.contextSpaceId]] : [] },
    interaction: { count: async () => legacyCount },
    networkDorianSession: { findFirst: async () => invited ? {
      contextSpaceId: invited, pilotEntryId: 'entry1'
    } : null },
    pilotProfileEntry: { findFirst: async () => invited ? { domainKey: contexts[invited].domainKey } : null }
  };
  const code = ts.transpileModule(src('src/lib/server/integrations/elevenlabs/phoneDefaultContext.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  // The test executes the real helper, substituting only its Prisma and self-contact dependencies.
  const injectedRequire = (id) => {
    if (id === '$lib/db') return { prisma };
    if (id === '$lib/server/core/conversationIngestion') return { PERSON_CONVERSATION_SOURCE_CHANNEL: 'PERSON_CONVERSATION_SOURCE' };
    if (id === '$lib/server/pilot') return { ensurePilotSelfContact: async () => { throw new Error('Unexpected self-contact creation'); } };
    throw new Error(`Unexpected dependency: ${id}`);
  };
  new Function('require', 'module', 'exports', code)(injectedRequire, mod, mod.exports);
  return { ...mod.exports, caller, data };
}

test('first previously completed QR business call becomes the direct-phone default', async () => {
  const s = service({ invited: 'space-business' });
  const result = await s.resolvePhoneDefaultContext(s.caller);
  assert.equal(result.contextSpaceId, 'space-business');
  assert.equal(result.contactId, 'self-business');
  assert.equal(result.domainKey, 'business');
  assert.equal(s.data.defaultContextSpaceId, 'space-business');
});

test('existing standalone General conversation history is not silently replaced', async () => {
  const s = service({ invited: 'space-business', legacyCount: 2 });
  const result = await s.resolvePhoneDefaultContext(s.caller);
  assert.equal(result.contextSpaceId, 'space-general');
  assert.equal(s.data.defaultContextSpaceId, 'space-general');
});

test('a later QR invitation cannot override an explicitly selected Dating default', async () => {
  const s = service({ defaultId: 'space-dating' });
  const result = await s.establishPhoneDefaultFromInvitation(s.caller, 'space-business');
  assert.equal(result.contextSpaceId, 'space-dating');
  assert.equal(s.data.defaultContextSpaceId, 'space-dating');
});

test('first QR invitation can initialise a legacy caller with no previous conversations', async () => {
  const s = service();
  const result = await s.establishPhoneDefaultFromInvitation(s.caller, 'space-business');
  assert.equal(result.contextSpaceId, 'space-business');
  assert.equal(s.data.defaultContextSpaceId, 'space-business');
});

test('invalid or other-user default never falls back to somebody else or legacy General', async () => {
  const s = service({ defaultId: 'space-other' });
  assert.equal(await s.resolvePhoneDefaultContext(s.caller), null);
});

test('source, schema, worker and settings preserve real ContextSpace ID custody', () => {
  assert.match(src('prisma/schema.prisma'), /defaultContextSpaceId String\?/);
  assert.match(src('prisma/migrations/20261023180000_stage8_18b_default_context_phone_continuity/migration.sql'), /ALTER TABLE "User" ADD COLUMN "defaultContextSpaceId" TEXT/);
  const onboarding = src('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  assert.match(onboarding, /resolvePhoneDefaultContext\(caller\)/);
  assert.match(onboarding, /contextSpaceId: selected\.contextSpaceId, contactId: selected\.contactId/);
  assert.match(onboarding, /RELISH_PHONE/); // Existing opt-in gate remains.
  const sms = src('src/lib/server/core/pilotSmsCallback.ts');
  assert.match(sms, /establishPhoneDefaultFromInvitation\(caller, contextSpaceId\)/);
  assert.match(sms, /ensureProvisionalPhoneCaller\(phone, invitation\.domainKey/);
  const worker = src('scripts/process-stage8-15-4-7f-2-phone-queue.ts');
  assert.match(worker, /processPhoneUnderstanding\(scope, source\.id, space\.domainKey/);
  assert.match(worker, /session\.contextSpaceId/);
  assert.match(src('src/routes/space/[context]/settings/+page.server.ts'), /setOwnedDefaultContextSpace/);
  assert.equal(existsSync(new URL('../../prisma/migrations/20261019153000_stage8_15_4_7a_verified_phone_custody', import.meta.url)), false);
});
