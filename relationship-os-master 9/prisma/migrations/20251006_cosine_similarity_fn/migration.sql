-- Comment: Create a simple cosine_similarity for float8[] arrays
CREATE OR REPLACE FUNCTION cosine_similarity(a float8[], b float8[])
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL THEN NULL
    WHEN cardinality(a) = 0 OR cardinality(b) = 0 THEN NULL
    ELSE
      (SELECT SUM(x * y) FROM unnest(a, b) AS t(x, y))
      /
      (sqrt((SELECT SUM(x * x) FROM unnest(a) AS t(x)))
       * sqrt((SELECT SUM(y * y) FROM unnest(b) AS t(y))))
  END;
$$;

