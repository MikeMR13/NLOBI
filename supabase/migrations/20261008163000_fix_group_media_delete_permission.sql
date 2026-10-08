-- Allow authenticated group editors to evaluate the existing protected DELETE policy.
-- The policy continues to require group-scoped authorization and zero active references.
grant execute on function private.storage_object_in_use(text) to authenticated;
