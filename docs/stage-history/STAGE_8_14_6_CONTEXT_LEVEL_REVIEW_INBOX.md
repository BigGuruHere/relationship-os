# Stage 8.14.6 - Context-level Living Understanding Review Inbox

## Purpose

Move the Living Understanding supervision queue out of an individual person's workflow and make it an explicit General-context operator surface covering all people in that ContextSpace.

## Behaviour

- Canonical route: `/general/admin/reviews`.
- The inbox continues to aggregate pending and dismissed conversation evidence across all General participants.
- Review, dismiss, confirmed dismissal, and restore behaviour are unchanged.
- Conversation history remains person-specific and archival. It displays imported, pending, included, and dismissed state, but no longer acts as the primary review workflow.
- `/general/reviews` remains as a permanent compatibility redirect to `/general/admin/reviews` so saved links do not break.
- General home and General People link to the operator inbox.

## Access boundary

This stage changes product structure, not authorization semantics. It still requires the existing authenticated General ContextSpace guard. Role/capability gating for member, operator, admin, and broker surfaces belongs to the planned pilot product-surface stage rather than being introduced implicitly here.

## Migration

None.
