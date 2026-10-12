# Stage 8.14.2.5 - ElevenLabs HMAC diagnostics

## Purpose

Align post-call webhook verification with ElevenLabs current HMAC scheme and make development failures diagnosable without exposing secret material.

## Changes

- Verifies `ElevenLabs-Signature` as `t=<unix>,v0=<HMAC-SHA256>`.
- HMAC input remains the exact raw request body prefixed by `<timestamp>.`.
- Default timestamp tolerance is 30 minutes, matching the ElevenLabs SDK behaviour.
- Logs safe failure reason, timestamp age, signature scheme, and which env variable supplied the secret.
- Keeps `ELEVENLABS_WEBHOOK_SECRET` as canonical and supports legacy `POST_CALL_WEBHOOK_SECRET` only as a fallback.
- Trims the configured secret before verification.
- Changes the test harness default participant UUID to `e7b6f115-780d-411b-a68f-1ad3b19364e6`.
- Retains the Stage 8.14.2.4 configurable Vite/ngrok allowed-host support.

## Security

No secret, signature digest, or expected HMAC is written to logs. A `HASH_MISMATCH` still results in HTTP 401.
