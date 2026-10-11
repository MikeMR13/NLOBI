-- Post-migration integration tests: actual PostgreSQL roles, RLS, triggers
-- and synthetic user JWT claims. No external credentials or production records.
\set ON_ERROR_STOP on
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='novels' AND column_name='sequel_status') THEN
   RAISE EXCEPTION 'Migration did not add sequel_status';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='team_guard_translations'
      AND pg_get_triggerdef(oid) LIKE '%translation_editorial_content_guard%') THEN
   RAISE EXCEPTION 'Translation metadata trigger was not replaced';
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_schema='public'
      AND routine_name='update_editorial_states' AND grantee='anon' AND privilege_type='EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous role can execute metadata write RPC';
 END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
-- Owner can change all three concepts together.
SELECT public.update_editorial_states(
 'cccccccc-cccc-4ccc-8ccc-cccccccc0001','completed','complete','awaiting');
DO $$
BEGIN
 IF (SELECT status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'completed'
    OR (SELECT sequel_status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'awaiting'
    OR (SELECT status FROM public.translations WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccc0001') <> 'complete'
 THEN RAISE EXCEPTION 'Owner status update did not persist three values'; END IF;
END $$;

-- Editor has explicitly DENIED publish permission, but edit status must work.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
BEGIN
 IF private.team_action_allowed('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish')
    OR NOT private.team_action_allowed('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','edit')
 THEN RAISE EXCEPTION 'Fixture editor permission model is incorrect'; END IF;
END $$;
SELECT public.update_editorial_states(
 'cccccccc-cccc-4ccc-8ccc-cccccccc0001','hiatus','paused','unconfirmed');
DO $$
BEGIN
 IF (SELECT status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'hiatus'
    OR (SELECT sequel_status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'unconfirmed'
    OR (SELECT status FROM public.translations WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccc0001') <> 'paused'
 THEN RAISE EXCEPTION 'Editor cannot save when publish is denied'; END IF;
END $$;

-- Editor from a different team must be refused.
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  PERFORM public.update_editorial_states(
   'cccccccc-cccc-4ccc-8ccc-cccccccc0001','cancelled','abandoned','announced');
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-group editor modified another team project'; END IF;
END $$;

-- A proofreader is a real authenticated role but cannot edit the states.
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  PERFORM public.update_editorial_states(
   'cccccccc-cccc-4ccc-8ccc-cccccccc0001','cancelled','abandoned','announced');
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Proofreader modified editor-only metadata'; END IF;
END $$;

-- No authenticated session identity => blocked.
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  PERFORM public.update_editorial_states(
   'cccccccc-cccc-4ccc-8ccc-cccccccc0001','cancelled','abandoned','announced');
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Authenticated role without identity wrote metadata'; END IF;
END $$;

-- Site administrator can change a project without joining that team.
SELECT set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
SELECT public.update_editorial_states(
 'dddddddd-dddd-4ddd-8ddd-dddddddd0002','completed','complete','announced');
DO $$
BEGIN
 IF (SELECT status FROM public.novels WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002') <> 'completed'
 OR (SELECT sequel_status FROM public.novels WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002') <> 'announced'
 OR (SELECT status FROM public.translations WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddd0002') <> 'complete'
 THEN RAISE EXCEPTION 'Site admin save failed'; END IF;
END $$;

-- Input validation cannot accidentally overwrite any field.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  PERFORM public.update_editorial_states(
   'cccccccc-cccc-4ccc-8ccc-cccccccc0001','invalid','withdrawn','completed');
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invalid novel status was accepted'; END IF;
END $$;
DO $$
BEGIN
 IF (SELECT status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'hiatus'
 OR (SELECT status FROM public.translations WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccc0001') <> 'paused'
 OR (SELECT sequel_status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'unconfirmed'
 THEN RAISE EXCEPTION 'Invalid input partially wrote metadata'; END IF;
END $$;

RESET ROLE;
-- Force second UPDATE of the RPC to fail AFTER the novel would be updated.
-- PostgreSQL must roll back the first UPDATE as well.
ALTER TABLE public.translations ADD CONSTRAINT qa_reject_withdrawn CHECK (status <> 'withdrawn');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  PERFORM public.update_editorial_states(
   'cccccccc-cccc-4ccc-8ccc-cccccccc0001','cancelled','withdrawn','completed');
 EXCEPTION WHEN check_violation THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Atomic failure fixture did not reject second update'; END IF;
 IF (SELECT status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'hiatus'
 OR (SELECT status FROM public.translations WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccc0001') <> 'paused'
 OR (SELECT sequel_status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'unconfirmed'
 THEN RAISE EXCEPTION 'Novel was partially updated despite failed translation write'; END IF;
END $$;
RESET ROLE;
ALTER TABLE public.translations DROP CONSTRAINT qa_reject_withdrawn;

-- Anonymous SQL role cannot invoke privileged RPC.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  PERFORM public.update_editorial_states(
   'cccccccc-cccc-4ccc-8ccc-cccccccc0001','cancelled','withdrawn','completed');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Anonymous SQL role can execute the RPC'; END IF;
END $$;
RESET ROLE;

-- Verify unauthorized attempts never changed owner project's values.
DO $$
BEGIN
 IF (SELECT status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'hiatus'
 OR (SELECT sequel_status FROM public.novels WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001') <> 'unconfirmed'
 OR (SELECT status FROM public.translations WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccc0001') <> 'paused'
 THEN RAISE EXCEPTION 'Unauthorized test mutated source data'; END IF;
END $$;
\echo 'PASS: migration, owner, editor without publish, proofreader, other-group editor, unauthenticated, admin, invalid state, atomic rollback, anon'
