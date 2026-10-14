-- IT: Persist the author's epistemic perspective without changing source evidence or disclosure permissions.
CREATE TYPE "KnowledgePerspective" AS ENUM ('UNSPECIFIED_LEGACY', 'CONTACT_REPORTED', 'OWNER_OBSERVATION', 'RELATIONSHIP_PERSPECTIVE');
ALTER TABLE "KnowledgeClaim" ADD COLUMN "perspective" "KnowledgePerspective" NOT NULL DEFAULT 'UNSPECIFIED_LEGACY';
