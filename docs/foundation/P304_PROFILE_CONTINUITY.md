# P-304 profile and authentication continuity

Implemented on `feature/p304-profile-continuity` from development `4b0d7a3`. Development integration and live device/provider acceptance are pending. The stage reuses the three public exchange screens, existing authentication, profile editor, My Profiles and QR rendering.

## Signup and account boundaries

The existing encrypted HttpOnly draft begins as an anonymous prefill for the explicit signup flow. Password and Google signup create a new User and its unpublished default Profile together with encrypted credential email. The Google identity lookup uses the provider's verified email, and password signup uses the submitted credential fields. The visitor's draft email and phone are never copied directly to public fields.

After successful session issuance for a newly created account, the server binds the draft to that User and Profile in a versioned encrypted cookie. The 30-minute expiry still runs from the original capture. The editor shows the draft only for the matching authenticated owner and exact selected profile. A failed save retains it, a successful save of that profile consumes it, and logout clears it. An expired session can return to the review page after the same owner signs back in within the draft lifetime.

An existing account following the signup/sign-in flow without its own bound draft lands on My Profiles. Its existing profile details, slugs and publication state remain intact. The profile continuation skips the legacy post-auth lead claim. Ordinary login and existing Network invitations retain their established claim behavior and F-203 guard. No Contact, Person association or mutual connection is created from draft fields, a browser receipt or a profile review. Stage 4 designs secure claim and continuing sharing separately.

## Profile and QR selection

Share resolves explicit selections within the signed-in owner's profile list. Multiple profiles of the same kind remain independently addressable. The main Share page and dedicated QR/vCard preview use the selected profile's slug and the request's app origin. The dedicated page uses the existing public QR image endpoint, and the older generation action returns to that same profile. The primary Share loader is read-only, since the live QR endpoint already renders the image. Legacy generation routes still maintain their stored QR fields when invoked for published profiles.

An unpublished profile can be edited and previewed by its owner. Its Share page displays edit and preview links until publication enables copy, messaging and QR controls. Public lookup, capture and QR continue enforcing publication. Both canonical profile slugs and legacy public aliases retain their existing destinations.

## Acceptance and rollout

[PR #23](https://github.com/BigGuruHere/relationship-os/pull/23) is open against development. [CI run 42148654526](https://github.com/BigGuruHere/relationship-os/actions/runs/42148654526) passed 160 checks on implementation commit `6208c95` with zero failures/skips. This includes 29 profile checks and 131 existing foundation checks, including PostgreSQL 18.6 concurrency. Local focused tests passed 43 checks and Svelte reported zero errors/warnings. Additional local regressions passed 13 checks; two older Dorian consent source assertions also failed on the unchanged development base and were left untouched.

Local route and rendering coverage checks password and Google signup, existing-account return, expiry, failed-save retention, draft scope, publication controls, matching QR and vCard selection, foreign-profile denial and legacy URLs. Google is simulated and the profile tests use synthetic route fixtures. The Foundation database workflow runs the profile checks on Node 22 alongside existing provisioning, PostgreSQL concurrency and foundation access checks.

No Prisma migration or account activation is required. No DEV or production deployment was performed. Once a DEV deployment is authorized, test the exchange-to-signup flow using password and Google, including a returning account. Confirm the new card is unavailable from a second browser before publication, publish deliberately, then scan its QR and open an existing public alias. Switch between two profiles of the same kind and confirm the QR, copied URL and vCard all refer to the selected one. Recheck Brokerage login and profiles separately.

The bound cookie uses a distinct format and purpose so an older release cannot read it as an anonymous draft. On application recovery, preserve existing Profile rows and slugs. Prefer rolling forward to preserve draft isolation and the foundation writer handoff. P-305 privacy and operations readiness follows integration.
