-- Resolve 42501 permission denied for schema private in authenticated RLS policies.
-- USAGE permits name resolution for private authorization helper functions.
-- This does not expose the private schema through PostgREST's configured API schemas.
-- Individual functions retain their EXECUTE privileges and RLS checks.
GRANT USAGE ON SCHEMA private TO authenticated;
