# Stage 8.12.2 - Person-first history and independent touchpoints

## Purpose
A person and their private history exist without an introduction, touchpoint or Relating group. The Dating operator can record a personal reflection at any time, or attach one to a touchpoint the person attended. One touchpoint can have multiple attendees and can be independent of an ongoing Relating history.

## Added
- A person-first Dating history page at `/dating/people/[id]` and a navigation link from Dating → People.
- A chronological timeline combining operator-recorded personal reflections, touchpoints and existing introductions.
- An operator-recorded private reflection can exist without an introduction or touchpoint, or it can reference an owned touchpoint where the person attended.
- New touchpoints can have any number of selected attendees (a 30-person pilot form limit, not a database cardinality restriction). Optional association to an existing Relating history requires the focal person's current membership.
- New notes and reflections are encrypted at rest. No statements are promoted to confirmed KnowledgeClaims, disclosed or shared merely by creating an event.
- Existing Living Understanding remains separately reviewable; existing introduction-specific reflection and Outcome workflows remain unchanged.

## Model boundaries
- Person is the conceptual centre. This pilot still uses a custody-local Contact as the person's representation and does not join private ContextSpaces into one global dossier.
- Touchpoint is a recorded event; Relating is an optional continuing group context; Reflection is the operator's attributed personal account. Membership and attendance remain independent.
- Adding an attendee does not grant access to another attendee's private reflections. Reflections are not participant-confirmed merely because an administrator saved them.
- The timeline links older Introduction records but does not infer that a planned introduction resulted in a meeting.
- This is a first person-first pilot increment, not yet the complete participant-authenticated personal agent interface or a merged timeline of all legacy encrypted CRM interactions.

## Compatibility
- Based on Stage 8.12.1; its migration is required. No new migration and no changes to the Catalina-compatible dependency lockfile.
- Existing introductions, approved Dating reviews and original personal Living Understanding records remain intact.
- The postponed production dependency security findings remain outstanding before an external sensitive-data pilot.

## Verification
Run `npm run check:stage8.12.2`, then `npm run check:stage8.12.1`, `npm run check:stage8.12.0.1`, `npm run check`, and `npm run build`. The opt-in PostgreSQL test uses `ALLOW_DATING_DEV_DB_TEST=YES`, `DATING_TEST_USER_ID`, and `DATING_TEST_CONTEXT_SPACE_ID` from the previously established development fixture. Confirm the environment points to development before running it.

In the browser create a new Dating person, open Personal history, save a reflection before creating any introduction or meeting, add a meeting with one or more attendees, and add a separate reflection linked to it. Check the Living Understanding link and prior Introduction links on a person who already has those records.
