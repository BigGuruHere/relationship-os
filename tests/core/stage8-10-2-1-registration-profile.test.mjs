// Contract checks only; the release notes call for separate database/HTTP verification.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = (relative) => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('default profile helper supplies the required unique slug', () => {
  const source = read('src/lib/server/profiles.ts');
  assert.match(source, /slug:\s*`p-\$\{randomUUID\(\)\}`/);
});

test('registration creates encrypted email and default profile in the same User.create call', () => {
  const source = read('src/routes/auth/register/+page.server.ts');
  assert.match(source, /prisma\.user\.create\(\{/);
  assert.match(source, /\.\.\.encryptedUserEmailFields\(email\)/);
  assert.match(source, /person:\s*\{\s*create:\s*\{\s*\}\s*\}/);
  assert.match(source, /profiles:\s*\{\s*create:/);
  assert.match(source, /slug:\s*`p-\$\{randomUUID\(\)\}`/);
  assert.doesNotMatch(source, /await setUserEmail\(/);
  assert.doesNotMatch(source, /await ensureDefaultProfile\(/);
});

test('email encryption/index preparation is shared with existing user updates', () => {
  const source = read('src/lib/server/userEmail.ts');
  assert.match(source, /export function encryptedUserEmailFields\(email: string\)/);
  assert.match(source, /email_Enc:\s*encrypt\(normalized\)/);
  assert.match(source, /email_Idx:\s*toEmailIdx\(normalized\)/);
  assert.match(source, /data:\s*encryptedUserEmailFields\(email\)/);
});

test('valid login attempts to repair a profile missing from an older partial registration', () => {
  const source = read('src/routes/auth/login/+page.server.ts');
  assert.match(source, /await ensureDefaultProfile\(user\.id,/);
  assert.ok(source.indexOf('await verifyPassword(') < source.indexOf('await ensureDefaultProfile('));
});
