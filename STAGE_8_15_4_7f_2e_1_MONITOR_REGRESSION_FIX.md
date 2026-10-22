# Stage 8.15.4.7f.2e.1 - Monitor regression fix

The 8.15.4.7f.2e overlay inadvertently replaced the corrected monitor implementation with an outdated version. This combined patch restores both prior corrections and preserves the new automatic-review trace.

- Contact uses `id`, not `contactId`; Interaction and revision source queries retain `contactId`.
- Use ordinary workspace custody for same-owner sessions and restricted cross-owner custody for other owners.
- Retain the authoritative revision inspector and add the completed automatic-impact trace.
- Preserve the 30-day automatic completed-draft retention from Stage 8.15.4.7f.2e.

Installation: back up your project; extract this overlay into the project root and overwrite its three matching files. No Prisma migration; no local build. Run `npm run check`, restart the dev server, then load `/general/admin/dorian-conversations` and open an applied revision.

This correction was verified through source assertions; full TypeScript/Neon integration tests must run in your local checkout.
