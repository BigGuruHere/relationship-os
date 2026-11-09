# Production exchange and recovery

Implemented on `feature/production-account-exchange` from Development `ff3b4066`. Local verification covered 87 focused checks, including isolated PostgreSQL-compatible databases with simulated providers, plus Svelte diagnostics and a Chromium reset-form smoke test. Hosted delivery, phone imports and rollout remain pending.

## Password recovery

**Forgot password?** is available from sign-in. Resend delivers a 30-minute link to the account's stored login mailbox. The browser takes the credential from the link fragment and sends it in a same-origin POST. Recovery stores only a purpose-specific token HMAC and a fingerprint of the current password and email index. Completion updates the password, consumes outstanding reset tokens and revokes existing sessions in one transaction. The user then signs in normally. Google-only accounts keep their existing sign-in method. A reset is separate from profile publication and channel verification.

Apply `20261109070000_password_reset` before running the new code. The migration adds one table and performs no backfill. Old readers tolerate the new table. Development reset email uses the existing DEV email recipient list. Production uses the configured Resend API key and verified sender. Keep Resend link tracking off for reset links so the link fragment reaches the browser directly.

Request budgets are separate from sign-in, keyed by IP and destination, and capped globally. The response is generic for valid-format addresses. Provider failures are logged without addresses, codes or tokens. Test a known and unknown address, expired or reused links, Google-only sign-in, and the effect on another signed-in device.

## Verified exchange rollout

Activate production only after reviewing the target migrations and confirming real provider delivery in DEV. On the production runtime set:

| Setting | Required value |
| --- | --- |
| `RELISH_PROD_EXCHANGE_ENABLED` | `YES` to enable the production exchange and channel settings |
| `RELISH_PROD_EXCHANGE_TARGET` | Intended production database host and database path, with no credentials or query |
| `RELISH_EXCHANGE_REALM` | Stable production-specific identifier, distinct from DEV |
| `RESEND_API_KEY`, `RELISH_VERIFICATION_EMAIL_FROM` | Production Resend key and verified sender |
| `TELNYX_API_KEY`, `RELISH_DORIAN_SMS_NUMBER` | Production Telnyx key and SMS-enabled sender |

The production gate also checks the canonical HTTPS origin and runtime environment. Production v2 uses the existing exact-submission proof, session, private-vault and rate-limit rules with ordinary destinations. DEV keeps its destination allowlists and the v1 delivery protocol remains DEV-only. The existing SMS number format is Australian mobile. Send failures preserve the pending exchange and saved details. The gate can be disabled while retaining schema and private evidence. Review provider capacity against the existing shared request budgets before wider use.

Use two fresh accounts for the approved smoke test. Check password signup plus email, Google proof reuse, a phone-only submission plus SMS, a different login email staying private, reciprocal entries, and refusal when proof or session authority is absent.

## Phone contact export

Public profile, event and QR downloads retain the Relish profile link. Public website and valid social/custom links are exported as standard vCard URL properties, including X handles converted to web links. Test a fresh import in iPhone Contacts and Google Contacts and reopen the saved entry to check which URLs each retains.
