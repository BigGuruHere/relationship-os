// Stage 8.14.1.2 - General ContextSpace for broad participant conversations and Living Understanding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contextDomainForPathname, relationshipApplicationBase } from '../../src/lib/server/core/contextDomain.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const settings = read('../../src/routes/settings/context-spaces/+page.server.ts');
const settingsUi = read('../../src/routes/settings/context-spaces/+page.svelte');
const importer = read('../../src/lib/server/datingTranscriptImport.ts');
const generalImport = read('../../src/routes/general/conversations/import/+page.server.ts');
const generalPerson = read('../../src/routes/general/people/[id]/+page.svelte');
const understandingTopics = read('../../src/lib/server/datingUnderstandingTopics.ts');
const livingUnderstanding = read('../../src/lib/server/datingLivingUnderstanding.ts');
const sharedInitial = read('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts');

 test('General is a server-owned route domain with its own application base', () => {
  assert.equal(contextDomainForPathname('/general'), 'general');
  assert.equal(contextDomainForPathname('/general/people/123'), 'general');
  assert.equal(contextDomainForPathname('/dating/people/123'), 'dating');
  assert.equal(relationshipApplicationBase('general'), '/general');
  assert.equal(relationshipApplicationBase('dating'), '/dating');
});

test('General ContextSpace can be explicitly created and selected without a schema migration', () => {
  assert.match(settings, /GENERAL_DOMAIN_KEY/);
  assert.match(settings, /createGeneral/);
  assert.match(settings, /displayName: 'General'/);
  assert.match(settingsUi, /Create isolated General space/);
  assert.match(settingsUi, /broad Dorian conversations/);
});

test('conversation ingestion is provider-independent and domain-scoped', () => {
  assert.match(importer, /importConversationTranscript/);
  assert.match(importer, /expectedDomainKey/);
  assert.match(importer, /domainKey: expectedDomainKey/);
  assert.match(generalImport, /importConversationTranscript\(scope, 'general'/);
  assert.match(generalImport, /CONVERSATION|conversation/i);
  assert.match(generalImport, /Create initial Living Understanding|understanding\/initial/);
  assert.match(generalImport, /impact-review/);
});

test('Living Understanding validates owner plus ContextSpace rather than forcing Dating', () => {
  assert.doesNotMatch(understandingTopics, /domainKey: 'dating'/);
  assert.doesNotMatch(livingUnderstanding, /domainKey: 'dating'/);
  assert.match(sharedInitial, /isRelationshipApplicationDomain/);
  assert.match(sharedInitial, /relationshipApplicationBase/);
});

test('General participant UI keeps cross-context custody explicit', () => {
  assert.match(generalPerson, /General, Dating and Business ContextSpaces remain isolated/);
  assert.match(generalPerson, /Import conversation/);
  assert.match(generalPerson, /Living Understanding/);
});
