-- PURPOSE: Portable embeddings storage without pgvector.
-- - Creates InteractionEmbedding with embedding as double precision[].
-- - Adds a cosine_similarity(a,b) SQL function for ranking.

-- Drop a partial table if a previous attempt half-created it
DROP TABLE IF EXISTS "InteractionEmbedding" CASCADE;

-- Create table with text FK, to match "Interaction"."id" which is text in Postgres
CREATE TABLE IF NOT EXISTS "InteractionEmbedding" (
  "interactionId" text PRIMARY KEY REFERENCES "Interaction"("id") ON DELETE CASCADE,
  "embedding" double precision[] NOT NULL
);

-- Cosine similarity between two equal-length float arrays
CREATE OR REPLACE FUNCTION cosine_similarity(a double precision[], b double precision[])
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH
  la AS (SELECT unnest(a) AS x, generate_subscripts(a, 1) AS i),
  lb AS (SELECT unnest(b) AS y, generate_subscripts(b, 1) AS j),
  dot AS (
    SELECT SUM(la.x * lb.y) AS v
    FROM la
    JOIN lb ON la.i = lb.j
  ),
  na AS (SELECT sqrt(SUM(x * x)) AS n FROM la),
  nb AS (SELECT sqrt(SUM(y * y)) AS n FROM lb)
  SELECT CASE
           WHEN (na.n = 0 OR nb.n = 0) THEN 0
           ELSE (dot.v / (na.n * nb.n))
         END
  FROM dot, na, nb;
$$;

ANALYZE "InteractionEmbedding";
