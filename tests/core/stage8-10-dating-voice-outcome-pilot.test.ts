// PURPOSE: Lock down the Stage 8.10 single-sided Dating voice Outcome pilot and its privacy boundaries.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-ignore - The Node strip-types test runner requires the explicit TypeScript extension.
import {
	DATING_OUTCOME_CONSENT_VERSION,
	DATING_OUTCOME_PROPOSAL_SCHEMA,
	normaliseDatingOutcomeProposal,
	reviewedDatingOutcomeProposal
} from '../../src/lib/datingOutcome.ts';

const agentSetup = readFileSync(
	new URL('../../src/lib/server/agents/agentSetup.ts', import.meta.url),
	'utf8'
);
const pilot = readFileSync(
	new URL('../../src/lib/server/datingOutcomePilot.ts', import.meta.url),
	'utf8'
);
const interactionCore = readFileSync(
	new URL('../../src/lib/server/core/interactions.ts', import.meta.url),
	'utf8'
);
const voiceField = readFileSync(
	new URL('../../src/lib/recording/VoiceTextField.svelte', import.meta.url),
	'utf8'
);
const upload = readFileSync(
	new URL('../../src/routes/api/upload-chunk/+server.ts', import.meta.url),
	'utf8'
);
const recordingPage = readFileSync(
	new URL('../../src/routes/dating/introductions/[id]/feedback/new/+page.svelte', import.meta.url),
	'utf8'
);
const reviewRoute = readFileSync(
	new URL('../../src/routes/dating/feedback/[id]/+page.server.ts', import.meta.url),
	'utf8'
);
const participantGuardMigration = readFileSync(
	new URL(
		'../../prisma/migrations/20260922190000_stage8_10_agent_run_introduction_participant/migration.sql',
		import.meta.url
	),
	'utf8'
);

const metadata = {
	proposalVersion: 1,
	introductionId: 'intro-1',
	respondentParticipantId: 'participant-a',
	sourceInteractionId: 'interaction-1',
	consentConfirmedAt: '2026-09-22T00:00:00.000Z',
	privateLearningAllowed: true,
	futureMatchingAllowed: false,
	shareWithOtherAllowed: false
};

test('Dating Outcome proposal preserves separate perspectives and fails uncertain values closed', () => {
	const proposal = normaliseDatingOutcomeProposal(
		{
			personalExperience: { summary: 'Enjoyed the venue.', evidence: ['I liked the bar.'] },
			selfLearning: { summary: 'Prefers bars.', evidence: ['Bars suit me better.'] },
			otherPersonExperience: {
				summary: 'Thought they were funny.',
				evidence: ['They made me laugh.']
			},
			relationshipDynamic: { summary: 'Conversation was easy.', evidence: ['We talked easily.'] },
			desireToContinue: { value: 'maybe', summary: 'Not certain.', evidence: [] },
			wholeOutcome: {
				status: 'invented',
				useful: 'unknown',
				continued: 'unknown',
				result: 'Met once.',
				notes: ''
			},
			confidence: 8
		},
		metadata
	);
	assert.equal(proposal.schemaVersion, DATING_OUTCOME_PROPOSAL_SCHEMA);
	assert.equal(proposal.consent.version, DATING_OUTCOME_CONSENT_VERSION);
	assert.equal(proposal.personalExperience.summary, 'Enjoyed the venue.');
	assert.equal(proposal.selfLearning.summary, 'Prefers bars.');
	assert.equal(proposal.otherPersonExperience.summary, 'Thought they were funny.');
	assert.equal(proposal.relationshipDynamic.summary, 'Conversation was easy.');
	assert.equal(proposal.desireToContinue.value, 'NOT_STATED');
	assert.equal(proposal.wholeOutcome.status, 'UNKNOWN');
	assert.equal(proposal.wholeOutcome.useful, null);
	assert.equal(proposal.wholeOutcome.continued, null);
	assert.equal(proposal.confidence, 1);
});

test('human review creates a new proposal version and preserves source evidence', () => {
	const base = normaliseDatingOutcomeProposal(
		{
			personalExperience: { summary: 'Draft', evidence: ['Source excerpt'] },
			selfLearning: { summary: '', evidence: [] },
			otherPersonExperience: { summary: '', evidence: [] },
			relationshipDynamic: { summary: '', evidence: [] },
			desireToContinue: { value: 'UNSURE', summary: '', evidence: [] },
			wholeOutcome: { status: 'UNKNOWN', useful: null, continued: null, result: '', notes: '' },
			confidence: 0.7
		},
		metadata
	);
	const form = new FormData();
	form.set('personalExperience', 'Reviewed');
	form.set('desireToContinue', 'YES');
	form.set('outcomeStatus', 'CONTINUING');
	form.set('useful', 'yes');
	form.set('continued', 'yes');
	form.set('privateLearningAllowed', 'true');
	const reviewed = reviewedDatingOutcomeProposal(base, form);
	assert.equal(reviewed.proposalVersion, 2);
	assert.equal(reviewed.personalExperience.summary, 'Reviewed');
	assert.deepEqual(reviewed.personalExperience.evidence, ['Source excerpt']);
	assert.equal(reviewed.wholeOutcome.status, 'CONTINUING');
	assert.equal(reviewed.wholeOutcome.useful, true);
	assert.equal(reviewed.wholeOutcome.continued, true);
	assert.equal(reviewed.consent.futureMatchingAllowed, false);
	assert.equal(reviewed.consent.shareWithOtherAllowed, false);
});

test('Dating extractor is Dating-only and has minimum data and tool permissions', () => {
	assert.match(agentSetup, /key: 'dating_outcome_extractor'/);
	assert.match(agentSetup, /allowedDomainKeys: \['dating'\]/);
	assert.match(agentSetup, /allowInteractions: true/);
	assert.match(agentSetup, /allowIntroductions: true/);
	assert.match(agentSetup, /allowOutcomes: true/);
	assert.match(agentSetup, /allowWants: false/);
	assert.match(agentSetup, /allowOffers: false/);
	assert.match(agentSetup, /'create_agent_artifact'[\s\S]*dating_outcome_extractor/);
	assert.match(agentSetup, /'create_approval_request'[\s\S]*dating_outcome_extractor/);
});

test('transcript and proposal remain encrypted and sensitive audits contain metadata only', () => {
	assert.match(pilot, /auditDataClass: 'sensitive'/);
	assert.match(pilot, /createCoreInteraction/);
	assert.match(pilot, /createEmbedding: false/);
	assert.match(pilot, /content: JSON\.stringify\(proposal\)/);
	// Stage 8.11.1 also encrypts the respondent's private next step in the reviewed artifact.
	assert.match(pilot, /encrypt\(JSON\.stringify\(reviewedContent\), 'agent_artifact\.content'\)/);
	assert.match(interactionCore, /rawTextEnc: encrypt\(rawText, 'interaction\.raw_text'\)/);
	assert.doesNotMatch(pilot, /inputJson:\s*\{[^}]*transcript\s*:/);
});

test('an Outcome is created only inside the explicit human approval function', () => {
	const extractionStart = pilot.indexOf('export async function runDatingOutcomeExtraction');
	const reviewStart = pilot.indexOf('export async function loadDatingOutcomeReview');
	const approvalStart = pilot.indexOf('export async function approveDatingOutcomeReview');
	const rejectionStart = pilot.indexOf('export async function rejectDatingOutcomeReview');
	assert.equal(pilot.slice(extractionStart, reviewStart).includes('.outcome.create('), false);
	assert.equal(pilot.slice(approvalStart, rejectionStart).includes('.outcome.create('), true);
	assert.match(reviewRoute, /approveDatingOutcomeReview/);
	assert.match(reviewRoute, /rejectDatingOutcomeReview/);
	assert.doesNotMatch(pilot, /knowledgeClaim\.create|want\.create|offer\.create/);
});

test('Dating recording uses Dating endpoints and transcript jobs are custody-bound', () => {
	assert.match(voiceField, /export let uploadEndpoint/);
	assert.match(voiceField, /export let resultEndpoint/);
	assert.match(recordingPage, /uploadEndpoint="\/dating\/api\/upload-chunk"/);
	assert.match(recordingPage, /resultEndpoint="\/dating\/api\/transcribe-result"/);
	assert.match(upload, /job\.userId !== userId/);
	assert.match(upload, /job\.contextSpaceId !== contextSpaceId/);
	assert.match(upload, /Invalid upload key/);
	assert.match(upload, /Audio chunks must arrive in order/);
	assert.match(upload, /MAX_AUDIO_BYTES/);
	assert.match(upload, /cleanupStaleAudio/);
	assert.match(upload, /jobs\.delete\(jobId\)/);
	assert.match(voiceField, /await uploadQueue/);
});

test('Agent run custody guard supports an IntroductionParticipant without weakening isolation', () => {
	assert.match(participantGuardMigration, /WHEN 'introduction_participant'/);
	assert.match(participantGuardMigration, /FROM "IntroductionParticipant"/);
	assert.match(participantGuardMigration, /'introduction_participant'/);
	assert.match(participantGuardMigration, /approval\."actionType" = 'dating_outcome_review'/);
	assert.match(participantGuardMigration, /run\."status" = 'failed'/);
	assert.match(pilot, /entityType: 'introduction_participant'/);
	assert.match(pilot, /Extraction failed before the proposal was ready for review/);
});
