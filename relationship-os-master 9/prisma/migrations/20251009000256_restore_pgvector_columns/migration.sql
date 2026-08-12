/* IT: repair - restore pgvector columns and indexes to match schema.prisma */

/* IT: enable pgvector if it is not already installed */
CREATE EXTENSION IF NOT EXISTS vector;

/* IT: add pgvector columns expected by schema.prisma - nullable so backfill is possible */
ALTER TABLE "public"."InteractionEmbedding"
  ADD COLUMN IF NOT EXISTS "vec" vector(1536);

ALTER TABLE "public"."Tag"
  ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1536);

/* IT: drop legacy Float[] embedding columns only if they still exist */
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'InteractionEmbedding'
      AND column_name = 'embedding'
  ) THEN
    ALTER TABLE "public"."InteractionEmbedding" DROP COLUMN "embedding";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Tag'
      AND column_name = 'embedding'
  ) THEN
    ALTER TABLE "public"."Tag" DROP COLUMN "embedding";
  END IF;
END $$;

/* IT: create ANN indexes if missing - using HNSW for cosine distance */
CREATE INDEX IF NOT EXISTS "interaction_vec_hnsw"
  ON "public"."InteractionEmbedding" USING hnsw ("vec" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "tag_vec_hnsw"
  ON "public"."Tag" USING hnsw ("embedding_vec" vector_cosine_ops);
