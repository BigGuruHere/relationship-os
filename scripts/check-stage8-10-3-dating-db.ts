// PURPOSE: Exercise the real Dating extraction/review persistence and custody boundaries against PostgreSQL.
// SAFETY: Opt-in development database only. Each fixture is uniquely named; cleanup targets only fixture IDs.
// MODEL: Stub only the external OpenAI HTTP response. Prisma, service code, migrations and triggers run normally.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') {
  throw new Error('Set ALLOW_DATING_DEV_DB_TEST=YES after verifying DATABASE_URL points to development.');
}
if (!process.env.DATABASE_URL || !process.env.SECRET_MASTER_KEY || !process.env.DATING_TEST_USER_ID || !process.env.DATING_TEST_CONTEXT_SPACE_ID) {
  throw new Error('DATABASE_URL, SECRET_MASTER_KEY, DATING_TEST_USER_ID and DATING_TEST_CONTEXT_SPACE_ID are required.');
}
// The mock still follows the real gateway/provider path without making an external request.
process.env.OPENAI_API_KEY = 'dating-db-test-no-network';
// This is a finite integration test, not the long-running web server.
process.env.DB_KEEPALIVE_DISABLED = 'YES';
const [{ prisma }, { runWithWorkspaceCustody }, { encrypt, buildIndexToken, decrypt }, pilot, { createIntroductionFromForm }] = await Promise.all([
  import('../src/lib/db'),
  import('../src/lib/server/core/contextSpace'),
  import('../src/lib/crypto'),
  import('../src/lib/server/datingOutcomePilot'),
  import('../src/lib/server/introductions')
]);
const userId = process.env.DATING_TEST_USER_ID!;
const contextSpaceId = process.env.DATING_TEST_CONTEXT_SPACE_ID!;
const tag = `stage8-10-3-${randomUUID()}`;
let introId = '';
const contacts: string[] = [];
const otherSpaces: string[] = [];
let crossOwnerId = '';
const originalFetch = globalThis.fetch;
let failModel = false;
const fixture = {
  personalExperience: { summary: 'I enjoyed the meeting.', evidence: ['I enjoyed the meeting.'] },
  selfLearning: { summary: 'I prefer an unhurried conversation.', evidence: ['I prefer more time.'] },
  otherPersonExperience: { summary: 'I thought they seemed relaxed.', evidence: ['They seemed relaxed.'] },
  relationshipDynamic: { summary: 'We spoke easily.', evidence: ['We spoke easily.'] },
  desireToContinue: { value: 'YES', summary: 'I would like another meeting.', evidence: ['I would meet again.'] },
  wholeOutcome: { status: 'CONTINUING', useful: true, continued: true, result: 'One respondent would meet again.', notes: 'Only the respondent has reported this.' },
  confidence: 0.8
};
// No real model/network access is permitted by this test.
globalThis.fetch = async (input) => {
  assert.match(String(input), /^https:\/\/api\.openai\.com\/v1\/chat\/completions$/);
  if (failModel) return new Response('Simulated provider failure', { status: 503, statusText: 'Unavailable' });
  return Response.json({ choices: [{ message: { content: JSON.stringify(fixture) } }], usage: { prompt_tokens: 12, completion_tokens: 20 } });
};
const custody = <T>(fn: () => T | Promise<T>) => runWithWorkspaceCustody({ userId, contextSpaceId }, fn);
const params = () => ({ userId, contextSpaceId, introductionId: introId });
const transcript = 'I enjoyed our meeting. They seemed relaxed. We spoke easily. I prefer more time. I would meet again.';
function approvalForm() {
  const form = new FormData();
  form.set('personalExperience', 'Human-verified: I enjoyed the meeting.');
  form.set('selfLearning', 'I prefer an unhurried conversation.');
  form.set('otherPersonExperience', 'I thought they seemed relaxed.');
  form.set('relationshipDynamic', 'We spoke easily.');
  form.set('desireToContinue', 'YES');
  form.set('desireToContinueSummary', 'I would like another meeting.');
  form.set('outcomeStatus', 'CONTINUING');
  form.set('useful', 'yes');
  form.set('continued', 'yes');
  form.set('result', 'The respondent wants another meeting.');
  form.set('notes', 'One-sided report. Not confirmed by both people.');
  form.set('privateLearningAllowed', 'true');
  // Stage 8.11.2: every element requires its own explicit decision.
  for (const element of ['personalExperience', 'selfLearning', 'otherPersonExperience', 'relationshipDynamic', 'desireToContinue', 'wholeOutcome']) {
    form.set(`reviewDecision_${element}`, element === 'personalExperience' || element === 'wholeOutcome' ? 'CORRECTED' : 'CONFIRMED');
  }
  form.set('privateNextStep', 'PAUSE');
  form.set('privateNextStepNote', 'Give it one week before deciding.');
  return form;
}
async function extract(respondentParticipantId: string) {
  return custody(() => pilot.runDatingOutcomeExtraction({
    ...params(), respondentParticipantId, transcript, privateLearningAllowed: true,
    futureMatchingAllowed: false, shareWithOtherAllowed: false
  }));
}
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log(`PASS ${name}`);
}
async function cleanup() {
  // Only remove records attached to the unique test Introduction and test Contacts.
  await custody(async () => {
    if (introId) {
      const runs = await prisma.agentRun.findMany({ where: { userId, triggerEntityId: introId, triggerEntityType: 'Introduction' }, select: { id: true } });
      const ids = runs.map((run) => run.id);
      if (ids.length) {
        await prisma.agentRunEntity.deleteMany({ where: { agentRunId: { in: ids } } });
        await prisma.modelInvocation.deleteMany({ where: { agentRunId: { in: ids } } });
        await prisma.agentToolCall.deleteMany({ where: { agentRunId: { in: ids } } });
        await prisma.approvalRequest.deleteMany({ where: { agentRunId: { in: ids } } });
        await prisma.agentArtifact.deleteMany({ where: { agentRunId: { in: ids } } });
        await prisma.agentStep.deleteMany({ where: { agentRunId: { in: ids } } });
      }
      await prisma.outcome.deleteMany({ where: { userId, introductionId: introId } });
      if (ids.length) await prisma.agentRun.deleteMany({ where: { userId, id: { in: ids } } });
      await prisma.introductionParticipant.deleteMany({ where: { userId, introductionId: introId } });
      await prisma.introduction.deleteMany({ where: { userId, id: introId } });
    }
    if (contacts.length) {
      // A failed extraction can save a source Interaction without creating an AgentRun.
      await prisma.interaction.deleteMany({ where: { userId, contactId: { in: contacts }, channel: 'dating_voice_reflection' } });
      await prisma.contact.deleteMany({ where: { userId, id: { in: contacts } } });
    }
    for (const id of otherSpaces) await prisma.contextSpace.deleteMany({ where: { id, ownerUserId: userId } });
  });
  if (crossOwnerId) await prisma.user.deleteMany({ where: { id: crossOwnerId } });
}
try {
  const space = await prisma.contextSpace.findFirst({ where: { id: contextSpaceId, ownerUserId: userId, domainKey: 'dating' }, select: { id: true } });
  assert.ok(space, 'Supplied ContextSpace must belong to user and have domainKey=dating');
  const [a, b] = await custody(async () => Promise.all(['A', 'B'].map((side) => prisma.contact.create({
    data: { userId, contextSpaceId, fullNameEnc: encrypt(`${tag}-${side}`, 'contact.full_name'), fullNameIdx: buildIndexToken(`${tag}-${side}`), source: 'MANUAL' },
    select: { id: true }
  }))));
  contacts.push(a.id, b.id);
  const form = new FormData();
  form.set('partyAContactId', a.id);
  form.set('partyBContactId', b.id);
  form.set('reason', `Automated test ${tag}`);
  form.set('status', 'CONNECTED');
  const intro = await custody(() => createIntroductionFromForm(userId, form));
  introId = intro.id;
  const participants = await custody(() => prisma.introductionParticipant.findMany({ where: { userId, introductionId: introId }, orderBy: { side: 'asc' }, select: { id: true, side: true } }));
  assert.equal(participants.length, 2);
  const respondentId = participants[0].id;

  await check('source, proposal, run audit and pending review are persisted', async () => {
    const result = await extract(respondentId);
    const evidence = await custody(async () => {
      const review = await pilot.loadDatingOutcomeReview({ userId, contextSpaceId, approvalId: result.approvalId });
      const links = await prisma.agentRunEntity.findMany({ where: { agentRunId: result.runId }, select: { entityType: true, entityId: true, role: true } });
      const run = await prisma.agentRun.findFirst({ where: { id: result.runId, userId } });
      const stored = await prisma.interaction.findFirst({ where: { userId, id: result.interactionId }, select: { rawTextEnc: true } });
      return { review, links, run, stored };
    });
    assert.ok(evidence.review);
    assert.equal(evidence.review.approval.status, 'pending');
    assert.equal(evidence.review.proposal.respondentParticipantId, respondentId);
    assert.equal(evidence.review.proposal.consent.shareWithOtherAllowed, false);
    assert.equal(evidence.review.transcript, transcript);
    assert.equal(decrypt(evidence.stored!.rawTextEnc!, 'interaction.raw_text'), transcript);
    assert.ok(evidence.links.some((link) => link.entityType === 'introduction_participant' && link.entityId === respondentId && link.role === 'respondent'));
    assert.ok(evidence.links.some((link) => link.entityType === 'interaction' && link.entityId === result.interactionId));
    assert.equal(evidence.run!.status, 'completed');
    assert.ok(!JSON.stringify(evidence.run!.inputJson).includes(transcript));
    assert.equal(await custody(() => prisma.outcome.count({ where: { userId, introductionId: introId } })), 0);
    await custody(() => pilot.rejectDatingOutcomeReview({ userId, approvalId: result.approvalId, reviewerNote: 'Controlled rejection' }));
    assert.equal(await custody(() => prisma.outcome.count({ where: { userId, introductionId: introId } })), 0);
    await assert.rejects(() => custody(() => pilot.approveDatingOutcomeReview({ userId, contextSpaceId, approvalId: result.approvalId, form: approvalForm() })));
  });

  await check('approved proposal creates exactly one Outcome; concurrent repeat cannot duplicate', async () => {
    const result = await extract(respondentId);
    const attempts = await Promise.allSettled(Array.from({ length: 2 }, () => custody(() => pilot.approveDatingOutcomeReview({ userId, contextSpaceId, approvalId: result.approvalId, form: approvalForm() }))));
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
    const outcomes = await custody(() => prisma.outcome.findMany({ where: { userId, introductionId: introId }, select: { id: true, continued: true, sourceInteractionId: true, notesEnc: true } }));
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].continued, true);
    // Stage 8.11.1: the choice is retrievable only through the scoped review, not Outcome.
    const approved = await custody(() => pilot.loadDatingOutcomeReview({ userId, contextSpaceId, approvalId: result.approvalId }));
    assert.equal(approved?.privateNextStep?.choice, 'PAUSE');
    assert.equal(approved?.privateNextStep?.note, 'Give it one week before deciding.');
    assert.equal(approved?.approvedReflection?.personalExperience.summary, 'Human-verified: I enjoyed the meeting.');
    assert.equal(approved?.elementReviews?.find((item) => item.element === 'personalExperience')?.decision, 'CORRECTED');
    assert.equal(approved?.elementReviews?.find((item) => item.element === 'wholeOutcome')?.decision, 'CORRECTED');
    assert.equal(outcomes[0].sourceInteractionId, result.interactionId);
    assert.match(decrypt(outcomes[0].notesEnc!, 'outcome.notes'), /One-sided report/);
    await assert.rejects(() => custody(() => pilot.approveDatingOutcomeReview({ userId, contextSpaceId, approvalId: result.approvalId, form: approvalForm() })));
    assert.equal(await custody(() => prisma.outcome.count({ where: { userId, introductionId: introId } })), 1);
  });

  await check('deferred whole Outcome creates no Outcome; other decisions persist independently', async () => {
    const result = await extract(respondentId);
    const form = approvalForm();
    form.set('reviewDecision_wholeOutcome', 'DEFERRED');
    form.set('reviewDecision_otherPersonExperience', 'REJECTED');
    const before = await custody(() => prisma.outcome.count({ where: { userId, introductionId: introId } }));
    const approved = await custody(() => pilot.approveDatingOutcomeReview({ userId, contextSpaceId, approvalId: result.approvalId, form }));
    assert.equal(approved.outcomeId, null);
    assert.equal(await custody(() => prisma.outcome.count({ where: { userId, introductionId: introId } })), before);
    const review = await custody(() => pilot.loadDatingOutcomeReview({ userId, contextSpaceId, approvalId: result.approvalId }));
    assert.equal(review?.elementReviews?.find((item) => item.element === 'wholeOutcome')?.decision, 'DEFERRED');
    assert.equal(review?.elementReviews?.find((item) => item.element === 'otherPersonExperience')?.decision, 'REJECTED');
    assert.equal(review?.approvedReflection?.otherPersonExperience.summary, '');
    assert.equal(review?.approvedReflection?.wholeOutcome.status, 'UNKNOWN');
  });
  await check('failed model response leaves no pending approval; subsequent retry succeeds', async () => {
    failModel = true;
    await assert.rejects(() => extract(respondentId), /OpenAI model call failed/);
    failModel = false;
    const runs = await custody(() => prisma.agentRun.findMany({ where: { userId, triggerEntityId: introId, status: 'failed' }, select: { id: true } }));
    assert.equal(runs.length, 1);
    const pending = await custody(() => prisma.approvalRequest.count({ where: { userId, agentRunId: runs[0].id, status: 'pending' } }));
    assert.equal(pending, 0);
    const retry = await extract(respondentId);
    const review = await custody(() => pilot.loadDatingOutcomeReview({ userId, contextSpaceId, approvalId: retry.approvalId }));
    assert.equal(review?.approval.status, 'pending');
    assert.equal(await custody(() => prisma.outcome.count({ where: { userId, introductionId: introId } })), 1);
    await custody(() => pilot.rejectDatingOutcomeReview({ userId, approvalId: retry.approvalId }));
  });

  await check('same owner other ContextSpace and different owner cannot read or write review', async () => {
    const otherSpace = await prisma.contextSpace.create({ data: { ownerUserId: userId, domainKey: 'dating', isDefault: false }, select: { id: true } });
    otherSpaces.push(otherSpace.id);
    const pending = await extract(respondentId);
    assert.equal(await runWithWorkspaceCustody({ userId, contextSpaceId: otherSpace.id }, () => pilot.loadDatingOutcomeReview({ userId, contextSpaceId: otherSpace.id, approvalId: pending.approvalId })), null);
    await assert.rejects(() => runWithWorkspaceCustody({ userId, contextSpaceId: otherSpace.id }, () => pilot.approveDatingOutcomeReview({ userId, contextSpaceId: otherSpace.id, approvalId: pending.approvalId, form: approvalForm() })));
    await assert.rejects(() => runWithWorkspaceCustody({ userId, contextSpaceId: otherSpace.id }, () => pilot.runDatingOutcomeExtraction({ ...params(), contextSpaceId: otherSpace.id, respondentParticipantId: respondentId, transcript, privateLearningAllowed: false, futureMatchingAllowed: false, shareWithOtherAllowed: false })));
    const intruder = await prisma.user.create({ data: {}, select: { id: true } });
    crossOwnerId = intruder.id;
    const theirSpace = await prisma.contextSpace.create({ data: { ownerUserId: crossOwnerId, domainKey: 'dating', isDefault: false }, select: { id: true } });
    assert.equal(await runWithWorkspaceCustody({ userId: crossOwnerId, contextSpaceId: theirSpace.id }, () => pilot.loadDatingOutcomeReview({ userId: crossOwnerId, contextSpaceId: theirSpace.id, approvalId: pending.approvalId })), null);
    await assert.rejects(() => runWithWorkspaceCustody({ userId: crossOwnerId, contextSpaceId: theirSpace.id }, () => pilot.rejectDatingOutcomeReview({ userId: crossOwnerId, approvalId: pending.approvalId })));
    await custody(() => pilot.rejectDatingOutcomeReview({ userId, approvalId: pending.approvalId }));
  });
} finally {
  globalThis.fetch = originalFetch;
  try { await cleanup(); console.log('PASS fixture-only cleanup'); }
  finally {
    // Always close Prisma, including when an assertion or fixture cleanup fails.
    await prisma.$disconnect();
  }
}
