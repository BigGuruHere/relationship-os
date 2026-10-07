# Stage 8.14.0.5 - Structural Audit Consistency

## Purpose

Align initial Living Understanding structural validation with the Stage 8.14 semantic-overlap contract when a coherent topic legitimately overlaps another topic.

## Problem fixed

Initial v1 structural review could correctly classify shared meaning as `LEGITIMATE_CROSS_TOPIC_RELEVANCE` while still deriving `keepCoherent: false` solely because `overlappingTargetKeys` was non-empty. A proposed `KEEP` then failed deterministic validation even though the overlap was intentional and safe.

## Changes

- Under validation contract `8.14.0`, `overlappingTargetKeys` alone no longer makes a clean `KEEP` audit incoherent.
- Legacy validation contracts retain their previous exclusive-home behaviour.
- `KEEP` still fails for contamination flags, title mismatch, non-KEEP audit recommendations, unsafe semantic identity, redundant duplication, or actual contamination.
- Initial and bounded-repair prompts explicitly require internally consistent `KEEP` / `keepCoherent` metadata and explain that legitimate cross-topic relevance/shared themes do not by themselves require restructuring.
- Added Stage 8.14.0.5 regression coverage.

## Safety invariants retained

- No source meaning may be added, dropped, strengthened, weakened, inferred, or temporally shifted.
- Redundant duplication and actual topic contamination remain blocking.
- Canonical provenance/retrieval anchors remain explicit.
- Legacy experiment behaviour is unchanged.
- No Prisma migration.
