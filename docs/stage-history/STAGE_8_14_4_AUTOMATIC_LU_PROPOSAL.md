# Stage 8.14.4 - Automatic Living Understanding Proposal

After a trusted ElevenLabs conversation has been stored and attached to a participant with an existing authoritative Living Understanding, Relish now automatically prepares the complete longitudinal proposal pipeline:

1. Impact analysis
2. Topic proposal
3. Semantic validation
4. Bounded repair
5. Final candidate revision

Each stage is retained inside the encrypted, custody-bound `LivingUnderstandingDraft` and is inspectable from the impact-review screen through collapsible panels.

The automatic path does **not** approve or persist authoritative knowledge. Final approval remains an explicit operator action for the pilot.

The post-call webhook exits the restricted external-ingest custody boundary before running the model pipeline, then enters the already-resolved workspace ContextSpace using normal same-owner custody. Failure of automatic proposal generation is fail-soft: the transcript remains imported and the existing manual review path remains available.

`LU_AUTO_PREPARE_AFTER_INGEST=NO` disables automatic preparation. It is enabled by default in this stage.

No Prisma migration is required because the existing encrypted `LivingUnderstandingDraft.stateEnc` payload now retains the extra pipeline state.
