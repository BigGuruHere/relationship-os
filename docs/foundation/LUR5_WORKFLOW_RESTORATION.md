# LUR-5 Foundation LU workflow restoration

Implemented on `feature/lu-workflow-restoration` from Development `54f17bc1`. Hosted model replay and deployment are pending. This stage adapts the earlier Brokerage LU behaviour to the existing Foundation self-topic path.

## Existing capability and gap

The older phone flow (`brokerage-relish` at `70649f51`) automatically creates and updates LU through semantic discovery, focused writing and structural validation. Its longitudinal service explicitly assesses every saved topic. Foundation already reuses the semantic prompts, validators, versioned evidence, private storage and Dorian call worker. Its v8 self-topic path selected affected topics by discovery and supported prose repair and one draft merge.

## Implemented behaviour

- v9 discovery returns an explicit impact disposition for every eligible saved self-topic. The server checks completeness, unique identities, owner-turn evidence and agreement with affected areas. Missing or inconsistent dispositions get the existing bounded discovery correction.
- The writer must honour the reviewed effect. Reinforcement retains accepted prose and temporal scope while adding evidence. Contradictions retain prior meanings; explicit supersession remains subject to the existing retirement checks. Other perspectives retain their existing path.
- Structural review can return a complete replacement structure for new draft topics, allowing splitting, narrowing, moving, merging, renaming and reclassification. Every draft assertion must map exactly once to a proposed topic. Unknown, duplicate, missing or saved-topic assertion references fail validation. Evidence objects and original assertion-generation provenance survive mapping. Topic prose generation is recorded in the assessment invocation history.
- This uses Foundation assertion references instead of copying the older draft-excerpt schema. Coverage of mapped assertions is deterministic. Preservation of additional prose nuance and semantic fidelity still require the independent model audit against the transcript, prior meaning and original drafts.
- Reorganising already saved identities is outside this slice. Their updates remain attached to the same identities and exact prior versions. Structural operations apply to new drafts, including new topics discovered during later calls.
- Duplicate draft labels or exact prose can reach structural repair. The deterministic candidate validator must pass before any candidate can be returned; an auditor's PASS cannot override it.
- Original drafts remain available to every subsequent audit to catch dropped details. Qualification and temporal-loss findings can use targeted repair. The writer is instructed to retain supported details in readable prose and assertions.
- One structural remapping is followed by independent audit. Existing bounded targeted repairs remain available, within the shared assessment deadline. Unresolved failures remain held.
- v7/v8 checkpoints are not resumed under the changed discovery contract. The next queued analysis regenerates discovery/writing as v9. v9 checkpoints retain the existing encrypted, source/baseline-bound resume behaviour. Existing saved revisions and candidates remain readable.

## Validation

Local verification passed 82 LU contract, semantic, self-topic and isolated persistence/route checks, plus 19 legacy structural checks. After the final repair-history change, all 28 self-topic checks passed again. Svelte check reported zero errors and zero warnings. GitHub CI results belong to the PR.

Synthetic checks cover initial and later conversations, structural splitting/reclassification, mapping coverage, source evidence and model provenance, saved-identity exclusion, mandatory re-audit, deterministic duplicate rejection, reinforcement, contradiction, effect disagreement and checkpoint compatibility. A reduced product-vision replay covers inventor role, reciprocal QR exchange, desired connections, aspirational scope, excitement/challenge ambiguity and the requirement for basic mutual liking. Scripted model outputs test orchestration, not model quality.

The Foundation persistence/route suite exercises two revisions, approval, historical snapshots, withdrawal, source/baseline binding and three-perspective compatibility using an isolated PGlite database and synthetic model responses.

Live comparison is pending because this workspace has no configured OpenAI credential or LU model. On DEV, queue the held product-vision source once to run v9, inspect the final candidate and evidence, then approve and make a follow-up call with an explicit refinement or contradiction. Compare retained meaning and next-call context. Repeat on varied conversations before changing activation policy. No per-transcript prompt changes are part of this workflow.

## Migration, rollout and rollback

No Prisma migration, configuration change or account activation is required. Existing DEV Dorian and owner-review gates apply. Operator approval remains required before candidate meaning enters continuity. Legacy LU, the three-perspective experiment and existing phone routing retain their services.

Rollback is application-only by reverting the PR. No data backfill or destructive migration is introduced. Record merge SHA, deployed SHA and live acceptance separately when performed.
