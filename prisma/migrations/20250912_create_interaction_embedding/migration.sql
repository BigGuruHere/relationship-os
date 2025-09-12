-- Enable pgvector (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the embedding table
CREATE TABLE IF NOT EXISTS "InteractionEmbedding" (
  "interactionId" uuid PRIMARY KEY REFERENCES "Interaction"("id") ON DELETE CASCADE,
  "embedding" vector(1536) NOT NULL
);

-- Create an ivfflat index for cosine search
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'InteractionEmbedding_embedding_idx'
  ) THEN
    CREATE INDEX "InteractionEmbedding_embedding_idx"
    ON "InteractionEmbedding"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);
  END IF;
END $$;

ANALYZE "InteractionEmbedding";
