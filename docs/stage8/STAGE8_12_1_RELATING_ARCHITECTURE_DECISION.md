# Stage 8.12.1 - Relating architecture decision

Status: foundation implemented; new group UI and multiple-reflection workflows deliberately deferred.

## Human purpose

Relish supports a person living a life in relationship with others. Dorian learns what matters to a person and supports opportunities for relating. **Relating** is the continuing history/process, not an AI-certified interpersonal relationship. **Relationship** is an ongoing form that people themselves establish or recognise. A meeting can be meaningful without either an ongoing group or a relationship.

## Separate identities

| Concept | Meaning | Persistence in 8.12.1 |
| --- | --- | --- |
| Person | Canonical identity, no global profile dossier | Existing `Person` |
| Living Understanding | Source-backed person knowledge within entrusted custody | Existing Interactions, KnowledgeClaims and Dating review |
| Relating | Private, custody-local history/context involving zero or more future events | New `Relating` |
| Membership | A participant in that Relating context; historical join/leave | New `RelatingParticipant` |
| Introduction | How a potential connection was explored or facilitated | Existing `Introduction`, now optionally linked to Relating |
| Touchpoint | One meeting, call or other encounter, whether part of a group or one-off | New `Touchpoint` |
| Attendance | Participants in *this event*, possibly a proper subset of group membership | New `TouchpointParticipant` |
| Reflection | A particular person's private account of one encounter | Existing Dating workflow for introductions; per-touchpoint linkage deferred |
| Relationship form | Independently attributed account of an ongoing understanding or agreement | Deferred; not an auto-assigned stage |
| Commitment | A promise or mutual arrangement with accountable provenance | Scope to be resolved using existing Tasks and future evidence |

A potential match is a private opportunity, not evidence two people are relating. For migration compatibility, pre-existing proposed introductions are wrapped in **private administrative history containers**. Neither the container nor its participant rows imply reciprocal awareness, mutual consent, public group membership, permission to share information, or an established relationship.

## Unlimited participants without an inflated pilot

Relating membership and touchpoint attendance use rows, not A/B/C columns or a participant-count enum. Each participant can be a Contact, a Company, or both when a named person represents a company. Attendance can reference a group member or a direct one-off guest. A single group can have many touchpoints; a touchpoint may also stand alone. A group of four and a meeting attended by only two are valid. There is no automatic pairwise graph generated for members of a group.

**Compatibility:** The existing pilot `IntroductionParticipant.side` A/B and its unique constraint remain deliberately intact in this release. They are a pilot-specific two-person introduction mechanism, **not** the universal Relating participant model. Actual group invitations/introductions require a later, explicit workflow and permission design. Do not add C/D/E enum values to stretch this legacy model.

## Custody / security invariant

The new records are custody-local to `(userId, contextSpaceId)`. Every new model participates in Prisma's request-scoping middleware and has PostgreSQL owner/context reassignment protections. Composite owner/context foreign keys protect mandatory membership and attendance; database triggers enforce the same fail-closed ownership boundary for nullable Introduction and Touchpoint links. Additional triggers verify the Contact/Company scope and ensure an attendee's membership belongs to the touchpoint's own group. An actor can create an event for only the people and entities accessible in the current ContextSpace.

Relating is **not** an unrestricted shared table across users. Two users' private histories about the same real-world gathering need not expose one another's information. A future explicitly permitted shared encounter or invitation can link their separately owned records, but **adding a group member never discloses older private reflections or inherited permissions**. There is no automatic cross-context reuse of Living Understanding, no group-wide disclosure grant and no inferred mutual outcome.

Do not pass an untrusted `userId`, `contextSpaceId` or person ID from a public request directly into data access. Resolve the current authenticated context first. Raw SQL writes also face database custody and entity-link triggers. Time-specific membership, access and data disclosure are different: a historical attendee does not gain access to later group events merely by appearing in the roster.

## Migration and roll-out

The one new additive migration creates four private tables, adds nullable `Introduction.relatingId`, and backfills a private Relating container for each historical Introduction using its ID. Existing A/B participants with surviving Contact/Company references are mirrored as Relating participants. Historical participants whose linked identity has been removed are not fabricated; their original IntroductionParticipant records remain unchanged and must be reconciled deliberately if needed. Existing Outcomes, reviews, encrypted reflections and participant audit IDs are untouched.

Future Introduction creation now creates its private Relating history and two memberships inside the same transaction. This is only compatibility wiring; the Dating UI remains two-person. No historical touchpoint is invented from a past Introduction, because initial contact does not prove a physical meeting occurred. Existing KnowledgeClaim and Interaction custody remains unchanged.

Run migration on a backed-up development database first. Decline any Prisma request to reset the database. Deploy migration before deploying the updated source; mixed schema/runtime deployments need coordination.

## Gate to Stage 8.12.2

Before developing multiple-touchpoint Dating UI, verify: schema and migration validation, fixture migration on the real database, groups with three or more participants, touchpoint attendance as a strict subset of membership, independent one-off touchpoints, duplicate protection and cross-context link denial. The next implementation also needs an explicit mapping between touchpoint, per-person private reflection, extracted knowledge, and possibly a person-approved relationship form. Any future cross-user or group sharing requires a separate permission model and security tests. Do not weaken those boundaries to make a shared group page easier to implement.
