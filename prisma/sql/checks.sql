-- prisma/sql/checks.sql
-- Purpose: quick sanity checks for pgvector setup and indexes

-- 1. Extension enabled
SELECT extname AS extension, extversion
FROM pg_extension
WHERE extname = 'vector';

-- 2. Column types
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE (table_name = 'InteractionEmbedding' AND column_name = 'vec')
   OR (table_name = 'Tag' AND column_name = 'embedding_vec')
ORDER BY table_name, column_name;

-- 3. Indexes - confirm HNSW vector_cosine_ops on both tables
SELECT
  i.relname AS index_name,
  t.relname AS table_name,
  am.amname AS access_method,
  pg_get_indexdef(ix.indexrelid) AS index_def
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_am am ON am.oid = i.relam
WHERE t.relname IN ('InteractionEmbedding', 'Tag')
ORDER BY t.relname, i.relname;
