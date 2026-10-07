# Stage 8.12.13.7.3 - Revision batching and longitudinal preparation

## Purpose

This remains a development-only, read-only Living Understanding experiment.

Stage 8.12.13.7.3 removes the accidental user-facing eight-area ceiling while retaining eight topic targets as the maximum processing batch size. It also adds stable topic-target identity and a browser-only continuation seed for the next longitudinal experiment.

## Behaviour

- The operator may select more than eight semantic areas.
- Selected areas are consolidated to one revision per topic target before batching.
- Topic targets are processed sequentially in batches of at most eight.
- A generous 32-area hard ceiling remains only as malformed-request protection for the development experiment.
- Each consolidated target has a stable key:
  - `existing:<topic-id>` for an existing topic.
  - `suggested:<realm>::<topic>` for a proposed topic.
- The response includes a non-persisted longitudinal seed containing the proposed understanding, target identity and source provenance.
- Nothing is saved, confirmed, retired, created, shared or permissioned.

## Why

The previous eight-area check was a pilot guardrail but could interrupt a valid decomposition. Batching preserves bounded external model work without making eight a product limitation.

Stable target keys prepare the next experiment to take the proposed understanding from conversation one and test how conversation two revises, supports or contradicts it without first making the experimental output authoritative database knowledge.
