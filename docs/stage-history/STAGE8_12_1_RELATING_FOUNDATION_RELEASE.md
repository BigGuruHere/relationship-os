# Stage 8.12.1 - Relating foundation

This release completes the mandatory architecture decision and introduces a small, additive persistence foundation. It does **not** deliver group invitations, shared group profiles, live multi-person conversations or independent per-touchpoint reflections yet.

## Implemented

- `Relating` as a private, owner/ContextSpace-custodied history container. It never represents AI-certified affinity, a mutual relationship, or disclosure permission.
- Unlimited `RelatingParticipant` memberships. No fixed A/B/C columns or group-size limit.
- Independent `Touchpoint` records, with optional link to one Relating group.
- `TouchpointParticipant` attendance lists independent of group membership. Guests can attend individual events without joining an ongoing group.
- Optional link from existing `Introduction` to its Relating history. Old introductions are backfilled into private containers; surviving legacy participants get membership records. Old reflections/Outcomes are unchanged.
- Future two-person Introduction creation now persists its private Relating group and original A/B introduction participants in one transaction.
- Composite owner/context foreign keys, custody triggers, Contact/Company scope guards and mismatch guards for attendees referencing a different group.
- Existing ContextSpace Prisma middleware now scopes all four models.
- A minimal server-side Relating and Touchpoint service. It is not exposed as a public route.
- An architectural decision record and a firm next-stage gate before expanding Dating touchpoints.

## Compatibility and limitations

- This release adds **one forward migration**, bringing the total to 79. Do not skip it.
- Existing `IntroductionParticipant.side` remains A/B for the current dyadic Dating pilot; this is no longer the universal participant structure.
- The new group record is not jointly owned by everyone named in it. Cross-owner linking and sharing need future explicit grants.
- No historical meeting is inferred from old introductions. A planned introduction is wrapped as a **private administrative history**, not counted as an actual interpersonal connection.
- New membership rows require a custody-local Contact and/or Company. Physical attendees not in Relish must be created as permitted contacts first. No global dossier.
- Existing participant rows with both linked Contact and Company missing remain in their original Introduction but cannot be automatically mirrored into group membership.
- Contact or Company deletion cascades to its newly associated memberships and direct attendances. Recorded Introduction and Touchpoint event rows remain; deleted identity references are not retained as hidden personal dossiers. More detailed participant-redaction history remains future work.
- Current schema stores `joinedAt` and optional `leftAt`; relationship states and independently confirmed group commitments are not implemented. Historical updates and membership-change audit UI remain future work.
- Unresolved prior security audit findings still prevent a broader external sensitive-data pilot.

## Validation completed here

- Structural tests for unlimited participation, independent attendance, migration preservation, custody middleware and deliberate non-sharing.
- Selected previous-stage source regression checks.
- Node syntax checks of new scripts and services.
- Original migrations and Catalina-compatible dependency lockfile retained.

**Not completed here:** Prisma validation, full Svelte/TypeScript check, production build and PostgreSQL integration testing. npm registry connectivity was unavailable in this environment, and no user database was accessed. Complete the install/test document on your Mac; do not deploy until the new migration and tests pass.
