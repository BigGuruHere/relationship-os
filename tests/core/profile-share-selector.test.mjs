// Regression coverage for context-neutral profile management and Share profile selection.
// IT: Static checks are a fast guard; real mobile navigation and QR capture still need testing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const shareServer = read('src/routes/share/+page.server.ts');
const sharePage = read('src/routes/share/+page.svelte');

test('Share selects only signed-in users own profiles by exact slug', () => {
  assert.match(shareServer, /where: \{ userId: locals\.user\.id \}/);
  assert.match(shareServer, /select: \{ id: true, slug: true, label: true, displayName: true, isPublished: true \}/);
  assert.match(shareServer, /profileOptions\.find\(row => row\.slug === targetSlug\)/);
  assert.match(shareServer, /if \(targetSlug !== null && !profile\) throw error\(404/);
  assert.match(shareServer, /return \{ profile, profileOptions, origin: locals\.appOrigin, watchSince: Date\.now\(\) \}/);
});

test('Share dropdown displays owner labels and refreshes all profile-specific links', () => {
  assert.match(sharePage, /label for="share-profile-select">Profile to share/);
  assert.doesNotMatch(sharePage, /option\.kind|profileKindLabels/);
  assert.match(sharePage, /option\.label && option\.label !== 'My profile'/);
  assert.match(sharePage, /<option value=\{option\.slug\}>\{optionLabel\(option\)\}<\/option>/);
  assert.match(sharePage, /window\.location\.assign\('\/share\?profile=' \+ encodeURIComponent\(slug\)\)/);
  assert.match(sharePage, /'\/api\/qr\?slug=' \+ encodeURIComponent\(profile\.slug\)/);
  assert.match(sharePage, /const relPath = '\/u\/' \+ encodeURIComponent\(profile\.slug\)/);
});
