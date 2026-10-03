import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const impactPage = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.svelte', 'utf8');
const impactServer = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.server.ts', 'utf8');

test('8.13.2.2 preserves sourceInteractionId across named impact-review actions', () => {
  assert.match(impactPage, /function actionUrl\(actionName: 'analyseImpact' \| 'approveImpact'\)/);
  assert.match(impactPage, /sourceInteractionId=\$\{encodeURIComponent\(data\.source\.id\)\}/);
  assert.match(impactPage, /action=\{actionUrl\('analyseImpact'\)\}/);
  assert.match(impactPage, /action=\{actionUrl\('approveImpact'\)\}/);
});

test('8.13.2.2 page load remains source-scoped after POST rerender', () => {
  assert.match(impactServer, /url\.searchParams\.get\('sourceInteractionId'\)/);
  assert.match(impactServer, /requireSourceReflection\(scope, sourceInteractionId\)/);
});
