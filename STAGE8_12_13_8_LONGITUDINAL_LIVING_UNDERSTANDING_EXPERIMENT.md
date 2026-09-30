# Stage 8.12.13.8 - Longitudinal Living Understanding experiment

## Purpose

This development-only, read-only stage tests whether a later private conversation or reflection can evolve an earlier experimental Living Understanding without silently losing prior meaning.

## What changed

- The first-source semantic revision result now offers a later private source for the same person when one exists.
- Later sources are restricted to the same user, Dating ContextSpace and person, and must occur after the baseline source.
- Every prior topic target must receive exactly one longitudinal effect:
  - UNCHANGED
  - REINFORCED
  - REFINED
  - EXPANDED
  - QUALIFIED
  - CONTRADICTED
  - SUPERSEDED
- Absence from the later source is explicitly not treated as contradiction or supersession.
- Topic changes require target-speaker turn evidence.
- A later source may suggest a genuinely new topic when it does not fit any prior topic target.
- Every prior independently controllable knowledge unit must also be explicitly accounted for. It may be UNCHANGED, REINFORCED, REFINED, POTENTIAL_CONFLICT or POTENTIAL_RETIREMENT.
- New operational units remain selective and require an operational reason plus target-speaker evidence.
- The result shows previous understanding, proposed current understanding, effect, reason and exact later-source evidence.

## Privacy and authority

Nothing in this experiment is saved, confirmed, retired, made discoverable or made shareable. Browser-carried experimental state is revalidated and both source interactions are re-authorised against the same person and active Dating custody before use.

## Database

No migration is included and no database schema change is required.

## Verification performed in the packaging environment

- Changed TypeScript server files passed Node 22 type-stripping syntax checks.
- The revision policy module passed JavaScript syntax checks.
- Focused Stage 8.12.13.7/8 experiment tests passed 17/17.
- All core `.test.mjs` tests passed 151/151 with Node type stripping.
- `npm test` was attempted but could not start because this packaging environment does not have the project dependency `tsx` installed.
- Live model calls, Svelte compilation, full project check/build, database tests and browser acceptance were not available in the packaging environment.
