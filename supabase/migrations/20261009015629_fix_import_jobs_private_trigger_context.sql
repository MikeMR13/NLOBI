-- Keep import authorization checks inside a protected, search-path-fixed trigger.
-- This corrects permission denied for schema private when users upload EPUB files.
ALTER FUNCTION private.guard_import_permission() SECURITY DEFINER;
ALTER FUNCTION private.guard_import_permission() SET search_path = '';
REVOKE ALL ON FUNCTION private.guard_import_permission() FROM PUBLIC, anon, authenticated;
