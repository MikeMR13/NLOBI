-- Applied to Supabase NLOBI production.
alter table public.novels add column if not exists demography text;
alter table public.novels drop constraint if exists novels_demography_allowed;
alter table public.novels add constraint novels_demography_allowed check (demography is null or demography in ('Shōnen','Shōjo','Seinen','Josei','Kodomo','General'));
