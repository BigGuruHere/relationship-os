// Regression checks for Relish shell navigation on Home and My People.
// IT: These fast source checks supplement, but do not replace, mobile browser testing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const layout = read('src/routes/+layout.svelte');
const css = read('src/app.css');

test('Home and all My People routes use global navigation destinations', () => {
  assert.match(layout, /isNeutralNavigation = isHome \|\| isPeople/);
  assert.match(layout, /navHref\(item\.slug, isNeutralNavigation, activeBase\)/);
  assert.match(layout, /if \(neutralNavigation && slug === '\/profile'\) return '\/profiles'/);
  assert.match(layout, /if \(neutralNavigation && slug === '\/share'\) return '\/share'/);
});

test('My People retains desktop links and mobile bottom navigation', () => {
  assert.doesNotMatch(layout, /\{#if isPeople\}<a class="relish-nav-item" href="\/people\/new">Add Person<\/a>\s*\{:else if specialist\}/);
  assert.match(layout, /\{#if isPeople\}<a class="relish-nav-item" href="\/people\/new">Add Person<\/a>\{\/if\}/);
  assert.match(layout, /\{#if !isPublic && data\.user && !specialist\}/);
});

test('mobile actions stay right-aligned and account dropdown is right-anchored', () => {
  assert.match(css, /\.relish-header-tools \{ margin-left:auto; font-size:\.88rem; \}/);
  assert.match(css, /\.relish-more-menu \{ position:absolute; right:0;/);
});
