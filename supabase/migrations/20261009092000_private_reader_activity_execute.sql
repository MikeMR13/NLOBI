-- Supabase's default function privileges may grant EXECUTE to anon
-- directly. Revoke that direct grant on the private following feed.
revoke execute on function public.get_followed_reader_activity() from anon;
grant execute on function public.get_followed_reader_activity() to authenticated;
