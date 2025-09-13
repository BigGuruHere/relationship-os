-- PURPOSE: cosine similarity over two float8[] vectors without pgvector
-- NOTES:
-- - Returns NULL if lengths differ or norm is zero
-- - Marked IMMUTABLE so the planner can optimize

CREATE OR REPLACE FUNCTION public.cosine_similarity(a double precision[], b double precision[])
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $fn$
  SELECT CASE
    WHEN array_length(a, 1) IS DISTINCT FROM array_length(b, 1) THEN NULL
    ELSE (
      SELECT
        SUM(ua.x * ub.y)
        / NULLIF( SQRT(SUM(ua.x * ua.x)) * SQRT(SUM(ub.y * ub.y)) , 0)
      FROM unnest(a) WITH ORDINALITY AS ua(x, i)
      JOIN unnest(b) WITH ORDINALITY AS ub(y, j) ON ua.i = ub.j
    )
  END
$fn$;
