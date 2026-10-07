# Stage 8.10.2 - Password login repair and shared attempt throttling

Baseline: uploaded Stage 8.10.1. This release adds a single forward-only migration and does not change any prior migration or ContextSpace model.

## Changes

- Correct `verifyPassword(user.passwordHash, password)` in the password login route.
- Before looking up credentials, consume PostgreSQL-backed, atomic budgets for both a trusted client IP (30 requests/15 minutes) and normalized account email (8 requests/15 minutes). Budget consumption is independent of whether the email exists. The 31st/9th attempts return HTTP 429. These are rolling-from-first-attempt fixed windows, not sliding windows; requests over the cap do not extend the window.
- HMAC keys only in the throttle table, with purpose-separated IP/account keys. `LOGIN_THROTTLE_SECRET` is optional when `SESSION_COOKIE_SECRET` is configured; consider setting a separate stable secret in production. Keep the secret stable across deploys and all instances. Rotating it invalidates current throttle budgets.
- Clear an account budget after successful session creation, keeping the IP budget. A successful sign-in does not reset IP throttling.
- No permanent account lockout or plaintext log of attempted passwords.
- No change to the Google OAuth callback limiter in this bounded release. Its in-memory design remains a separate follow-up.

## Deployment order (no database reset)

1. Back up the live DB as usual. Review `.env` and verify a strong `SESSION_COOKIE_SECRET` is configured. Optionally configure `LOGIN_THROTTLE_SECRET` consistently on all instances. **Do not set a fresh secret separately per instance.**
2. Replace the project source with this package, preserving the actual deployment `.env` and any platform secrets.
3. `npm ci` (or `npm install` if your environment requires it).
4. `npx prisma migrate deploy` (new migration `20260924120000_stage8_10_2_password_login_throttle` only). Never run migrate reset.
5. `npx prisma generate`
6. `npm run check:stage8.10.2` and `npm run check`; `npm run build`.
7. Deploy the updated application only after migration succeeds. Until the table exists, the login action fails closed if deployed out of order.

The authenticated user's session continues to use the existing signed, hashed-token session design. No existing sessions need invalidation.

## Database integration verification

Set `TEST_DATABASE_URL` to a separate disposable migrated PostgreSQL DB, different from `DATABASE_URL`. Set `ALLOW_DISPOSABLE_LOGIN_TEST=YES` after checking the test URL, then run `npm run check:stage8.10.2:db`. This checks both thresholds and concurrent requests against actual SQL. It **deletes only its test throttle rows in the disposable test database** and must never be run on a shared or production database.

## Manual HTTP smoke test against a local app with the migration applied

1. Create or use a known test user with a valid password. Log in successfully with the real browser form and verify a session cookie and access to an authenticated page.
2. Log out and verify the session cannot be reused. Submit a wrong password and an unknown account. Both should return the same generic credential error.
3. Send 9 bad attempts for one account, from fresh/varied test IPs in a properly configured test proxy if available. Expect the account budget to block the ninth with HTTP 429.
4. Send 31 attempts using different accounts from one test IP. Expect the IP budget to block the 31st.
5. Check an isolated test account after its 15-minute window expires: successful login should work; a new budget begins.
6. Test signed-cookie expiry with a short session duration **in a disposable environment only**. Verify the server rejects expired sessions.
7. Test two server instances against the same disposable DB (optional), verify they share a budget.

The new automated unit tests check key handling and route/SQL contracts. They are **not** a substitute for the database or end-to-end HTTP checks. They do not prove full deployed authentication behaviour.

## Operations and limitations

Use SvelteKit's `getClientAddress()`, which depends on the adapter/proxy's trusted address configuration. For adapter-node behind Railway/a reverse proxy, explicitly verify `ADDRESS_HEADER` and `XFF_DEPTH` against the platform's **trusted** proxy topology. Never derive client IP from unchecked user-supplied X-Forwarded-For. If the address cannot be resolved, the login action fails closed instead of bypassing IP throttling.

Expired rows remain until cleanup. Schedule a modest recurring maintenance SQL operation outside request handling, such as `DELETE FROM "PasswordLoginThrottle" WHERE "expiresAt" < NOW() - INTERVAL '1 day';`. Never log raw passwords. Monitor spikes in HTTP 429 and database availability. If the database is unavailable, login will fail rather than bypass throttling.

Account-budget exhaustion creates a temporary 15-minute denial-of-login possibility for a targeted email; it is bounded, not permanent. Consider additional distributed edge-level protection when running a public pilot. Existing in-memory Google callback throttling is not changed here.
