-- Notification preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_groups boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_voice_calls boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_video_calls boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_xups boolean NOT NULL DEFAULT false;

-- XUP types
DO $$ BEGIN
  CREATE TYPE public.xup_kind AS ENUM ('text','image','video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.xup_audience AS ENUM ('contacts','contacts_except','only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.xups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.xup_kind NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  caption text,
  background text,
  audience public.xup_audience NOT NULL DEFAULT 'contacts',
  audience_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xups TO authenticated;
GRANT ALL ON public.xups TO service_role;
ALTER TABLE public.xups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.xup_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xup_id uuid NOT NULL REFERENCES public.xups(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (xup_id, viewer_id)
);

GRANT SELECT, INSERT ON public.xup_views TO authenticated;
GRANT ALL ON public.xup_views TO service_role;
ALTER TABLE public.xup_views ENABLE ROW LEVEL SECURITY;

-- Visibility helper
CREATE OR REPLACE FUNCTION public.can_view_xup(_xup_id uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.xups x
    WHERE x.id = _xup_id
      AND (
        x.user_id = _viewer
        OR (
          x.expires_at > now()
          AND NOT public.is_blocked_between(x.user_id, _viewer)
          AND EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.owner_id = x.user_id AND c.contact_id = _viewer
          )
          AND (
            (x.audience = 'contacts')
            OR (x.audience = 'contacts_except' AND NOT (_viewer = ANY (x.audience_ids)))
            OR (x.audience = 'only' AND _viewer = ANY (x.audience_ids))
          )
        )
      )
  )
$$;

CREATE POLICY "xups insert own" ON public.xups
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "xups delete own" ON public.xups
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "xups update own" ON public.xups
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "xups visible to audience" ON public.xups
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR is_admin(auth.uid())
    OR (
      expires_at > now()
      AND NOT public.is_blocked_between(user_id, auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.owner_id = xups.user_id AND c.contact_id = auth.uid()
      )
      AND (
        (audience = 'contacts')
        OR (audience = 'contacts_except' AND NOT (auth.uid() = ANY (audience_ids)))
        OR (audience = 'only' AND auth.uid() = ANY (audience_ids))
      )
    )
  );

CREATE POLICY "xup views insert by viewer" ON public.xup_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid() AND public.can_view_xup(xup_id, auth.uid()));

CREATE POLICY "xup views visible to owner or viewer" ON public.xup_views
  FOR SELECT TO authenticated USING (
    viewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.xups x WHERE x.id = xup_views.xup_id AND x.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS xups_user_created_idx ON public.xups (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS xups_expires_idx ON public.xups (expires_at);
CREATE INDEX IF NOT EXISTS xup_views_xup_idx ON public.xup_views (xup_id);

ALTER TABLE public.xups REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.xups;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;