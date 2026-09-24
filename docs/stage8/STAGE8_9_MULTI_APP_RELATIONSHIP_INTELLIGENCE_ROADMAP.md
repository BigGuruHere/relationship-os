# Relish Core RelationshipOS Design and Multi-App Roadmap

Status: consolidated planning baseline after Stage 8.8.12  
Planning baseline release: Stage 8.8.14  
Last updated: 2026-09-22

## 1. Purpose

This roadmap defines how Relish evolves from the current Business and Broking application into a domain-neutral relationship intelligence platform supporting isolated application layers such as:

- Business and broking
- Dating
- Personal relationships
- Friendship and community
- Fixed-person and fixed-group value orchestration
- Event Intelligence and connection planning
- Future relationship-based products

The first concrete non-business test is a Dating voice-feedback pilot. The pilot is not a separate architecture. It is the first end-to-end test of the evidence, knowledge, memory, introduction, outcome, consent, and learning foundations already established in Relish Core.

This document is the planning authority for work after Stage 8.8.12. It consolidates the Stage 8.8.13 baseline with the later fixed-group and Event Intelligence design decisions. Stage names or numbers may move as evidence is gathered, but dependency order, privacy boundaries, promotion rules, and acceptance gates must not be bypassed.

## 2. Product and architecture decision

Relish will use one domain-neutral Core with multiple isolated app layers.

The applications share capabilities, not unrestricted knowledge.

```text
Business App             ->
Dating App               ->
Value Orchestration App  ->  Relish Core -> Context-scoped data
Event Intelligence App   ->
Future Apps              ->
```

Relish Core owns domain-neutral primitives:

- Identity and contextual representations
- ContextSpace custody
- Interactions and source evidence
- Knowledge Claims and Evidence
- Objectives, Wants, Offers, preferences, and constraints
- Relationships, Introductions, and Outcomes
- Consent and disclosure infrastructure
- Agent definitions, policies, tools, approvals, and audits
- Purpose-specific memory projections
- Private semantic retrieval

Each app layer owns:

- Routes and user interface
- Domain terminology
- Domain workflows
- App-specific operational models
- Match or opportunity scoring logic
- Domain-specific agents and prompts
- Domain-specific memory presentation

Business Leads, Deals, valuation, seller qualification, and commission remain Business-app concerns. Dating attraction, mutual interest, readiness, and dating feedback remain Dating-app concerns.

Fixed-group scoring, contribution plans, fairness policies, and value-creation recommendations remain Value Orchestration-app concerns. Event ingestion, agendas, attendance, attendee ranking, event ranking, and networking schedules remain Event Intelligence-app concerns.

The general RelationshipOS question is:

> Given these permitted people, relationships, objectives, opportunity contexts, and current evidence, what connection or action is most likely to create value, for whom, at what cost or risk, and with what confidence?

Dating matching, business introductions, fixed-team contribution planning, and event networking are different applications of this question. They share evidence, knowledge, consent, projection, recommendation, and Outcome infrastructure without sharing unrestricted private data or one universal scoring formula.

## 3. AI-native data principle

Relish will not create a dedicated field for every human insight. It will use four layers.

### 3.1 Evidence and events

Durable source material:

- Voice transcripts
- Messages and notes
- Interactions
- Introductions
- Feedback submissions
- Decisions and consent events
- Outcomes

Evidence is retained with identity, custody, time, source, and provenance.

### 3.2 Claims and observations

Interpreted meaning:

- Facts
- Preferences
- Constraints
- Wants and Offers
- Relationship states
- Perceptions
- Context-specific observations
- System inferences

Provisional AI extraction is not canonical truth. Reviewed Knowledge Claims and Evidence remain the durable meaning layer.

### 3.3 Operational state

Exact state required for safe action:

- Introduction status
- Respondent identity
- Desire to continue
- Mutual-interest state
- Approval state
- Sharing permission
- Disclosure stage
- Active or withdrawn Want
- Task or workflow status

This state remains structured because agents and applications must not infer it from narrative text.

### 3.4 Purpose-specific memory

Agents receive replaceable projections built from permitted Core records. A summary is a first-pass briefing, not the source of truth.

The normal retrieval sequence is:

1. Retrieve the purpose-specific summary.
2. Retrieve relevant active claims and exact operational state.
3. Retrieve recent or semantically relevant evidence.
4. Expand to source material only when uncertainty, contradiction, or explanation requires it.

Future models may reprocess preserved evidence and produce better interpretations without changing the underlying source history.

## 4. Existing Core capabilities to reuse

The following existing components remain authoritative and must be extended rather than duplicated:

| Need                             | Existing Core capability                                    |
| -------------------------------- | ----------------------------------------------------------- |
| Encrypted source evidence        | `Interaction.rawTextEnc`                                    |
| Source summary                   | `Interaction.summaryEnc`                                    |
| Channel-neutral ingestion        | `createCoreInteraction()`                                   |
| Private semantic evidence search | `InteractionEmbedding`                                      |
| Durable reviewed meaning         | `KnowledgeClaim`                                            |
| Appendable provenance            | `KnowledgeEvidence`                                         |
| Higher-level intentions          | `Objective`, `Want`, `Offer`                                |
| Real connection event            | `Introduction` and `IntroductionParticipant`                |
| Whole-connection state           | `Outcome`                                                   |
| Custody boundary                 | `ContextSpace`                                              |
| Purpose-scoped agent memory      | `buildAgentMemoryProjection()`                              |
| Agent data permission            | `AgentDataAccessPolicy`                                     |
| Agent action permission          | `AgentToolPermission`                                       |
| Human review                     | `ApprovalRequest`                                           |
| Agent audit                      | `AgentRun`, `AgentStep`, `AgentToolCall`, `ModelInvocation` |

No new live representation may duplicate these concepts without an explicit migration and retirement plan.

### 4.1 Existing foundation versus completed future capability

Several future capabilities already have a strong implementation pattern, but the pattern must not be mistaken for the finished capability.

- `ContextSpace` already separates custody from `Person` identity and `User` ownership. Stage 8.9 extends this proven boundary with application-domain identity, explicit selection, route resolution, and agent-domain enforcement.
- `buildAgentMemoryProjection()` already proves that memory can be derived, permission-filtered, purpose-described, and non-canonical. It currently accepts one Contact or Person and applies agent-level access policy. It is not yet a multi-subject, participant-consented, recipient-specific, revocable, network-safe projection service.
- `Introduction` already records a real connection and `Outcome` already records appendable results. The current `IntroductionSide` values and database constraint deliberately make an Introduction dyadic. This is suitable for Dating and pairwise Business introductions, but it is not a universal event, team, or group-participation model.
- `KnowledgeClaim` and `KnowledgeEvidence` already preserve reviewed meaning and provenance. They do not yet represent all temporal validity, contextual scope, semantic contradiction, or consent requirements needed by Event Intelligence and cross-person computation.

Future work must extend these foundations rather than claim that the later capability already exists or replace the foundations with parallel systems.

## 5. Current gaps this roadmap closes

1. ContextSpaces lack a clear extensible app-domain identity and display identity.
2. The application generally assumes the default ContextSpace.
3. Agent definitions are not strongly restricted to allowed app domains or ContextSpaces.
4. Interaction summaries have an encryption-label inconsistency in the current ingestion and memory paths.
5. Sensitive free-form agent JSON fields are unsafe for unredacted Dating content.
6. There is no participant feedback event linked to an Introduction and respondent.
7. Current Outcomes cannot represent multi-perspective feedback.
8. Provisional observations have no safe encrypted staging and review workflow.
9. Claim reconciliation handles exact repeated wording but not semantic equivalence, refinement, or contradiction.
10. Knowledge lacks explicit temporal validity and claim-to-claim relationships where required.
11. Memory summaries are deterministic and recency-heavy rather than deeply synthesised and semantically retrieved.
12. Consent, disclosure, revocation, and per-observation visibility are not implemented.
13. PotentialMatch and participant-safe progressive disclosure are not implemented.
14. Private embeddings are not appropriate for cross-person matching, and match-safe projections do not yet exist.
15. There is no closed loop comparing match predictions with Introduction Outcomes.
16. `Introduction` is intentionally limited to two sides, and `Outcome` is currently Introduction-specific.
17. Agent memory accepts one Contact or Person rather than a permitted set of people, a relationship unit, a group, or an event.
18. There is no durable `RelationshipUnit` or membership model for an ongoing dyad, partnership, family, team, or other group.
19. There is no Event, attendance, connection-session, or event-level Outcome model.
20. There is no fixed-participant value-opportunity or contribution-planning workflow.
21. Knowledge does not yet distinguish durable personal learning from temporary, event-scoped, or purpose-scoped information.
22. Cross-owner computation does not yet have a participant-consented broker or network-safe projection boundary.

### 5.1 Subject, custody, relationship, activity, and context are distinct

Relish must not collapse the following concepts into one table or identifier:

| Concept                   | Meaning                                                    | Examples                                 |
| ------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Identity                  | Who or what exists                                         | Person, Company                          |
| Contextual representation | How a custodian knows an identity                          | Contact                                  |
| Custody                   | Which owner and app boundary holds records                 | ContextSpace                             |
| Relationship unit         | An ongoing collective whose value may be considered        | Dyad, partnership, team, family          |
| Activity                  | Something that occurred or is planned                      | Introduction, meeting, contribution plan |
| Opportunity context       | A setting in which connections or actions may create value | Conference, dinner, community event      |
| Evidence                  | What was said, observed, or recorded                       | Interaction, transcript, note            |
| Meaning                   | Reviewed interpretation of evidence                        | Claim, Want, Offer, constraint           |
| Outcome                   | What resulted and from whose perspective                   | Individual, relationship, group, policy  |

`ContextSpace` remains the custody and application boundary. It must not be used as the person, relationship unit, team, event, or real-world activity being analysed.

### 5.2 Participant cardinality decision

The current `Introduction` remains deliberately dyadic for the Dating pilot and pairwise Business introductions.

- Do not widen `IntroductionSide` by adding more alphabetic enum values.
- Do not use `IntroductionParticipant` as the universal participant model for teams, events, or groups.
- Store future Introduction feedback against stable participant record ids, such as `respondentParticipantId` and optional `subjectParticipantId`, rather than persisting only side labels.
- A series of separate one-to-one conference introductions may remain separate Introduction records.
- A multi-person meeting, roundtable, team intervention, or event-level activity requires a separate participant-bearing structure or a later deliberately generalised activity model.
- The current Introduction-specific Outcome may remain for the pilot. Future activity types may add their own Outcomes or justify a domain-neutral Outcome envelope after concrete use.

This preserves the useful two-person invariant without making it load-bearing across all of Relish Core.

### 5.3 Projection evolution

The existing agent-memory projection is the first implementation of a broader pattern. A future projection request may need:

- one or more permitted subjects
- a relationship unit or opportunity context
- an explicit computational purpose
- active participant consent
- recipient and disclosure stage
- current time and temporal validity
- minimum necessary source fields
- policy and schema versions

Matching, value orchestration, event networking, and event recommendation should specialise this mechanism. They must not receive unrestricted source records merely because the computation is useful.

### 5.4 Core-versus-app decision rule

A capability belongs in Core when it is domain-neutral, reused by more than one app, and required for identity, custody, evidence, knowledge, consent, projection, action control, or audit.

A capability remains in an app when it expresses domain terminology, ranking weights, scoring policy, workflows, presentation, or a still-unproven operational concept.

New Value Orchestration and Event Intelligence models begin app-specific unless repeated use demonstrates a stable Core abstraction. Promotion into Core requires an explicit migration and retirement plan.

### 5.5 RelationshipOS capability map

| App or capability             | Fixed input                            | Variable being chosen           | Primary output                        | Shared Core dependencies                                                               |
| ----------------------------- | -------------------------------------- | ------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| Business introduction         | Buyer, seller, mandate, or opportunity | Relevant counterpart            | Introduction recommendation           | Identity, Wants, Offers, Objectives, evidence, consent, projection, Outcome            |
| Dating                        | One participant or candidate pool      | Compatible participant          | PotentialMatch and Introduction       | Identity, feedback, claims, consent, projection, disclosure, Outcome                   |
| Value Orchestration           | Existing pair or group                 | Contributions and joint actions | ValueOpportunity and ContributionPlan | Relationship unit, Wants, Needs, Offers, Objectives, multi-subject projection, Outcome |
| Event attendee recommendation | Person or group plus one event         | Relevant attendees or meetings  | Networking plan                       | Event, attendance, current objectives, projection, consent, recommendation Outcome     |
| Event recommendation          | Person or group                        | Suitable events                 | Ranked event opportunities            | Event metadata, time and location constraints, group projection, Outcome learning      |

The architecture must support both selection and orchestration:

- Selection chooses the person, event, or opportunity.
- Orchestration assumes the participants or context are fixed and chooses the next contribution, meeting, or action.

Neither form of reasoning may silently promote a prediction into canonical knowledge.

## 6. The first Dating test

The initial hypothesis is:

> A short private voice reflection after meeting someone can produce trustworthy information that improves the next introduction or recommendation.

The pilot progresses from single-sided internal use to two-sided participant feedback. It does not begin with autonomous matching or a live telephone agent.

### 6.1 Five outcome perspectives

An Introduction may yield at least five distinct perspectives:

1. Person A's personal experience and self-learning.
2. Person B's personal experience and self-learning.
3. Person A's perception of Person B.
4. Person B's perception of Person A.
5. The whole-Introduction outcome, including mutual or one-sided continuation.

These are initial views, not five permanent database columns. Future observations may concern venue, safety, conversational balance, lifestyle compatibility, timing, follow-up behaviour, attraction, callback quality, or match-prediction accuracy.

### 6.2 Knowledge rules

- A self-observation may propose knowledge about the respondent.
- A perception of another participant remains the respondent's private perception by default.
- A third-party perception does not silently become canonical truth about its subject.
- Repeated independent evidence may justify a stronger proposed claim, subject to review and privacy rules.
- Whole-Introduction state is distinct from either participant's private explanation.
- Private explanations are not disclosed merely because a mutual-interest result is disclosed.

## 7. Staged delivery plan

### Stage 8.8.13 - Roadmap baseline

Type: documentation only.

Deliverables:

- Establish this roadmap as the future planning authority.
- Record the one-Core, multiple-app decision.
- Record the AI-native four-layer data principle.
- Record the Dating pilot and five-perspective Outcome model.
- Reconcile the previous future-stage numbering conflict.

Acceptance:

- No Prisma schema change.
- No migration.
- No runtime behaviour change.
- Roadmap regression confirms that the core decisions and stage gates remain present.

### Stage 8.8.14 - RelationshipOS design consolidation

Type: documentation only.

Deliverables:

- Distinguish existing Core foundations from unfinished future capabilities.
- Record the deliberately dyadic Introduction decision and prevent it from becoming the universal participant abstraction.
- Record the subject, custody, relationship-unit, activity, opportunity-context, evidence, meaning, and Outcome boundaries.
- Add fixed-person and fixed-group Value Orchestration to the future design.
- Add Event Intelligence, attendee recommendation, and event recommendation to the future design.
- Preserve compatibility requirements in the earlier roadmap stages without prematurely implementing later models.

Acceptance:

- No Prisma schema change.
- No migration.
- No runtime behaviour change.
- Roadmap regression confirms that Dating, Value Orchestration, and Event Intelligence remain staged applications of one Core.

### Stage 8.9 - Multi-app ContextSpace boundary

Status: implemented in the Stage 8.9 release. Production activation requires the Stage 8.9 migration.

Goal: ensure Dating and Business can use the same Core without data mixing.

Deliverables:

- Add an extensible `domainKey` to ContextSpace, initially supporting `business` and `dating`.
- Add an encrypted or non-sensitive display identity appropriate to the selected design.
- Backfill the existing default ContextSpace as the Business domain without moving or duplicating records.
- Add explicit context selection and server-side context resolution.
- Ensure Business routes continue to enter only the Business ContextSpace.
- Create a separate Dating ContextSpace through a controlled application action.
- Bind agent deployments to allowed domains or explicit ContextSpaces.
- Deny cross-context and cross-domain reads by default.
- Add regression tests proving same-owner ContextSpaces cannot read each other's contextual records.
- Correct the Interaction summary encryption-label inconsistency.
- Define and test a sensitive-agent-logging contract. Unredacted transcripts and sensitive observations must not enter ordinary JSON audit fields.
- Establish code boundaries for `core`, `apps/business`, and `apps/dating` without a large cosmetic rewrite.

Out of scope:

- Dating profile experience
- Participant feedback
- Matching
- Disclosure grants

Acceptance gate:

- Existing Business behaviour remains intact.
- A Dating ContextSpace can exist with zero visibility into Business records.
- A Business agent cannot execute against the Dating domain unless explicitly allowed.
- A Dating agent cannot execute against the Business domain unless explicitly allowed.
- No raw contextual data crosses the boundary in search, memory, embeddings, or audit logs.

### Stage 8.10 - Dating app shell and single-sided voice Outcome pilot

Status: implemented in the Stage 8.10 release. Pilot acceptance still requires the controlled dry runs and real consented reflections below.

Goal: test whether voice feedback produces reliable, useful information before building two-sided matching.

Deliverables:

- Add a minimal Dating application shell bound to a Dating ContextSpace.
- Reuse the existing Introduction models and existing voice recorder/transcription pipeline.
- Allow the workspace owner to select the respondent participant before recording feedback.
- Preserve the distinction between the person providing feedback and the person or relationship the statement concerns.
- Store the transcript as an encrypted Interaction.
- Link the feedback source to the Introduction without treating the transcript as canonical knowledge.
- Add a Dating Outcome Extractor agent with minimum data permissions.
- Produce a versioned structured proposal from the completed transcript after recording.
- Store sensitive provisional content only in encrypted storage.
- Show transcript and proposed extraction for mandatory review, editing, approval, or rejection.
- Create or update the whole-Introduction Outcome only after approval.
- Record agent and approval audit metadata without logging raw sensitive content in plaintext JSON.

Initial callback areas:

1. Personal experience.
2. Self-learning.
3. Experience of the other person.
4. Relationship dynamic.
5. Desire to continue.
6. Privacy and permitted use.

Explicitly excluded:

- Automatic Knowledge Claim updates
- Automatic Want or Offer updates
- Participant-facing links
- Two-sided mutual-interest disclosure
- Automated matching
- Live conversational voice

Pilot gate:

- Complete at least five controlled dry runs.
- Complete at least five real single-sided reflections with informed consent where another person is identifiable.
- At least 90 percent of proposed exact Outcome fields are correct before editing.
- Reviewers can trace every proposal to source evidence.
- No unredacted transcript appears in plaintext agent audit JSON.
- Decide from evidence whether a durable `IntroductionFeedback` model is required for Stage 8.11.

### Stage 8.11 - Multi-perspective Introduction feedback

Goal: collect separate private feedback from both participants and represent the five outcome perspectives safely.

Likely Core addition:

- A thin `IntroductionFeedback` record linking Introduction, stable respondent participant id, source Interaction, submission time, consent version, processing state, and privacy state.
- Where a feedback item concerns the other participant, reference an optional stable subject participant id rather than storing only `A` or `B` as the durable subject.

Observation implementation decision:

- Begin with versioned encrypted provisional extraction.
- Add a durable generic observation model only if the Stage 8.10 evidence shows that observations require independent lifecycle, query, review, or privacy control.
- Do not add one field for every Dating dimension.

Every approved observation must be able to preserve:

- Observer or source type
- Respondent
- Subject
- Perspective
- Category key
- Human-readable encrypted statement
- Optional structured encrypted value
- Authority
- Confidence
- Visibility and permitted computational use
- Source Interaction and evidence span
- Extraction schema and prompt version
- Review status

Deliverables:

- Separate feedback submission for each participant.
- Separate private views for self-outcome and about-other observations.
- Disclosure-safe whole-Introduction state.
- Mutual, one-sided, neither, unknown, continuing, and ended states.
- No disclosure of one participant's explanation to the other without explicit permission.

Pilot gate:

- Run three to five real two-sided Introductions or equivalent consenting test cases.
- Obtain six to ten independent callbacks.
- Confirm respondents understand what is private, usable for matching, and shareable.
- Confirm the whole-Introduction state can be determined without leaking private explanations.
- Confirm the observation structure accommodates at least one useful category not anticipated in the initial five views.

### Stage 8.12 - Knowledge reconciliation and Dating memory

Goal: convert approved feedback into reviewed, longitudinal understanding without creating duplicate or overconfident knowledge.

Deliverables:

- Add a separate Dating Knowledge Reconciler agent.
- Classify proposed learning as new, reinforcing, refining, contradicting, possibly obsolete, or insufficient.
- Use semantic candidate retrieval before creating a new claim.
- Keep exact deterministic equality as one signal, not the complete reconciliation method.
- Preserve each source as Knowledge Evidence.
- Require human approval for claim creation, reinforcement, supersession, or promotion during the pilot.
- Add explicit claim relationships or temporal validity only where real cases require them.
- Preserve whether approved learning is durable, time-limited, or scoped to a particular activity or opportunity context when real evidence first requires that distinction.
- Add a Dating purpose-specific MemoryProjection.
- Retrieve semantically relevant evidence in addition to recent evidence.
- Include uncertainty, source authority, contradictory evidence, and unsupported-claim warnings.
- Keep any cached summary replaceable, versioned, source-covered, and non-canonical.

Promotion rules:

- Most Dating learning begins as Preference, Constraint, Relationship State, or Other.
- Use Want for explicit desired outcomes or criteria.
- Use Offer only for something the person explicitly says they bring or are willing to provide.
- Do not promote third-party perceptions into a person's canonical self-knowledge without review and appropriate authority.

Acceptance gate:

- Paraphrased evidence is proposed against an existing semantic claim rather than automatically duplicated.
- Contradictory evidence is surfaced rather than silently overwriting truth.
- A user can trace summary statements back to claims and source Interactions.
- Dating memory cannot read Business context.
- New models can reprocess source Interactions without destroying earlier reviewed history.

### Stage 8.13 - Consent and disclosure foundation

Goal: make computational use and disclosure enforceable rather than prompt conventions.

Deliverables:

- Add recipient-specific and purpose-specific Disclosure Grants.
- Represent source ContextSpace, audience or recipient, purpose, scope, stage, source consent evidence, effective time, expiry, and revocation.
- Keep purpose keys extensible beyond Dating, including future `value_orchestration`, `event_networking`, and `event_recommendation` uses.
- Separate read access, computational use, disclosure, and action.
- Add private, facilitator-only, matching-only, aggregated, and explicitly shareable treatments where justified.
- Allow conversational consent requests, but prohibit agents from expanding their own authority.
- Revoke future use and disclosure when a grant is withdrawn.
- Define deletion and retention behaviour for raw Dating transcripts.

Acceptance gate:

- A participant can permit matching use without permitting disclosure of the raw statement.
- A participant can share one fact without exposing the whole Want, profile, or transcript.
- Revocation removes the information from future permitted projections.
- Disclosure tests fail closed when recipient, purpose, scope, or stage does not match.

### Stage 8.14 - Manual PotentialMatch

Goal: record real human-selected candidates and match hypotheses before automated network matching.

Deliverables:

- Add domain-neutral PotentialMatch and MatchParticipant concepts only after real manual use defines them.
- Do not treat MatchParticipant or IntroductionParticipant as the universal team, event-attendance, or relationship-unit membership model.
- Record the domain and policy version used.
- Record a pre-Introduction match rationale and predicted fit factors.
- Record risks, unknowns, and what the Introduction is intended to test.
- Require human selection and review.
- Create Introductions through approved permissions rather than raw cross-context access.

Acceptance gate:

- A match record can be evaluated after an Outcome without revealing either participant's private source records.
- Match rationale is traceable to permitted projections.
- No raw private embedding or transcript participates in cross-person search.

### Stage 8.15 - Participant experience and progressive bilateral disclosure

Goal: support safe participant-facing invitations, feedback, mutual interest, and staged identity disclosure.

Deliverables:

- Secure expiring participant links or authenticated participant experience.
- Transcript review before submission.
- Separate private, matching-use, and shareable content.
- Per-side disclosure state.
- Explicit Introduction permission.
- Asymmetric disclosure where policy permits it.
- Neutral mutual-interest messaging that does not reveal a private explanation.
- Participant-controlled correction and deletion requests.

Acceptance gate:

- One participant cannot access the other participant's private feedback.
- One-sided interest is communicated without disclosing the declining participant's reason.
- Expired or revoked links fail closed.
- Every disclosure is traceable to an active grant.

### Stage 8.16 - Matchable projections and network-safe embeddings

Goal: derive the minimum permitted representation required for matching.

Deliverables:

- Add explicit Match Participation scope.
- Build permission-controlled match projections.
- Extend the existing derived-memory pattern through a reusable projection boundary while keeping the first delivered projection specialised for matching.
- Include only approved and currently valid fields.
- Generate separate network-safe embeddings from match projections.
- Keep private Interaction, Want, Offer, and memory embeddings outside the network path.
- Rebuild or remove projections and embeddings after revocation or material source change.
- Version projection and scoring schemas.

Acceptance gate:

- The matcher cannot retrieve private source records.
- Revoked information no longer influences newly generated matches.
- Projection output is inspectable and explainable to the participant.
- Dating and Business scoring policies remain distinct.

### Stage 9.0 - Controlled domain-specific matching

Goal: use safe projections to recommend candidates while preserving human authority and progressive disclosure.

Deliverables:

- Domain-specific candidate generation and scoring.
- Explanation of fit, risk, uncertainty, and missing information.
- Human approval before outreach or Introduction.
- Offline evaluation against historical manual matches and Outcomes.
- Bias, safety, and false-confidence review.
- No silent profile rewriting from match results.

Acceptance gate:

- Match quality is measurably better than an agreed baseline.
- Recommendations remain explainable through permitted evidence.
- Identity remains hidden until the applicable disclosure stage.
- The system abstains when evidence is insufficient.

### Stage 9.1 - Conversational voice agent

Goal: improve callback completion and depth after the asynchronous voice workflow has proved valuable.

Deliverables:

- Realtime or conversational voice input.
- Core questions plus limited context-aware follow-up.
- No live canonical writes during the conversation.
- Completed transcript passes through the same post-call extraction, review, Outcome, and reconciliation pipeline.
- Clear disclosure that the participant is speaking with an AI system and how the recording is used.

Acceptance gate:

- Conversational voice improves completion or useful signal compared with asynchronous recording.
- Extraction accuracy is no worse than the established post-call baseline.
- Interruptions and incomplete calls do not create canonical Outcomes.
- The live agent cannot bypass consent, review, or disclosure rules.

### Stage 9.2 - Outcome learning and multi-app reuse

Goal: learn which match hypotheses and introduction practices lead to good outcomes without treating statistical correlation as personal truth.

Deliverables:

- Compare predicted match factors with both participant perspectives and whole-Introduction state.
- Preserve the distinction between individual benefit, relationship benefit, collective benefit, cost, burden, and policy-learning Outcomes.
- Separate person learning from matching-policy learning.
- Learn domain-specific factor performance.
- Detect missing factors and systematic overconfidence.
- Retain model and policy versions for each prediction.
- Reuse domain-neutral improvements in Business introductions and future apps.

Acceptance gate:

- The system can explain what changed in the matching policy and why.
- Policy learning does not silently alter canonical personal claims.
- Business and Dating outcome models share Core infrastructure without sharing private app data.

### Stage 9.3 - Fixed-participant Value Orchestration pilot

Goal: given a fixed pair or group, identify the permitted contributions and joint actions most likely to create value for each participant and for the collective relationship.

This is distinct from matching. Matching asks which people should connect. Value Orchestration assumes the people are already selected and asks what they could provide, receive, change, or work on together.

Core additions to consider from evidence:

- `RelationshipUnit` and `RelationshipUnitMember` for an ongoing dyad, partnership, team, family, or group.
- Group-level Objectives where an objective genuinely belongs to the collective rather than merely one member.
- Explicit beneficiary and potential provider direction for relevant Wants, Needs, Offers, capabilities, and proposed actions.
- Purpose-controlled multi-subject projections.
- Individual and collective Outcome perspectives.

App-owned pilot concepts:

- `ValueOpportunity`
- `ContributionPlan`
- `ContributionPlanOutcome`
- Domain-specific value categories and action templates
- Benefit, effort, cost, risk, fairness, reciprocity, confidence, capacity, and willingness scoring

The app must use multi-objective reasoning rather than collapsing every consideration into one unexplained score. Consent, safety, capacity, and hard constraints are eligibility boundaries, not merely negative weights.

Pilot sequence:

1. Select a fixed, consenting pair or small group.
2. Construct the minimum permitted multi-person projection.
3. Identify unmet Wants, Needs, constraints, and shared Objectives.
4. Identify Offers, capabilities, willingness, capacity, and conditions.
5. Propose individual, cross-participant, and joint Value Opportunities.
6. Explain expected beneficiaries, providers, effort, risk, uncertainty, and evidence.
7. Let a human review and approve a small Contribution Plan.
8. Record individual and collective Outcomes.
9. Compare predicted value with experienced value without rewriting personal truth automatically.

Acceptance gate:

- Every recommendation identifies who may benefit, who may bear cost, and whose permission is required.
- A participant's private information is neither exposed nor inferably disclosed through the explanation.
- The system can recommend no action when capacity, consent, fairness, or evidence is inadequate.
- Individual benefit cannot be hidden by a positive aggregate team score.
- Plan Outcomes trace back to the permitted evidence and policy version used.

### Stage 9.4 - Event Intelligence pilot

Goal: help a person or group identify the most relevant connections within an event, and later identify the events most likely to suit that person or group.

Initial directions:

1. Event fixed, people variable: recommend relevant attendees and possible introductions.
2. Person or group fixed, events variable: recommend suitable events.
3. Event and participants fixed: design a useful sequence of one-to-one or small-group connections.
4. Event completed: learn whether recommended people, sessions, and connections were actually useful.

Likely Event-app concepts:

- `Event`
- `EventParticipation` or attendee candidate
- agenda, session, location, organiser, source, and freshness metadata
- event-specific pre-event intake
- attendee recommendation and event recommendation
- networking plan or schedule
- event, meeting, and recommendation Outcomes

Architecture rules:

- An Event is an opportunity context, not a ContextSpace.
- A series of pairwise meetings may create separate Introductions. A multi-person meeting or event-wide result must not be forced into the dyadic Introduction model.
- Information gathered shortly before an event begins as encrypted, time-scoped, event-scoped evidence.
- Temporary event intent does not automatically become durable personal knowledge.
- Promotion into Claims, Wants, Offers, or Objectives uses the normal review and reconciliation path.
- Existing private embeddings do not enter attendee or event search directly. Only purpose-permitted projections may be used.

Pilot sequence:

1. Manually create or import one event and a limited attendee list.
2. Select one consenting user or small group.
3. Gather optional current objectives, availability, Offers, constraints, and sharing choices.
4. Construct a permission-controlled event projection.
5. Recommend a small set of attendees with mutual-value explanations and uncertainty.
6. Generate concise conversation briefs without disclosing private source material.
7. Record which meetings occurred and collect Outcomes.
8. Compare predicted relevance with experienced usefulness.
9. Only after attendee recommendation is validated, test ranking events for a fixed person or group.

Acceptance gate:

- Event recommendations distinguish relevance, access likelihood, time or travel cost, uncertainty, and predicted mutual value.
- Attendee recommendations do not reveal private Wants, Offers, or source statements.
- Expired or event-only evidence no longer influences later projections unless reviewed and promoted.
- Pairwise, small-group, and event-level Outcomes remain distinguishable.
- The pilot can abstain when attendee identity, consent, freshness, or evidence is insufficient.

## 8. Testing and safety requirements for every implementation stage

Every stage that changes runtime behaviour must include:

- Additive, forward-only migration where schema changes are required.
- No database reset.
- Existing Business regression stack.
- ContextSpace owner and custody isolation tests.
- Same-owner cross-context isolation tests.
- Agent data-access and tool-permission tests.
- Encryption round-trip and AAD compatibility tests for new encrypted fields.
- Plaintext leakage checks for agent JSON and logs.
- Approval and idempotent promotion tests.
- Revocation tests once consent exists.
- Source-to-projection traceability tests.
- Manual acceptance steps using non-sensitive test data before real participant data.

## 9. Data handling rules

1. Raw transcripts remain encrypted source evidence.
2. Agent audit JSON contains identifiers and redacted metadata, not raw Dating content.
3. Provisional extraction is encrypted and non-canonical.
4. Human review is mandatory during the pilot.
5. Per-observation privacy can be stricter than the feedback submission as a whole.
6. A statement about another person remains a perception unless stronger authority supports a different classification.
7. Private embeddings remain context-local.
8. Matchable embeddings are derived only from permitted match projections.
9. Summaries are replaceable projections and must retain source coverage and version metadata if cached.
10. Cross-context access is denied unless an explicit approved boundary exists.
11. Temporary event or activity intent remains time-scoped evidence until deliberately reviewed and promoted.
12. Aggregate group value never overrides an individual's consent, safety boundary, or separately visible cost.
13. Recommendation explanations disclose only what the applicable grants permit, even when undisclosed information influenced an approved private computation.

## 10. Build-versus-learn gates

Do not build the next layer merely because it appears in this roadmap.

- Do not build two-sided participant infrastructure until single-sided extraction is useful and trustworthy.
- Do not automate claim updates until human-reviewed reconciliation demonstrates acceptable accuracy.
- Do not build disclosure from imagined scenarios once real feedback can specify the required grants.
- Do not build automated matching before manual PotentialMatch records and Outcomes exist.
- Do not build network embeddings before projection and revocation rules are enforceable.
- Do not build live conversational voice until asynchronous voice proves the callback itself creates value.
- Do not build RelationshipUnit, contribution scoring, or optimisation before the Dating and Business Outcomes demonstrate which individual and collective distinctions are useful.
- Do not build a general Event platform before one manually controlled event pilot defines the required identity, attendance, freshness, and Outcome semantics.
- Do not generalise the dyadic Introduction merely to make a speculative future model look uniform.
- Do not split Core into microservices while a modular monolith and scoped Core APIs remain sufficient.

## 11. Initial pilot measures

Measures are provisional and may be adjusted before real recruitment.

### Extraction quality

- Exact Outcome-field accuracy before editing
- Unsupported inference rate
- Transcript-to-proposal traceability
- Reviewer edit rate
- Contradiction and uncertainty detection

### Participant experience

- Callback completion rate
- Time to complete
- Comfort with voice feedback
- Understanding of privacy choices
- Deletion or correction requests

### Learning value

- Percentage of callbacks producing a specific useful insight
- New versus reinforcing evidence
- Duplicate-claim avoidance
- Change in later match rationale
- Agreement and asymmetry across participant perspectives
- Difference between predicted individual benefit and experienced individual benefit
- Difference between predicted collective benefit and experienced collective benefit
- Recommendation abstention quality where evidence or permission is inadequate

### Safety

- Cross-context leakage incidents
- Unauthorised disclosure incidents
- Plaintext sensitive logging incidents
- Incorrect mutual-interest disclosures
- Revocation failures

## 12. Module direction

The current codebase remains a modular monolith initially.

Target conceptual layout:

```text
src/lib/core
  identity
  custody
  interactions
  knowledge
  relationships
  consent
  agents
  memory

src/apps/business
  leads
  deals
  broker-workflows
  business-agents

src/apps/dating
  feedback
  dating-memory
  potential-matches
  participant-experience
  dating-agents

src/apps/value-orchestration
  relationship-units
  value-opportunities
  contribution-plans
  value-outcomes

src/apps/events
  events
  attendance
  attendee-recommendations
  event-recommendations
  networking-plans
```

This is a direction, not permission for a large file-moving exercise. New work should respect the boundary, and existing code should move only when required by a real change.

## 13. Decisions intentionally deferred

- Whether provisional observations require a dedicated durable table
- Whether ContextSpace display names must be encrypted
- Whether Dating is a route group, separate frontend, or later separate deployment
- Whether participants need full Relish accounts during the early pilot
- Exact retention period for raw voice recordings and transcripts
- Exact matching algorithm
- Exact live voice provider
- Whether cached memory summaries are necessary before histories become large
- Whether claim relationship and temporal fields should be generic Core concepts or added only after observed cases
- Whether `RelationshipUnit` becomes a Core model or begins inside the first Value Orchestration app
- Whether multi-party meetings justify a domain-neutral activity and participation model
- Whether future Outcomes use a domain-neutral envelope or remain specialised by activity type
- Exact benefit, cost, fairness, and reciprocity dimensions for Value Orchestration
- Exact Event and attendance sources, identity resolution rules, and freshness thresholds

Each deferred decision must be resolved from real usage, privacy analysis, and operational need rather than architectural imagination.

## 14. Completion definition

This roadmap is successful when:

- Business and Dating use the same Core without reading each other's contextual data.
- Source evidence remains durable, encrypted, and traceable.
- AI interpretation is flexible and replaceable.
- Exact operational state remains structured.
- Memory is purpose-specific and permission-controlled.
- Participants control computational use and disclosure.
- Matching uses approved projections rather than raw private records.
- Outcomes improve future recommendations without silently becoming personal truth.
- Dyadic Introductions remain useful without limiting multi-party relationships, activities, or events.
- Fixed pairs and groups can receive consent-controlled Value Opportunities without collapsing individual welfare into one score.
- People can receive event and attendee recommendations without exposing private source knowledge.
- Future relationship applications can reuse the same Core primitives without forcing their domain concepts into Business or Dating schemas.
