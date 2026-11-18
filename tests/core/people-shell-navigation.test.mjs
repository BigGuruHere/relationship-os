// Regression checks for Relish shell navigation on Home and My People.
// IT: These fast source checks supplement, but do not replace, mobile browser testing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const layout = read('src/routes/+layout.svelte');
const css = read('src/app.css');

test('shared navigation stays neutral, including Operator tools and Manage users', () => {
  assert.doesNotMatch(layout, /relish-context-picker|context-select|activeBase|visibleSpaces/);
  for (const destination of ['/', '/people', '/profiles', '/share']) {
    assert.ok(layout.includes("href: '" + destination + "'"), 'missing global destination ' + destination);
  }
  assert.match(layout, /href="\/"[^>]*>← Back to Relish/);
  assert.match(layout, /href="\/operator"/);
  assert.match(layout, /href="\/settings\/users"/);
  assert.equal((layout.match(/href=\{item\.href\}/g) || []).length, 2);
});

test('My People retains desktop links and mobile bottom navigation', () => {
  assert.doesNotMatch(layout, /\{#if isPeople\}<a class="relish-nav-item" href="\/people\/new">Add Person<\/a>\s*\{:else if specialist\}/);
  assert.match(layout, /\{#if isPeople\}<a class="relish-nav-item" href="\/people\/new">Add Person<\/a>\{\/if\}/);
  assert.match(layout, /\{#if !isPublic && !exchangeFollowup && data\.user && !specialist\}/);
});

test('mobile actions stay right-aligned and account dropdown is right-anchored', () => {
  assert.match(css, /\.relish-header-tools \{ margin-left:auto; font-size:\.88rem; \}/);
  assert.match(css, /\.relish-more-menu \{ position:absolute; right:0;/);
});
