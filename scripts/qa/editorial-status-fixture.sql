-- Isolated PostgreSQL 17 harness for the live Supabase authorization model.
-- This is NOT production data; every UUID and membership is synthetic.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth,private TO authenticated;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;

CREATE TABLE public.site_admins (user_id uuid PRIMARY KEY);
CREATE TABLE public.group_members (
 group_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL,
 permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY (group_id,user_id)
);
CREATE TABLE public.novels (
 id uuid PRIMARY KEY,
 status text NOT NULL DEFAULT 'ongoing'
   CHECK(status IN ('ongoing','completed','hiatus','cancelled')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.translations (
 id uuid PRIMARY KEY,
 novel_id uuid NOT NULL REFERENCES public.novels(id),
 group_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'active'
   CHECK (status IN ('active','paused','abandoned','complete','withdrawn')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.novels(id,status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001','ongoing'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002','ongoing');
INSERT INTO public.translations(id,novel_id,group_id,status) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccc0001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddd0002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active');
INSERT INTO public.group_members(group_id,user_id,role,permissions) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner','{}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','editor','{"publish":false}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','proofreader','{}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444','editor','{}');
INSERT INTO public.site_admins(user_id) VALUES ('55555555-5555-4555-8555-555555555555');

-- These functions reproduce the connected NLOBI project's authorization helpers.
CREATE FUNCTION private.is_site_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (
 SELECT 1 FROM public.site_admins sa WHERE sa.user_id=(SELECT auth.uid())
) $$;
CREATE FUNCTION private.is_group_member(target_group uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (
 SELECT 1 FROM public.group_members gm
 WHERE gm.group_id=target_group AND gm.user_id=(SELECT auth.uid())
) $$;
CREATE FUNCTION private.team_action_allowed(gid uuid,action_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT coalesce((
 SELECT CASE
   WHEN gm.role IN ('owner','admin') THEN true
   WHEN gm.permissions ? action_name THEN (gm.permissions->>action_name)::boolean
   WHEN action_name IN ('edit','create','import') THEN gm.role IN ('translator','editor')
   WHEN action_name='publish' THEN gm.role IN ('translator','editor')
   WHEN action_name='delete' THEN gm.role='translator'
   WHEN action_name='schedule' THEN gm.role IN ('translator','editor')
   WHEN action_name='review' THEN gm.role IN ('translator','editor','proofreader')
   ELSE false END
 FROM public.group_members gm WHERE gm.group_id=gid AND gm.user_id=(SELECT auth.uid())
 ),false)
$$;
CREATE FUNCTION private.is_group_editor(target_group uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT private.team_action_allowed(target_group,'edit')
   OR private.team_action_allowed(target_group,'create')
   OR private.team_action_allowed(target_group,'import') $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- Existing NLOBI before-UPDATE guard on public.novels (retrieved read-only).
CREATE FUNCTION private.guard_novel_team_actions() RETURNS trigger
LANGUAGE plpgsql SET search_path=''
AS $$
DECLARE t record; action_name text;
BEGIN
 IF private.is_site_admin() THEN
   IF tg_op='DELETE' THEN RETURN old; END IF;
   RETURN new;
 END IF;
 IF tg_op='DELETE' THEN action_name:='delete'; ELSE action_name:='edit'; END IF;
 FOR t IN SELECT DISTINCT group_id FROM public.translations WHERE novel_id=old.id LOOP
   IF NOT private.team_action_allowed(t.group_id,action_name) THEN
     RAISE EXCEPTION 'No tienes permiso para % esta obra',action_name USING errcode='42501';
   END IF;
 END LOOP;
 IF tg_op='DELETE' THEN RETURN old; END IF;
 RETURN new;
END $$;
CREATE TRIGGER novel_team_permission_guard
BEFORE DELETE OR UPDATE ON public.novels
FOR EACH ROW EXECUTE FUNCTION private.guard_novel_team_actions();

-- Pre-migration guard reproduces the critical original behavior:
-- status transitions used to require "publish", even for metadata-only changes.
CREATE FUNCTION private.team_content_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=''
AS $$
DECLARE gid uuid; action_name text;
BEGIN
 IF tg_op='DELETE' THEN gid:=old.group_id;
 ELSE gid:=new.group_id; END IF;
 IF tg_op='DELETE' THEN action_name:='delete';
 ELSIF tg_op='INSERT' THEN action_name:='create';
 ELSIF tg_op='UPDATE' THEN
  IF new.status IS DISTINCT FROM old.status THEN action_name:='publish';
  ELSE action_name:='edit'; END IF;
 END IF;
 IF NOT (current_user='postgres' AND auth.uid() IS NULL)
    AND NOT private.team_action_allowed(gid,action_name)
    AND NOT private.is_site_admin() THEN
    RAISE EXCEPTION 'Permiso % denegado para este equipo',action_name USING errcode='42501';
 END IF;
 IF tg_op='DELETE' THEN RETURN old; END IF;
 RETURN new;
END $$;
CREATE TRIGGER team_guard_translations
BEFORE INSERT OR DELETE OR UPDATE ON public.translations
FOR EACH ROW EXECUTE FUNCTION private.team_content_guard();

-- Copy the effective public/authenticated read & editor write predicates from NLOBI.
ALTER TABLE public.novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY translations_anon_read ON public.translations FOR SELECT TO anon
USING (status IN ('active','complete','paused'));
CREATE POLICY translations_authenticated_read ON public.translations FOR SELECT TO authenticated
USING (status IN ('active','complete','paused') OR private.is_site_admin() OR private.is_group_member(group_id));
CREATE POLICY translations_update ON public.translations FOR UPDATE TO authenticated
USING (private.is_site_admin() OR private.is_group_editor(group_id))
WITH CHECK (private.is_site_admin() OR private.is_group_editor(group_id));
CREATE POLICY novels_anon_read ON public.novels FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.translations t WHERE
 t.novel_id=novels.id AND t.status IN ('active','complete','paused')));
CREATE POLICY novels_authenticated_read ON public.novels FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.translations t WHERE
 t.novel_id=novels.id AND (t.status IN ('active','complete','paused') OR private.is_group_member(t.group_id)))
 OR private.is_site_admin());
CREATE POLICY novels_editor_update ON public.novels FOR UPDATE TO authenticated
USING (private.is_site_admin() OR EXISTS (SELECT 1 FROM public.translations t
 WHERE t.novel_id=novels.id AND private.is_group_editor(t.group_id)))
WITH CHECK (private.is_site_admin() OR EXISTS (SELECT 1 FROM public.translations t
 WHERE t.novel_id=novels.id AND private.is_group_editor(t.group_id)));

GRANT SELECT, UPDATE ON public.novels,public.translations TO authenticated;
GRANT SELECT ON public.novels,public.translations TO anon;
