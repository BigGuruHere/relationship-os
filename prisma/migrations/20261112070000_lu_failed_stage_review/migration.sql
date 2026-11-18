-- Failed reviews reuse the encrypted candidate record and never enter approval.
ALTER TYPE "public"."FoundationLuCandidateOutcome" ADD VALUE 'FAILED';
