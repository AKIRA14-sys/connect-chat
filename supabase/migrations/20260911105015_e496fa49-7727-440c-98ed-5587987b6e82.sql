-- 1. exactly one master admin, enforced by the database
CREATE UNIQUE INDEX IF NOT EXISTS one_master_admin_only
  ON public.user_roles ((role)) WHERE role = 'master_admin';

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master_admin')
$$;

CREATE OR REPLACE FUNCTION public.master_admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'master_admin')
$$;

CREATE OR REPLACE FUNCTION public.claim_master_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  BEGIN
    INSERT INTO public.user_roles (user_id, role) VALUES (_me, 'master_admin');
  EXCEPTION WHEN unique_violation THEN
    IF public.is_master_admin(_me) THEN
      RETURN jsonb_build_object('ok', true, 'already', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, metadata)
    VALUES (_me, 'master_admin_claimed', 'user', _me, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'already', false);
END $$;

REVOKE ALL ON FUNCTION public.claim_master_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_master_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_admin_exists() TO authenticated, anon;

-- 2. platform settings (feature flags, maintenance, app version)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "settings master write" ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_master_admin(auth.uid())) WITH CHECK (public.is_master_admin(auth.uid()));
CREATE TRIGGER platform_settings_updated_at BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (key, value) VALUES
  ('features', '{"voice_messages":true,"video_calls":true,"xups":true,"file_sharing":true,"push_notifications":true,"registration":true}'::jsonb),
  ('maintenance', '{"enabled":false,"message":""}'::jsonb),
  ('app_version', '{"current":"1.0.0","minimum":"1.0.0","update_required":false,"message":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  publish_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live announcements readable" ON public.announcements FOR SELECT
  USING (published AND publish_at <= now() AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "master reads all announcements" ON public.announcements FOR SELECT TO authenticated
  USING (public.is_master_admin(auth.uid()));
CREATE POLICY "master writes announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.is_master_admin(auth.uid())) WITH CHECK (public.is_master_admin(auth.uid()));
CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS announcements_live_idx ON public.announcements (published, publish_at DESC);

-- 4. feedback / support
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'feedback',
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback readable" ON public.feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_master_admin(auth.uid()));
CREATE POLICY "users create feedback" ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "master updates feedback" ON public.feedback FOR UPDATE TO authenticated
  USING (public.is_master_admin(auth.uid())) WITH CHECK (public.is_master_admin(auth.uid()));
CREATE POLICY "master deletes feedback" ON public.feedback FOR DELETE TO authenticated
  USING (public.is_master_admin(auth.uid()));
CREATE TRIGGER feedback_updated_at BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS feedback_status_idx ON public.feedback (status, created_at DESC);

-- 5. audit log readable by master admin only
DROP POLICY IF EXISTS "Admins read audit" ON public.admin_audit_log;
CREATE POLICY "master reads audit" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_master_admin(auth.uid()));
