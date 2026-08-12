-- IT: enable pgvector extension if available
CREATE EXTENSION IF NOT EXISTS vector;

-- IT: add a pgvector column to store interaction embeddings in pgvector format
-- Keep your existing Float[] column as a baseline
ALTER TABLE "InteractionEmbedding"
  ADD COLUMN IF NOT EXISTS "vec" vector(1536);

-- IT: add a pgvector column to Tag for vocabulary vectors
ALTER TABLE "Tag"
  ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1536);

-- IT: create HNSW indexes for fast cosine search
CREATE INDEX IF NOT EXISTS "interaction_vec_hnsw"
  ON "InteractionEmbedding" USING hnsw ("vec" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "tag_vec_hnsw"
  ON "Tag" USING hnsw ("embedding_vec" vector_cosine_ops);
