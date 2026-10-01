# Stage 8.12.13.9.2 - Meaning Coverage and Semantic Identity Validation

## Purpose

This stage closes the final trust gaps found by the Stage 8.12.13.9.1 live structural review. It does not add a new Living Understanding feature or persistence model. It hardens the read-only restructuring validator so that the existing semantic-ownership invariant can be enforced rather than merely requested from the model.

## Changes

1. **Machine-derived meaning coverage**
   - The model still returns exact contiguous excerpts for each prior topic.
   - The server now derives coverage directly from those excerpts against the prior understanding.
   - The old `meaningUnitsComplete` model boolean is compatibility metadata only and is not trusted as proof of completeness.
   - Substantive source wording left uncovered makes the proposal invalid for review.

2. **Semantic identity across topics**
   - The model must compare meaning units across all prior topics and declare equivalent or substantially overlapping units in `semanticOverlapGroups`.
   - Every overlap group must converge on one primary semantic home.
   - A deterministic lexical-overlap backstop also detects likely near-duplicate units from different source topics when they have neither a shared primary home nor a declared overlap group.

3. **Purpose-context ownership**
   - Every meaning unit now carries `purposeContext`.
   - Every primary mapping must be marked `PURPOSE_CONTEXT_FIT`.
   - `SURFACE_ONLY` and `AMBIGUOUS` primary-home assignments invalidate the proposal.
   - This prevents a surface noun from deciding ownership. For example, a tentative tennis-club plan whose purpose is to build a social circle belongs primarily with the social goal, not leisure preferences merely because it mentions tennis.

4. **Review UI**
   - Structural audits show machine-derived meaning coverage.
   - Ownership rows show purpose/context and primary-home fit.
   - A Semantic identity validation section shows declared equivalent/overlapping groups.

## Scope and safety

- Read-only experiment only.
- No migration.
- No stored Living Understanding is changed.
- No permission, sharing, confirmation or operational-knowledge semantics are changed.
- Existing custody checks remain unchanged.

## Exit criterion

Rerun the same live longitudinal structural-review case. If it returns no structural validation warnings, all source meaning is covered, equivalent/overlapping meaning converges on one primary home, and primary-home assignments follow proposition purpose/context without semantic mutation, the Living Understanding v1 core architecture can be treated as complete for this milestone and work can move to persistence.
