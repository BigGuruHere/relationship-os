// Invented conversations only. Each expectation is labelled independently of model wording.
export const initialTurns = [
	['agent', 'What would you like to remember about Alex?'],
	['owner', 'I generally like to see friends every three weeks.'],
	['owner', 'I feel lonely on some weekends and want to develop more friendships.'],
	['owner', 'I prefer small groups, beach walks and live music.'],
	['owner', 'I think Alex is impatient when plans change.'],
	['owner', 'Alex told me he prefers meeting in the morning.'],
	['owner', 'I want to spend more time with Alex, although I am unsure how often.'],
	['owner', 'We used to play tennis every week. Now we sometimes walk, but I miss the tennis.'],
	['owner', 'Work matters to me, but I spend too much time working alone.'],
	['owner', 'I previously considered moving abroad. I now want to stay near family.'],
	['agent', 'Perhaps Alex resents you?'],
	['owner', 'Maybe, but I really do not know.'],
	['agent', 'It sounds as though you feel overlooked when plans fall through.'],
	['owner', 'Yes, that is exactly how I feel.'],
	['owner', 'I also spoke to Morgan about work. Please do not search for anyone now.']
];
// More than six topics, four life areas, all three initial subject streams.
export const initialExpectations = [
	['self', 'Friendships', 'Meeting rhythm', 'PREFERENCE', 'DIRECT_ACCOUNT', 'CURRENT', 1],
	['self', 'Friendships', 'Social needs', 'WANT', 'DIRECT_ACCOUNT', 'CURRENT', 2],
	['self', 'Leisure', 'Social activities', 'PREFERENCE', 'DIRECT_ACCOUNT', 'CURRENT', 3],
	['alex', 'Friendships', 'Planning impression', 'OTHER', 'EXPRESSED_OPINION', 'CURRENT', 4],
	[
		'alex',
		'Friendships',
		'Reported timing preference',
		'PREFERENCE',
		'REPORTED_ASSERTION',
		'CURRENT',
		5
	],
	['relationship', 'Friendships', 'Time together', 'WANT', 'DIRECT_ACCOUNT', 'CURRENT', 6],
	[
		'relationship',
		'Leisure',
		'Shared activities',
		'RELATIONSHIP_STATE',
		'DIRECT_ACCOUNT',
		'MIXED',
		7
	],
	['self', 'Work', 'Working alone', 'CONSTRAINT', 'DIRECT_ACCOUNT', 'CURRENT', 8],
	['self', 'Family', 'Earlier move plans', 'OBJECTIVE', 'DIRECT_ACCOUNT', 'HISTORICAL', 9]
];
export const secondConversation = [
	{ effect: 'REINFORCED', topic: 'Meeting rhythm', text: 'Every three weeks still feels right.' },
	{
		effect: 'REFINED',
		topic: 'Social activities',
		text: 'By small groups I mean three or four close friends.'
	},
	{
		effect: 'EXPANDED',
		topic: 'Working alone',
		text: 'I have started a shared office day each week.'
	},
	{
		effect: 'QUALIFIED',
		topic: 'Time together',
		text: 'I want more time with Alex when we both have space.'
	},
	{
		effect: 'SUPERSEDED',
		topic: 'Reported timing preference',
		text: 'Alex now tells me evenings suit him instead.'
	},
	{
		effect: 'CONTRADICTED',
		topic: 'Planning impression',
		text: 'I also find Alex very patient about changed plans; I am unsure what changed.'
	},
	{ effect: 'UNCHANGED', topic: 'Earlier move plans', text: null },
	{ effect: 'NEW', topic: 'Learning', text: 'I want to learn pottery this year.' }
];

export function initialFixture() {
	let text = '';
	const turns = initialTurns.map(([speakerId, words], i) => {
		const start = text.length;
		text += words;
		const turn = { id: `T${i}`, speakerId, start, end: text.length };
		text += '\n';
		return turn;
	});
	const subjects = ['self', 'alex', 'relationship'].map((id) => ({
		id,
		kind: id === 'relationship' ? 'RELATIONSHIP' : 'PERSON'
	}));
	const destinations = subjects.map((s) => ({
		subjectId: s.id,
		perspectiveId: `view-${s.id}`,
		perspectiveKind: 'OWNER_RECORDED'
	}));
	const packet = {
		contract: 'LUR-1',
		scope: {
			ownerUserId: 'fixture-owner',
			vaultId: 'fixture-vault',
			epoch: 1,
			selfSubjectId: 'self'
		},
		source: {
			id: 'source',
			versionId: 'source-v1',
			version: 1,
			contentMac: 'synthetic-mac',
			kind: 'IMPORTED_CONVERSATION',
			occurredAt: null,
			completeness: 'COMPLETE',
			admission: 'PRIVATE_ANALYSIS'
		},
		text,
		subjects,
		destinations,
		turns,
		speakers: [
			{ id: 'owner', role: 'OWNER', subjectId: 'self' },
			{ id: 'agent', role: 'AGENT', subjectId: null }
		],
		unresolvedMentions: [{ turnId: 'T14', text: 'Morgan', reason: 'No selected subject binding.' }],
		baselines: destinations.map(({ subjectId, perspectiveId }) => ({
			subjectId,
			perspectiveId,
			revisionId: null,
			topics: []
		}))
	};
	const meanings = initialExpectations.map(
		([subjectId, area, title, kind, basis, timeScope, index], i) => {
			const t = turns[index];
			return {
				id: `M${i}`,
				subjectId,
				perspectiveId: `view-${subjectId}`,
				text: text.slice(t.start, t.end),
				kind,
				basis,
				expressedUncertainty: index === 6 ? 'Unsure how often' : null,
				confidence: 'HIGH',
				speakerId: 'owner',
				asserter:
					basis === 'REPORTED_ASSERTION'
						? { kind: 'REPORTED_PERSON', referenceId: 'alex' }
						: { kind: 'SOURCE_SPEAKER', referenceId: 'owner' },
				generation: {
					kind: 'MODEL_DRAFTED',
					invocationId: 'synthetic-run',
					model: 'fixture',
					promptVersion: 'fixture-v1',
					pipelineVersion: 'LUR-1'
				},
				recorder: 'SERVICE',
				review: 'UNREVIEWED',
				observedAt: null,
				validFrom: null,
				validUntil: null,
				evidence: [
					{
						sourceVersionId: 'source-v1',
						turnId: t.id,
						start: t.start,
						end: t.end,
						quote: text.slice(t.start, t.end),
						role: 'SUPPORTS'
					}
				]
			};
		}
	);
	const streams = destinations.map(({ subjectId, perspectiveId }) => ({
		subjectId,
		perspectiveId,
		baselineRevisionId: null,
		topics: initialExpectations.flatMap(([subject, area, title, kind, basis, timeScope], i) =>
			subject !== subjectId
				? []
				: [
						{
							key: `topic-${i}`,
							topicId: null,
							previousVersionId: null,
							effect: 'NEW',
							area,
							title,
							prose: meanings[i].text,
							timeScope,
							meaningIds: [meanings[i].id],
							retainedMeaningVersionIds: [],
							retiredMeanings: []
						}
					]
		)
	}));
	return {
		packet,
		candidate: {
			contract: 'LUR-1',
			sourceVersionId: 'source-v1',
			sourceContentMac: 'synthetic-mac',
			meanings,
			streams,
			exclusions: [
				{
					turnId: 'T14',
					reason:
						'Unresolved person and temporary search instruction; not selected-person knowledge.'
				}
			]
		}
	};
}
