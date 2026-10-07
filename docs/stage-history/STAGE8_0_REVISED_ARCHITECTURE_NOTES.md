# Stage 8.0 Revised - Release Notes

This is the final Stage 8.0 architecture contract before Stage 8.0.1 and Stage 8.1 coding.

## What changed from the first 8.0 draft

- Relish is now explicitly the only live-data migration anchor.
- The old Dorian backend is frozen reference material only. No Dorian data migration, dual-write or compatibility work is planned.
- Temporary compatibility now requires a named retirement target and acceptance criteria.
- Stage 8.1 `Person` must subsume the existing `Contact.linkedUserId` identity bridge rather than create a parallel identity system.
- Stage 8.3 becomes a Want/Offer consolidation and ExchangeItem retirement release, not another additive intent model.
- Agent relationship-data access begins moving behind scoped Core repositories in 8.1.
- Minimal Introduction and Outcome move forward to 8.2 so real connection results are captured before automated matching.
- Embeddings are explicitly treated as sensitive derived information. Future network embeddings must be generated from permitted match projections.
- Stage 8.0.1 test scope now matches the real approval/staging behaviour in the codebase.
- Workspace can temporarily pause during structural work if that helps eliminate compatibility debt, but Relish data continuity remains mandatory.

## Runtime impact

None.

No Prisma schema change.
No migration.
No application behaviour change.

The package differs from the supplied Relish baseline only by Stage 8.0 documentation files.
