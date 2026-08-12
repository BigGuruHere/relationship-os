-- PURPOSE: Add or fix Tag.embedding as double precision[] with default '{}' and NOT NULL
DO $$
BEGIN
  -- Safety - exit early if the table itself does not exist in public schema
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Tag'
  ) THEN
    RAISE NOTICE 'Table "public"."Tag" does not exist - skipping embedding migration';
    RETURN;
  END IF;

  -- Case 1: Column does not exist - create it with the desired definition
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Tag' AND column_name = 'embedding'
  ) THEN
    EXECUTE '
      ALTER TABLE "public"."Tag"
      ADD COLUMN "embedding" double precision[] NOT NULL DEFAULT ''{}''
    ';
  ELSE
    -- Case 2: Column exists - ensure it has the correct type double precision[]
    IF NOT EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'Tag'
        AND a.attname = 'embedding'
        AND a.atttypid = '_float8'::regtype  -- _float8 is double precision[]
    ) THEN
      EXECUTE '
        ALTER TABLE "public"."Tag"
        ALTER COLUMN "embedding" TYPE double precision[]
        USING "embedding"::double precision[]
      ';
    END IF;

    -- Normalize any NULLs to empty array before enforcing NOT NULL
    EXECUTE '
      UPDATE "public"."Tag"
      SET "embedding" = ''{}''
      WHERE "embedding" IS NULL
    ';

    -- Ensure a default exists
    IF NOT EXISTS (
      SELECT 1
      FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      JOIN pg_class c ON c.oid = d.adrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'Tag'
        AND a.attname = 'embedding'
    ) THEN
      EXECUTE '
        ALTER TABLE "public"."Tag"
        ALTER COLUMN "embedding" SET DEFAULT ''{}''
      ';
    END IF;

    -- Enforce NOT NULL if not already set
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'Tag'
        AND a.attname = 'embedding'
        AND a.attnotnull = false
    ) THEN
      EXECUTE '
        ALTER TABLE "public"."Tag"
        ALTER COLUMN "embedding" SET NOT NULL
      ';
    END IF;
  END IF;
END
$$;
