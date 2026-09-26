import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const history = readFileSync('src/routes/dating/people/[id]/+page.svelte', 'utf8');
const historyServer = readFileSync('src/routes/dating/people/[id]/+page.server.ts', 'utf8');
const understanding = readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte', 'utf8');
const understandingServer = readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json','utf8'));

test('reflection saving returns to personal history and highlights newly saved reflection', () => {
  assert.match(historyServer, /savedReflectionId/);
  assert.match(historyServer, /#personal-reflections/);
  assert.match(history, /id="personal-reflections"/);
  assert.match(history, /class=\{data\.savedReflectionId === r\.id \? "entry saved-reflection" : "entry"\}/);
  assert.match(history, /Review reflection and suggest knowledge/);
});

test('a reflection opens a focused review, not the full knowledge/topic archive', () => {
  assert.match(understanding, /\{#if data\.selectedSource\}/);
  assert.match(understanding, /Review this reflection/);
  assert.match(understanding, /Original reflection/);
  assert.match(understanding, /\{#if !data\.selectedSource\}[\s\S]*?id="realms"/);
  assert.match(understanding, /What Dorian thinks this says about the person/);
  assert.match(understanding, /Evidence in the original reflection/);
});

test('topic assignment is statement-first, visibly includes statement and preserves selection after submit', () => {
  assert.match(understanding, /id="claim-to-organise"/);
  assert.match(understanding, /You are assigning this statement/);
  assert.match(understanding, /selectedClaim\.statement/);
  assert.match(understanding, /Already assigned to:/);
  assert.match(understanding, /name="focusClaimId"/);
  assert.match(understandingServer, /focusClaimId: namedKnowledge\.some/);
  assert.match(understandingServer, /encodeURIComponent\(focusClaimId\)/);
  assert.match(understandingServer, /assignKnowledgeTopic\(scope/);
});

test('existing source scope and explicit consent remain required; tests join npm test', () => {
  assert.match(understandingServer, /requireSourceReflection\(scope, sourceId\)/);
  assert.match(understandingServer, /allowModelProcessing/);
  assert.match(pkg.scripts.test, /tests\/core\/\*\.test\.mjs/);
  assert.match(pkg.scripts['check:stage8.12.9'], /stage8-12-9-reflection-workflow/);
});
