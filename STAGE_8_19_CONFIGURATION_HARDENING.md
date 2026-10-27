# Relish Stage 8.19 Configuration Hardening Update

**27 October 2026**  
**Base:** Stage 8.19 Dorian First Contact Onboarding  
**Type:** Configuration-only source update  
**Prisma migration required:** **No**

## 1. Two environment-variable renames

| Previous name | New required name | Used for |
|---|---|---|
| `ELEVENLABS_WEBHOOK_SECRET` | **`ELEVENLABS_POST_CALL_WEBHOOK_SECRET`** | ElevenLabs signed post-call webhook verification |
| `RELISH_ELEVENLABS_TOOL_SECRET` | **`ELEVENLABS_TOOL_SECRET`** | ElevenLabs tool `Authorization: Bearer ...` verification, including preferred-name and policy-acceptance tools |

The application no longer accepts the previous names. The legacy `POST_CALL_WEBHOOK_SECRET` fallback was also **removed**. `ELEVENLABS_INITIATION_SECRET` has **not** been renamed.

**Use the same existing secret *values*, but under the new names.** Do not generate new secret values unless you deliberately plan and coordinate a rotation. The post-call signature secret is supplied by ElevenLabs, while the tool secret is a shared bearer credential that you configure at both ends. Keep initiation, tool, and post-call secrets distinct.

### Local `.env`

Rename your existing entries. Do **not** keep duplicate old keys and new keys:

```dotenv
ELEVENLABS_POST_CALL_WEBHOOK_SECRET=<existing post-call signing secret>
ELEVENLABS_TOOL_SECRET=<existing ElevenLabs tool bearer secret, without Bearer prefix>
ELEVENLABS_INITIATION_SECRET=<existing initiation secret, unchanged>
```

### Railway environment variables

Rename both keys in every affected Relish application environment (dev and production), not just the proxy. Apply/deploy the changed Railway variables along with the matching code; deploying before renaming causes deliberate startup failure. You should not need to change the existing ElevenLabs tool header value if the underlying tool-secret value hasn't changed.

### ElevenLabs tools

Both **record_relish_policy_acceptance** and **save-preferred-name** continue to send:

```text
Authorization: Bearer <existing ElevenLabs tool secret>
```

The tool HTTP header and body structure are unchanged, as is the initiation webhook configuration. Only the key name used inside the Relish `.env` / Railway environment changes.

## 2. Fail explicitly rather than silently use defaults

Agreed. This update removes the particularly hazardous defaults, and adds an explicit startup validator: `scripts/validate-required-env.mjs`.

It checks the following **every time Relish starts through `npm run dev` or `npm start`**:

- `DATABASE_URL`
- `SECRET_MASTER_KEY`: exactly 64 hexadecimal characters
- `SESSION_COOKIE_SECRET`: at least 24 characters, with **no** `'dev-secret'` fallback
- `SESSION_DAYS`: a positive integer (previously defaulted to 30)
- `LOGIN_THROTTLE_SECRET`: at least 24 characters, with **no** development fallback
- `APP_ORIGIN`: a valid absolute HTTP(S) URL
- `DB_KEEPALIVE_MINUTES`: positive integer **if** DB keepalive is explicitly enabled

If either `RELISH_PILOT_SMS_CALLBACK_ENABLED=YES` or `RELISH_PILOT_CONVERSATIONAL_TERMS=YES` is configured, **both must be YES**, and startup additionally checks:

- `ELEVENLABS_INITIATION_SECRET`
- `ELEVENLABS_POST_CALL_WEBHOOK_SECRET`
- `ELEVENLABS_TOOL_SECRET` (at least 24 characters)
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID`
- `ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS`: positive integer (for example `1800`)
- `TELNYX_API_KEY`
- `TELNYX_PUBLIC_KEY`
- `RELISH_DORIAN_SMS_NUMBER`: E.164 format such as `+614...`
- `RELISH_NETWORK_DORIAN_BINDING_ID`
- `RELISH_PILOT_TERMS_VERSION`
- `RELISH_PILOT_TERMS_URL`, `RELISH_PILOT_PRIVACY_URL`: HTTPS URLs
- `TELEPHONY_DEFAULT_COUNTRY`: for example `AU`
- `LU_AUTO_PREPARE_AFTER_INGEST`: explicitly `YES` or `NO`

The validator reports **variable names**, not credential contents. For example:

```text
[Relish startup configuration] Missing: ELEVENLABS_POST_CALL_WEBHOOK_SECRET, ELEVENLABS_TOOL_SECRET
```

The process exits with a nonzero status before the web app starts.

### More runtime defaults removed

- The post-call webhook **cannot** silently verify with `POST_CALL_WEBHOOK_SECRET`.
- Signing of session and invite tokens never uses `dev-secret` or `change-me`.
- Google OAuth no longer assumes `http://localhost:5173/auth/google/callback` when `OAUTH_REDIRECT_URI` is absent.
- Magic links no longer assume a localhost origin when `APP_ORIGIN` is absent.
- The ElevenLabs test harness no longer fills in a fixed test participant or public ngrok hostname. Set `ELEVENLABS_TEST_PERSON_ID` and `ELEVENLABS_TEST_PUBLIC_ORIGIN` if you use that development harness.
- The relevant AI features require explicit `AGENT_DEFAULT_MODEL`, `DATING_REVISION_MODEL`, `DATING_KNOWLEDGE_MODEL` and `RESEARCH_OPENAI_MODEL` instead of silently selecting `gpt-4o-mini`.
- The Research Gateway does not infer a provider from whichever API key is present. Configure `RESEARCH_PROVIDER=none|tavily|brave|openai` when using it.
- Phone-number parsing no longer silently assumes Australia. Set `TELEPHONY_DEFAULT_COUNTRY=AU` if appropriate.
- DB keepalive requires an explicit interval when enabled.

Some **intentional** optional behaviours remain: an optional feature set to `NO` remains disabled, an empty operator allowlist denies access, and non-secret business rules such as invitation expiry retain their defined constants. A missing configuration for an optional feature not in use need not take down unrelated features. That is different from silently substituting a missing *required* secret.

## 3. What to add to your local `.env`

Check these values **in addition to your existing environment variables**:

```dotenv
# Existing values moved under the new names
ELEVENLABS_POST_CALL_WEBHOOK_SECRET=<your current post-call signing secret>
ELEVENLABS_TOOL_SECRET=<your current ElevenLabs tool secret>

# Required startup settings: preserve existing key values where already configured
SESSION_COOKIE_SECRET=<your current session signing secret, at least 24 characters>
SESSION_DAYS=30
LOGIN_THROTTLE_SECRET=<24+ character dedicated throttling secret>
APP_ORIGIN=https://creative-basilisk-painfully.ngrok-free.app

# Required for enabled Stage 8.19 telephone onboarding
TELEPHONY_DEFAULT_COUNTRY=AU
ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS=1800
LU_AUTO_PREPARE_AFTER_INGEST=YES
```

**Never change `SECRET_MASTER_KEY` casually.** Relish derives its encryption and lookup-index keys from it; a rotation without a coordinated migration will break stored encrypted data and deterministic indexes. Likewise, rotating `SESSION_COOKIE_SECRET` invalidates existing signed sessions/tokens. The update requires **renaming** two variables, not rotating their values.

## 4. Install and test locally (PowerShell)

1. Back up your current Relish source and keep your existing `.env` file safe.
2. Extract the **complete source ZIP** into your development project.
3. Rename the two environment variable keys in your **existing** `.env`; do not paste secrets into chat.
4. Add any newly required explicit settings listed above.
5. From your Relish project directory:

```powershell
# Validate before the application starts; prints missing names, not values.
node --env-file-if-exists=.env scripts/validate-required-env.mjs

# Run with your existing ngrok tunnel on port 8080.
npm run dev -- --host 0.0.0.0 --port 8080
```

**Prisma migration:** None for this update. You do **not** need to run `npx prisma migrate dev` again if Stage 8.19's prior migration has already been applied. No local build step is required.

### Railway rollout order

1. Add the **new** names and existing values to each affected Relish Railway service.
2. Deploy the matching updated application code and verify successful startup.
3. Remove the **old** variable keys after verifying. The current code never uses them.
4. Test initiation, tool authorisation, post-call transcription and the returning-caller flow separately.

If Railway reports an invalid or missing configuration, **fix the named variable**. Do not reintroduce an alias or a built-in default.

## 5. Validation performed

- 106/106 focused onboarding and phone-identity source-contract tests passed.
- 11/11 focused ElevenLabs HMAC and direct-ingestion tests passed.
- Updated runtime configuration code syntax was checked with Node 22's TypeScript stripping, and the startup validator syntax was checked.
- Not run here: full SvelteKit dependency-based typecheck, production startup against real Railway configuration, Neon migration or live ElevenLabs/Telnyx call.

No proxy source changes and **no Prisma schema changes** were required. The previous abandoned `20261019153000_stage8_15_4_7a_verified_phone_custody` migration remains excluded.
