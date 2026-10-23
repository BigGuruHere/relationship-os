# Stage 8.17 - Relish Contextual UI and Pilot Navigation

## Purpose and baseline

Baseline: Stage 8.16 source supplied in `Relish_Stage_8_16_Complete_Source.zip`.

This UI-first stage creates **one Relish application with three deliberately distinct relationship experiences**: Business, Friendship and Dating. They use one familiar interface but have distinct accent colours, context-scoped pages, profiles and QR sharing. The user-facing name "Friendship" continues to use the existing `general` ContextSpace domain. It is **not** a new fourth database domain.

No outbound telephony, SMS invitation callback, new terms flow, new automatic connection acceptance, user-account claiming or new memory engine is implemented in this stage.

## What's implemented

- Context selector in the top application bar for the pilot owner; Business (blue), Friendship (green) and Dating (purple).
- Participant only sees their **first QR entry's** configured context within this new app. Existing signed-in members without a QR entry use their earliest owned context.
- Five dedicated, context-specific routes: **Home / People / Profile / Share / Settings**.
- Consistent desktop sidebar and mobile bottom navigation. Mobile also has an account menu giving the owner access to operator and broker areas.
- Simple Home tiles and recent people/requests, drawn only from the relevant relationship context.
- Context-specific profile page linked to the original editor. Saving from the new UI returns to the same context.
- Context-specific QR view generated from the current deployment origin, not an old persisted QR origin.
- Current Friendship Network connections are shown inside Friendship; volunteered Stage 8.16 connection requests are shown only for the appropriate context. Outgoing requests appear with a `Request sent` state, not as accepted relationships.
- Owner action "Set up missing contexts" idempotently ensures all three existing ContextSpace domain types. It does not merge, relocate or duplicate already-existing context data.
- Dedicated **Operator tools** entry, linking Product Intelligence, Dorian Conversation Monitor (including interactions and Living Understanding processing), participant directory, Review Inbox and telephone review tools.
- Dedicated **Business broker** index linking the existing commercial CRM, pipeline, research and agent routes. Existing broker contact-list home is preserved at `/broker/contacts`; `/` now routes into Relish's participant-facing context instead.
- Public `/u/[slug]` and `/pilot/dorian/[entryId]` entry surfaces no longer inherit the signed-in app's sidebar/top controls. Their content and Stage 8.16 onboarding mechanism are preserved.
- Core app navigation no longer mixes broker-specific commands into the five relationship destinations.

## URL map

| Context | Home | People | Profile | Share | Settings |
|---|---|---|---|---|---|
| Business | `/space/business` | `/space/business/people` | `/space/business/profile` | `/space/business/share` | `/space/business/settings` |
| Friendship | `/space/friendship` | `/space/friendship/people` | `/space/friendship/profile` | `/space/friendship/share` | `/space/friendship/settings` |
| Dating | `/space/dating` | `/space/dating/people` | `/space/dating/profile` | `/space/dating/share` | `/space/dating/settings` |

Other entries: `/operator` (operator capability), `/broker` (broker capability), `/broker/contacts` (the legacy CRM contact index). `/` redirects a signed-in person to their permitted Relish workspace.

## Existing code reused

- `contextDomainForPathname` continues to select application custody from trusted routes; it now recognises `/space/business`, `/space/friendship` and `/space/dating`.
- `resolveContextSpaceForDomain` still chooses an owned context in the selected domain.
- `ensureOwnedDomainContextSpace` is reused for explicit owner setup, without schema changes.
- Profiles, publication control, `/u/[slug]`, QR generation, public vCards and the Stage 8.16 visitor flow are reused.
- `PilotConnectionRequest` and `NetworkConnectionOrigin` provide initial People pages; no matching or auto-sharing is implied.
- Operator, Living Understanding and Dorian telephone workers retain their previous services/routes.

## Critical privacy and data boundaries

1. A pilot participant's `/space/[context]` server layout revalidates the permitted context before loading a page. A hand-edited context URL does not grant access.
2. Existing user and context ownership rules continue to apply to all relational data. A context selector is not an authorization mechanism.
3. The new Business People page does **not** load the old business-broker CRM contact list. The old broker information remains in existing records and is only navigationally isolated at this stage. **This is not a physical data migration to a separate broker product.**
4. A QR visit does not imply a connection. Only explicitly submitted requests appear. A `REQUESTED` or `SENT` record is not automatically an accepted relationship.
5. A private Dorian transcript and Living Understanding are never returned to the new consumer People/Home/Profile/Share pages.
6. The QR's publication state is respected; unpublished profiles do not produce public QR links in the new sharing page.
7. The pilot member's single visible context is selected by their first recorded QR entry when available, otherwise their earliest owned context. This is a **pilot display policy**, not yet full person-centred multi-context navigation. Existing unrelated experiences are neither merged nor deleted.

## Legacy and specialist route inventory (do not delete yet)

| Category | Existing routes | Treatment |
|---|---|---|
| Active participant | `/space/...`, `/u/[slug]`, `/pilot/dorian/[entryId]` | Primary UX |
| Existing profile tools | `/settings/profile`, `/profiles`, `/share`, `/network/share` | Reused, some legacy links remain |
| Friendship legacy | `/network`, `/network/dorian`, `/network/join/...` | Retained, not top-level participant navigation |
| Legacy Dating operator pilot | `/dating`, `/dating/people`, `/dating/introductions`, `/dating/feedback` | Retained, not the new Dating home |
| General and LU operator tools | `/general`, `/general/people`, `/general/admin/...` | Accessed via `/operator` |
| Broker/commercial | `/leads`, `/deals`, `/companies`, `/agents`, `/workstreams`, `/contacts`, `/wants`, `/offers`, `/introductions` | Accessed via `/broker`; existing URLs preserved |
| Old cross-functional CRM | `/tasks`, `/projects`, `/actions`, `/search`, `/objectives`, `/reminders` | Preserved, omitted from five-link participant navigation |

Future cleanup should audit and reauthorize direct access to these old routes before removal or extraction. Hiding them from navigation alone does not revoke the permissions those routes already had.

## Installation

**Prisma migration required: NO.** There are no database schema modifications in this stage.

1. Back up the current development source. Keep Neon development and production connections separate.
2. Replace the local project with the complete supplied Stage 8.17 source (or merge its changes deliberately).
3. Run `npm install` if your local dependencies need restoring; no new packages are introduced.
4. Start the development application as usual with `npm run dev`.
5. Sign in as the owner, go to `/space/business` and select **Set up missing contexts** if any of the three aren't configured yet.

Do **not** run `npx prisma migrate dev` for this stage. There is no new migration to apply. Local `npm run build` is not required.

Existing GitHub, Railway, Neon, Telnyx and ElevenLabs settings are unchanged. The abandoned Stage 8.15.4.7a migration is not included.

## Explicit UI acceptance tests

### Owner navigation

1. Log in as owner. `/` redirects to `/space/business`.
2. At the top, switch Business → Friendship → Dating. Verify distinct accents and Home/People/Profile/Share/Settings for each.
3. On a narrow mobile screen, verify the five bottom destinations, top context selector and account menu.
4. From the mobile account menu or desktop sidebar, verify **Operator tools** and **Business broker** entry points.
5. Use **Set up missing contexts**. Confirm the three domains exist and existing ContextSpace IDs remain unchanged.
6. Open `/broker` and `/broker/contacts`; verify existing broker contacts, deals, leads and agents are reachable.
7. Open `/operator`, Product Intelligence, Dorian Conversation Monitor, an interaction and available Living Understanding processing details.

### Profile and QR flow

8. In each context, create or edit its profile. Confirm return to the same context after saving.
9. Publish a profile, open that context's Share page, copy its link and scan the QR from a mobile phone. Confirm the origin (development vs production) is correct.
10. Unpublish the profile. Confirm QR sharing is unavailable and a public visitor cannot access the profile.
11. Check visitor profile on a narrow phone. Confirm no signed-in owner sidebar or owner context selector appears.
12. Confirm save-contact/vCard, connect-request and current browser Dorian invitation remain functional on the public page.

### Privacy and member access

13. Sign in as a pilot member who joined through one QR context. Confirm they see only their first context in the top bar.
14. Manually enter `/space/` URLs for the other two contexts. Confirm access is refused (403).
15. Submit a consented connection request; confirm it appears only in the intended owner's context and, where applicable, as a sent request on the visitor's side.
16. Confirm the Business People page does not unexpectedly show the legacy broker CRM contact list.
17. Confirm Dorian's transcripts and private Living Understanding are absent from ordinary People/Share page responses.
18. Test with two browser sessions and independent users to confirm tenant and domain isolation.

### Regression

19. Complete an existing inbound telephone call, observe the Dorian monitor and automatic Living Understanding processing, and verify next-call continuity still works.
20. Check authenticated and unauthenticated public QR flows, including old public profile URLs, logout and login redirects.

## Verification conducted here

- 8/8 prior Stage 8.16 static contract tests passing.
- 7/7 new Stage 8.17 static contract tests passing.
- 15 modified TypeScript modules syntactically checked using TypeScript transpilation with zero parsing errors.
- **Not executed:** full SvelteKit check/build, live database tests, a real browser layout test, live provider tests. The local dependency installation was incomplete in this isolated environment. These remain release gates in your development setup.

## Deliberately deferred

- Persisted per-context automatic-versus-approval connection settings, including actual reciprocal acceptance workflow.
- Phone-versus-browser Dorian option and SMS invitation/outbound callback.
- Claiming provisional participant identities through verified login.
- New T&C and consent-version tracking.
- Separating brokerage data into a different ContextSpace/domain and eventually into its own bounded product with governed Relish Core interfaces.
- Removal of superseded code and routes.

**Future direction:** Relish Core owns the person/identity and governed perspectives. The Business, Friendship, Dating and eventual Broker specialist experiences consume appropriately permissioned views, without automatically exchanging private conversational understanding.
