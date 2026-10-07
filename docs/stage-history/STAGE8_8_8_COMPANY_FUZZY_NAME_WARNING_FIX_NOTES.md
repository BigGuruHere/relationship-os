# Stage 8.8.8 - Company Fuzzy Name Warning Fix

## Purpose

Stage 8.8.7 described Company-name duplicate warnings as catching similar names, but its implementation only matched names that became identical after conservative normalisation, such as legal-suffix removal. It did not catch ordinary spelling mistakes such as `Coca Cola` vs `Coka Cola`.

Stage 8.8.8 fixes that gap without changing Company identity rules.

## Behaviour

The Company creation duplicate warning now recognises close spelling variants using a small dependency-free typo-distance helper.

Examples that warn:

- `Coca Cola` vs `Coka Cola`
- `Coca Cola` vs `Coac Cola`
- `ABC Training Pty Ltd` vs `ABC Training`
- `Melbourne Training Institute` vs `Melbourne Trainng Institute`

Examples deliberately not treated as fuzzy matches:

- `Coca Cola` vs `Coka`
- `Coca Cola` vs `Cola`
- `ABC Health` vs `ABC Healthcare`

Short fragments and loose substring matches remain quiet because they would produce too many false positives.

## Safety rule unchanged

A fuzzy or similar Company name is a warning only. The user may still choose **Create anyway**.

Only authoritative external-identifier collisions, such as the same ABN, ACN or register identifier, remain hard duplicate blocks.

No automatic Company merge was introduced.

## Database impact

None.

- Prisma schema unchanged from Stage 8.8.7.
- Existing migration SQL is byte-for-byte unchanged.
- No migration is added by Stage 8.8.8.

## Verification

Focused Stage 8.8.1 through 8.8.8 regression checks passed: 42/42.

A mutation proof temporarily disabled fuzzy matching. The Stage 8.8.8 tests failed on the expected spelling/transposition cases, then returned to green after restoration.

The isolated package copy does not contain installed npm dependencies, so `npm test` could not start there because `tsx` was unavailable. Run the normal project checks after installing into the development checkout.
