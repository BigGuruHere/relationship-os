# Stage 8.13.3.3 - Semantic Overlap and Bounded Repair

## Purpose

Stage 8.13.3.3 corrects an overly rigid longitudinal validation rule. Living Understanding topics are coherent views of a person, not mutually exclusive containers. The same durable meaning may legitimately inform more than one topic when it has a distinct explanatory role in each.

Examples:

- autonomy may help explain relationship readiness;
- the same autonomy theme may also describe a desired relationship dynamic;
- a recurring theme may later appear in work, friendships or family without being treated as invalid duplication.

The validator therefore distinguishes:

- REDUNDANT_DUPLICATION
- LEGITIMATE_CROSS_TOPIC_RELEVANCE
- SHARED_UNDERLYING_THEME
- ACTUAL_TOPIC_CONTAMINATION

Only redundant duplication and actual contamination are repaired.

## Exact wording backstop

Exact substantive sentence duplication remains a strong redundancy signal, but it no longer causes immediate failure. After the semantic boundary audit, Relish performs one bounded repair pass against only the editable changed/new topics involved in the duplicated wording. Unchanged authoritative topics remain immutable reference boundaries.

If exact same-purpose duplication remains after that bounded repair pass, the proposal still fails closed and no authoritative knowledge is changed.

## No persistence changes

No Prisma schema or migration change is required. Existing authoritative revisions remain immutable.
