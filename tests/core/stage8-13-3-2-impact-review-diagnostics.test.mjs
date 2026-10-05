// Stage 8.13.3.2 regression: analysis failures must remain safe in production
// while exposing useful diagnostics during development.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  'src/routes/dating/people/[id]/understanding/impact-review/+page.server.ts',
  'utf8'
);

test('impact analysis logs the underlying exception in development', () => {
  assert.match(source, /console\.error\('\[living-understanding\] impact analysis failed', err\)/);
  assert.match(source, /err instanceof Error \? `\$\{err\.name\}: \$\{err\.message\}` : String\(err\)/);
});

test('production impact-analysis errors remain generic', () => {
  assert.match(source, /if \(process\.env\.NODE_ENV !== 'production'\)/);
  assert.match(source, /return fail\(502, \{ impactError: safeError\(err\) \}\)/);
});
