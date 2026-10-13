import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = [
  'src/routes/dating/people/[id]/understanding/impact-review/+page.svelte',
  'src/routes/general/people/[id]/understanding/impact-review/+page.svelte'
];

for (const page of pages) {
  test(`${page} narrows prepared LU pipeline data before rendering`, async () => {
    const source = await readFile(page, 'utf8');
    assert.match(source, /type PipelineStage =/);
    assert.match(source, /function preparedStages\(\): PipelineStage\[\]/);
    assert.match(source, /function proposalForReview\(\): ProposalView \| null/);
    assert.match(source, /function requiredProposalForReview\(\): ProposalView/);
    assert.match(source, /\{#each preparedStages\(\) as stage\}/);
    assert.match(source, /\{@const proposal = requiredProposalForReview\(\)\}/);
    assert.match(source, /form\?\.draftCheckpoint\?\.id/);
  });
}

test('conversation import pages do not retain the unused text-input selector', async () => {
  for (const page of [
    'src/routes/dating/conversations/import/+page.svelte',
    'src/routes/general/conversations/import/+page.svelte'
  ]) {
    const source = await readFile(page, 'utf8');
    assert.doesNotMatch(source, /input\[type="text"\]/);
  }
});
