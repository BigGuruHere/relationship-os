import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectKnowledgeSelection, selectKnowledgeSuggestions } from '../../src/lib/server/knowledgeSuggestionQuality.ts';

const source = `Last Saturday I went to a social event. I often work alone on my business. I enjoy tennis and live music. I'd like more male friends. I'm not sure whether I'm ready for a serious relationship. I'd be open to meeting someone. I value closeness while maintaining individuality.`;
const entry = (kind, statement, evidenceQuote) => ({ kind, statement, evidenceQuote });

test('counts unsupported evidence and exact plus near duplicates without exposing private text', () => {
  const result = inspectKnowledgeSelection([
    entry('FACT','Often works alone on a business','I often work alone on my business.'),
    entry('FACT','Often works alone on a business','I often work alone on my business.'),
    entry('FACT','Often works alone on their business','I often work alone on my business.'),
    entry('WANT','Wants to meet new friends','This sentence was never spoken'),
    entry('CONSTRAINT','Unsure whether ready for a serious relationship',"I'm not sure whether I'm ready for a serious relationship."),
  ], source, 12);
  assert.equal(result.report.inputCount,5);
  assert.equal(result.report.invalidOrUnsupportedCount,1);
  assert.equal(result.report.exactDuplicateCount,1);
  assert.equal(result.report.nearDuplicateCount,1);
  assert.equal(result.report.eligibleCount,2);
  assert.equal(result.report.displayedCount,2);
  assert.equal(result.report.sourceMentionsUncertainty,true);
  assert.equal(result.report.selectedMentionsUncertainty,true);
  const report = JSON.stringify(result.report);
  assert.ok(!report.includes('business'));
  assert.ok(!report.includes('relationship'));
  assert.deepEqual(result.selected,selectKnowledgeSuggestions([
    entry('FACT','Often works alone on a business','I often work alone on my business.'),
    entry('FACT','Often works alone on a business','I often work alone on my business.'),
    entry('FACT','Often works alone on their business','I often work alone on my business.'),
    entry('WANT','Wants to meet new friends','This sentence was never spoken'),
    entry('CONSTRAINT','Unsure whether ready for a serious relationship',"I'm not sure whether I'm ready for a serious relationship."),
  ],source,12));
});

test('distinguishes omission by AI from exclusion by selection and limits', () => {
  const first = [entry('WANT','Open to meeting someone',"I'd be open to meeting someone.")];
  const firstReport = inspectKnowledgeSelection(first,source,32).report;
  assert.equal(firstReport.eligibleCount,1);
  assert.equal(firstReport.selectedMentionsUncertainty,false);
  assert.equal(firstReport.sourceMentionsUncertainty,true);
  const second = [entry('CONSTRAINT','Not sure about readiness for a serious relationship',"I'm not sure whether I'm ready for a serious relationship.")];
  const combined = inspectKnowledgeSelection([...first,...second],source,32);
  assert.equal(combined.report.eligibleCount,2);
  assert.equal(combined.report.selectedMentionsUncertainty,true);
});

test('records when the review limit hides additional eligible proposals without discarding them from a larger extraction', () => {
  const statements=['Enjoys tennis','Enjoys live music','Often works alone','Wants more male friends','Not sure ready for serious relationship','Open to meeting someone','Values closeness with individuality'];
  const quotes=['I enjoy tennis','live music','I often work alone','more male friends',"I'm not sure whether I'm ready for a serious relationship.","I'd be open to meeting someone",'I value closeness while maintaining individuality'];
  const proposals=statements.map((s,i)=>entry(i===4?'CONSTRAINT':i===3||i===5?'WANT':'PREFERENCE',s,quotes[i]));
  const small=inspectKnowledgeSelection(proposals,source,3);
  const full=inspectKnowledgeSelection(proposals,source,32);
  assert.equal(small.report.displayedCount,3);
  assert.equal(small.report.beyondLimitCount,full.report.eligibleCount-3);
  assert.equal(full.report.displayedCount,full.report.eligibleCount);
});

test('diagnostics require explicit development flag, are not logged, and surface only counts', () => {
  const extraction=readFileSync('src/lib/server/datingKnowledgeExtraction.ts','utf8');
  const ui=readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte','utf8');
  const route=readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts','utf8');
  const packageJson=JSON.parse(readFileSync('package.json','utf8'));
  assert.match(extraction,/NODE_ENV !== 'production' && process\.env\.DATING_KNOWLEDGE_DIAGNOSTICS === 'YES'/);
  assert.match(ui,/Development diagnostics - candidate counts only/);
  assert.match(route,/return \{ suggestions, diagnostics, suggestionSourceId:/);
  assert.match(packageJson.scripts.test,/\.test\.mjs/);
  assert.match(packageJson.scripts['check:stage8.12.7'],/stage8-12-7-extraction-diagnostics/);
});
