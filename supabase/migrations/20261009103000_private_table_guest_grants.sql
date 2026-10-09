-- Guest access is unnecessary for tables that have authenticated-only SELECT policies.
-- Public summaries continue through deliberately public SECURITY DEFINER RPCs.
revoke select, references on table
 public.editorial_review_requests,
 public.read_sections,
 public.reader_collection_saves,
 public.translation_ratings,
 public.translation_reviews,
 public.volume_publication_schedule
from anon;