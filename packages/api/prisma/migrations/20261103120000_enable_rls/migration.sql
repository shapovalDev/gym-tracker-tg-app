-- Lock down Supabase's Data API (PostgREST). The app reaches Postgres only through
-- Prisma as the table owner, which bypasses RLS; the `anon` / `authenticated` roles
-- used by the Data API must see nothing. RLS is enabled with no policies (deny all)
-- and their privileges are revoked. Hand-written: Prisma does not manage RLS.

-- Enable RLS on every table in this schema (including _prisma_migrations).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Revoke Data API access (the roles exist only on Supabase, not in local Postgres).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM %I', current_schema(), r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %I', current_schema(), r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM %I', current_schema(), r);
    END IF;
  END LOOP;
END $$;
