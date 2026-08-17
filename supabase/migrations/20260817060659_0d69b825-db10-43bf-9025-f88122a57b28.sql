
-- 1. Per-member chat settings (archive / mute / theme) for direct + group chats
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_until timestamptz,
  ADD COLUMN IF NOT EXISTS chat_theme text,
  ADD COLUMN IF NOT EXISTS chat_background text;

CREATE INDEX IF NOT EXISTS conv_members_user_archived_idx
  ON public.conversation_members (user_id, is_archived);

-- 2. XUP reshare
ALTER TABLE public.xups
  ADD COLUMN IF NOT EXISTS reshared_from uuid REFERENCES public.xups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS xups_reshared_from_idx ON public.xups (reshared_from);

-- 3. Relax XUP visibility: either direction of the contact relationship
DROP POLICY IF EXISTS "xups visible to audience" ON public.xups;
CREATE POLICY "xups visible to audience" ON public.xups
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR (
    deleted_at IS NULL
    AND expires_at > now()
    AND NOT public.is_blocked_between(user_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE (c.owner_id = xups.user_id AND c.contact_id = auth.uid())
         OR (c.owner_id = auth.uid() AND c.contact_id = xups.user_id)
    )
    AND (
      audience = 'contacts'
      OR (audience = 'contacts_except' AND NOT (auth.uid() = ANY (audience_ids)))
      OR (audience = 'only' AND auth.uid() = ANY (audience_ids))
    )
  )
);

CREATE OR REPLACE FUNCTION public.can_view_xup(_xup_id uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.xups x
    WHERE x.id = _xup_id
      AND (
        x.user_id = _viewer
        OR (
          x.deleted_at IS NULL
          AND x.expires_at > now()
          AND NOT public.is_blocked_between(x.user_id, _viewer)
          AND EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE (c.owner_id = x.user_id AND c.contact_id = _viewer)
               OR (c.owner_id = _viewer AND c.contact_id = x.user_id)
          )
          AND (
            x.audience = 'contacts'
            OR (x.audience = 'contacts_except' AND NOT (_viewer = ANY (x.audience_ids)))
            OR (x.audience = 'only' AND _viewer = ANY (x.audience_ids))
          )
        )
      )
  )
$$;

-- 4. XUP comments / replies
CREATE TABLE IF NOT EXISTS public.xup_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xup_id uuid NOT NULL REFERENCES public.xups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.xup_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xup_comments TO authenticated;
GRANT ALL ON public.xup_comments TO service_role;
ALTER TABLE public.xup_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xup comments visible" ON public.xup_comments;
CREATE POLICY "xup comments visible" ON public.xup_comments
FOR SELECT TO authenticated
USING (public.can_view_xup(xup_id, auth.uid()));

DROP POLICY IF EXISTS "xup comments insert" ON public.xup_comments;
CREATE POLICY "xup comments insert" ON public.xup_comments
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_view_xup(xup_id, auth.uid()));

DROP POLICY IF EXISTS "xup comments delete" ON public.xup_comments;
CREATE POLICY "xup comments delete" ON public.xup_comments
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.xups x WHERE x.id = xup_comments.xup_id AND x.user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS xup_comments_xup_idx ON public.xup_comments (xup_id, created_at);

-- 5. Saved XUPs
CREATE TABLE IF NOT EXISTS public.xup_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xup_id uuid NOT NULL REFERENCES public.xups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (xup_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.xup_saves TO authenticated;
GRANT ALL ON public.xup_saves TO service_role;
ALTER TABLE public.xup_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xup saves own" ON public.xup_saves;
CREATE POLICY "xup saves own" ON public.xup_saves
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "xup saves insert own" ON public.xup_saves;
CREATE POLICY "xup saves insert own" ON public.xup_saves
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_view_xup(xup_id, auth.uid()));

DROP POLICY IF EXISTS "xup saves delete own" ON public.xup_saves;
CREATE POLICY "xup saves delete own" ON public.xup_saves
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 6. Muted XUP authors
CREATE TABLE IF NOT EXISTS public.xup_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, muted_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.xup_mutes TO authenticated;
GRANT ALL ON public.xup_mutes TO service_role;
ALTER TABLE public.xup_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xup mutes own" ON public.xup_mutes;
CREATE POLICY "xup mutes own" ON public.xup_mutes
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "xup mutes insert own" ON public.xup_mutes;
CREATE POLICY "xup mutes insert own" ON public.xup_mutes
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "xup mutes delete own" ON public.xup_mutes;
CREATE POLICY "xup mutes delete own" ON public.xup_mutes
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.xup_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.xup_views;
ALTER PUBLICATION supabase_realtime ADD TABLE public.xup_saves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
