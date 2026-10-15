# Stage 8.15.4.4b - Google-first onboarding, automatic connection and one-sided Network removal

Migration required: **YES**.

Migration: `20261015100000_stage8_15_4_4b_network_visibility`

## Behaviour

- The Network join page offers Continue with Google first, then email account creation and existing login.
- After deliberate Connect selection on a Personal public profile, successful login or Google registration returns to the join page; a browser-triggered form POST completes the relationship without a second confirmation click. The action is still POST, not a mutating GET. If Javascript is blocked, Continue connection remains available.
- A participant can Remove from my Network. This stores a per-user suppression record; it does not delete contacts, connection origin, other party's view, notes or Living Understanding.
- The removed person can be restored to the same participant's Network by visiting their Personal public profile and choosing Connect again. The original attribution and both Contact rows remain stable.
- Private and Business public profile flows remain separate. No automatic third-party data-sharing permissions are introduced.

## Local commands

```
npx prisma migrate dev
npx prisma generate
npm run check:stage8.15.4.4b
npm run check:stage8.15.4.4a
npm run check
```

Stop if Prisma asks to create an *additional* unexpected migration. Do not edit earlier migrations.

## Manual tests

1. Sign out; open A's Personal profile as a new user in an incognito window. Select Connect. Confirm Google is the first and primary option; Google signup returns and connects without a second click.
2. Repeat with email registration and with existing password/Google login; confirm both link to the intended A account, not an unrelated profile.
3. Confirm A and B appear in one another's Network; confirm a second scan does not duplicate contact/origin records.
4. As B, select Remove from my Network for A; B no longer sees A after refresh, but A still sees B. B's General Contact for A and A's General Contact for B remain unchanged.
5. As B, visit A's public Personal profile, choose Connect, and confirm A reappears in B's Network without a duplicate origin record.
6. Confirm ordinary member cannot remove arbitrary user relationships by submitting an unrelated otherUserId; owner, member and guest access rules still apply.
7. Confirm Business profile connection and old QR flows are unaffected.

## Verification scope

Node source tests passed for this stage (4), previous Google stage (3), and onboarding stage (4). No database-backed integration test, Svelte compiler check, production migration or real browser OAuth test was executed in the packaging environment. Run local checks and browser tests before deploying production.
