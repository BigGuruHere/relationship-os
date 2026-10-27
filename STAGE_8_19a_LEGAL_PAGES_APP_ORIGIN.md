# Stage 8.19a - Single Relish Legal Page, Derived from APP_ORIGIN

**Date:** 27 October 2026  
**Baseline:** Stage 8.19 Configuration Hardening complete source  
**Prisma migration required:** **NO**  
**SMS proxy change:** **NO**

## Purpose

Publish one plain-English Terms & Privacy information page for first-call onboarding, plus accessible full Terms and Privacy documents. **All three URLs derive solely from `APP_ORIGIN`**, so Git carries the same legal content from your local development application to production, and each deployment automatically uses its own public origin.

The introductory SMS now includes **only one legal URL**: `APP_ORIGIN` + `/legal`. The existing voice consent webhook, stored policy version, contact privacy rules and returning caller flow are preserved.

## 1. Paths and source documents

| Item | Route | Source to edit and commit |
|---|---|---|
| Plain-English overview | `/legal` | `src/routes/legal/+page.svelte` |
| Full Terms | `/legal/terms` | `src/lib/legal/documents/terms.md` |
| Full Privacy Notice | `/legal/privacy` | `src/lib/legal/documents/privacy.md` |

The full policy pages import `.md` using Vite's `?raw` bundling. **The Markdown files are part of the Git repository and compiled into the deployed app.** No remote document host, database table, manual file upload or production filesystem copy is needed.

The renderer displays headings, paragraphs and bullets as escaped content (not injected HTML). Keep Markdown limited to that supported formatting; do not assume Markdown links or advanced syntax will render.

**The included Terms and Privacy files are deliberately DRAFT STARTERS, not legal advice or production-ready legal documents.** They include placeholders for the service operator, contact details, actual vendor locations, call recording and retention rules, and privacy rights. Replace and review that text before publishing it to real participants. Verify actual ElevenLabs/Telnyx/hosting and provider data processing before publication.

## 2. Environment variables

In **local** `.env`:

```dotenv
APP_ORIGIN=https://creative-basilisk-painfully.ngrok-free.app
RELISH_PILOT_TERMS_VERSION=2026-10-27-v1

# Only set YES after completing/reviewing the two bundled Markdown documents.
RELISH_LEGAL_DOCUMENTS_PUBLISHED=YES
```

In **Railway production**, use the production's actual public HTTPS origin:

```dotenv
APP_ORIGIN=https://<YOUR-PRODUCTION-DOMAIN>
RELISH_PILOT_TERMS_VERSION=2026-10-27-v1
RELISH_LEGAL_DOCUMENTS_PUBLISHED=YES
```

The URLs are derived automatically:

- `APP_ORIGIN` + `/legal` - one SMS link.
- `APP_ORIGIN` + `/legal/terms` - Terms document; URL stored on acceptance record.
- `APP_ORIGIN` + `/legal/privacy` - Privacy document; URL stored on acceptance record.

An optional trailing `/` in `APP_ORIGIN` is accepted. Do not add `/legal` yourself to the value. It must be a **public HTTPS origin with no path, credentials, query or fragment**.

Remove these obsolete keys from the active `.env` and Railway variables, along with any older `HOSTING_URL` key:

```dotenv
# REMOVE; do not retain these old policy URL keys.
RELISH_PILOT_TERMS_URL=...
RELISH_PILOT_PRIVACY_URL=...
```

The startup validator now **rejects** these legacy keys, including `HOSTING_URL`, if telephone onboarding is enabled, and rejects missing or invalid `APP_ORIGIN` or anything other than `RELISH_LEGAL_DOCUMENTS_PUBLISHED=YES`. No separate hosting URL or hardcoded host is consulted.

OAuth and the separate `ELEVENLABS_INITIATION_SECRET`, `ELEVENLABS_POST_CALL_WEBHOOK_SECRET` and `ELEVENLABS_TOOL_SECRET` remain unchanged.

### Draft authoring before publication

To preview draft pages without enabling real SMS calls, explicitly set:

```dotenv
RELISH_PILOT_SMS_CALLBACK_ENABLED=NO
RELISH_PILOT_CONVERSATIONAL_TERMS=NO
RELISH_LEGAL_DOCUMENTS_PUBLISHED=NO
```

Browse `/legal`, `/legal/terms` and `/legal/privacy`, edit the Markdown and page summaries, and then enable the three flags with `YES` **only after** the documents have been approved and telephone consent is configured. While the two phone flags are enabled, incomplete legal publication configuration deliberately stops startup rather than silently sending an invalid document.

## 3. How it works

1. The public QR page now has a single `/legal` link in its explanatory text.
2. After a visitor sends the SMS, Relish replies with one legal information URL (`APP_ORIGIN` + `/legal`), an advance disclosure and the STOP option, then places the callback.
3. The page includes short plain-English sections on Terms and Privacy, each linking to its full legal text.
4. `relish_terms_status=REQUIRED` and `call_instruction` still direct Dorian to ask for explicit verbal agreement where outstanding.
5. The `record_relish_policy_acceptance` tool stores policy version and the separately derived full Terms and Privacy URLs after validating the live call session.
6. Returning callers are asked again when the recorded policy version or full document URLs no longer match the current policy.

Do not put the legal text in ElevenLabs' system prompt. Dorian receives the call instruction and current policy information; the public pages remain the source of written text.

**Document versioning:** Change `RELISH_PILOT_TERMS_VERSION` for material legal changes and keep the previous Git revision/tag so you can retrieve accepted historical text. The current database stores version and URLs, not an immutable snapshot of the complete text. True immutable per-version archiving is separate future work; simply changing a live file without changing the policy version makes historical reconstruction harder.

## 4. Local installation, PowerShell

1. Back up your existing working directory and `.env` (do not commit `.env`). Extract this updated complete ZIP over the **top-level** `relationship-os-development/` source.
2. Keep your existing `APP_ORIGIN` in local `.env`; delete `HOSTING_URL` if present, and remove both legacy policy URL keys.
3. Edit the checked-in Markdown files; have the terms and privacy statements legally and operationally reviewed before enabling them.
4. For your ngrok tunnel on port 8080, from the project root:

```powershell
# Test startup variable requirements first.
node --env-file-if-exists=.env scripts/validate-required-env.mjs

# Run Relish on the existing ngrok target port.
npm run dev -- --host 0.0.0.0 --port 8080
```

5. Open `https://creative-basilisk-painfully.ngrok-free.app/legal` and follow both full-document links. Send a test SMS only after live publication is ready and confirmed.
6. Commit and push the source files, including the new `/legal` routes and `.md` documents, to your deployment branch. Railway production will serve the same committed documents on its own `APP_ORIGIN`.

**No `npx prisma migrate dev` is required for Stage 8.19a**. If you haven't already applied the *earlier Stage 8.19* voice-acceptance migration, that earlier migration still must be applied once in your development database.

## 5. Tests and limitations

- **110/110 focused QR/SMS/phone/consent and APP_ORIGIN/legal-page regression tests passed** for this revision.
- Node syntax checks pass for modified server files and the Markdown parser.
- Not performed here: full SvelteKit build/check, rendered-browser checks on actual mobile phones, live ElevenLabs/Telnyx callback or legal review.
- Existing production URLs and SMS sender credentials are unchanged apart from deriving document URLs from `APP_ORIGIN`.

**Do not launch with the included DRAFT legal documents.** They intentionally contain blanks requiring your details, review and final wording.
