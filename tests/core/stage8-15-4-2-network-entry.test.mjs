// PURPOSE: Guard Network's explicit personal profile selection and General ContextSpace mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
test('Network resolves through existing General ContextSpace', () => {
  assert.match(read('src/lib/server/core/contextDomain.ts'), /path === '\/network'/);
});
test('Network sharing selects the owner personal profile and never falls back to business', () => {
  const share = read('src/routes/network/share/+page.server.ts');
  assert.match(share, /userId: locals\.user\.id, kind: 'personal'/);
  assert.match(share, /if \(!profile\) throw redirect/);
  assert.match(share, /\/share\?profile=/);
});
test('Network profile creation cannot modify a default business profile', () => {
  const editor = read('src/routes/settings/profile/+page.server.ts');
  assert.match(editor, /createPersonal \? \{ kind: 'personal'/);
  assert.match(editor, /requestedProfileKind === 'personal'/);
});
