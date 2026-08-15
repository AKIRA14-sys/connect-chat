-- XUPs foundation additions (non-destructive)
ALTER TABLE public.xups ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS xups_created_idx ON public.xups (created_at DESC);
CREATE INDEX IF NOT EXISTS xups_user_idx ON public.xups (user_id);
CREATE INDEX IF NOT EXISTS xup_views_viewer_idx ON public.xup_views (viewer_id);

-- Hide soft-deleted XUPs from others
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
    AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.owner_id = xups.user_id AND c.contact_id = auth.uid())
    AND (
      audience = 'contacts'::xup_audience
      OR (audience = 'contacts_except'::xup_audience AND NOT (auth.uid() = ANY (audience_ids)))
      OR (audience = 'only'::xup_audience AND auth.uid() = ANY (audience_ids))
    )
  )
);

CREATE OR REPLACE FUNCTION public.can_view_xup(_xup_id uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.xups x
    WHERE x.id = _xup_id
      AND (
        x.user_id = _viewer
        OR (
          x.deleted_at IS NULL
          AND x.expires_at > now()
          AND NOT public.is_blocked_between(x.user_id, _viewer)
          AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.owner_id = x.user_id AND c.contact_id = _viewer)
          AND (
            (x.audience = 'contacts')
            OR (x.audience = 'contacts_except' AND NOT (_viewer = ANY (x.audience_ids)))
            OR (x.audience = 'only' AND _viewer = ANY (x.audience_ids))
          )
        )
      )
  )
$function$;

-- Reactions
CREATE TABLE IF NOT EXISTS public.xup_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xup_id uuid NOT NULL REFERENCES public.xups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (xup_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS xup_reactions_xup_idx ON public.xup_reactions (xup_id);
CREATE INDEX IF NOT EXISTS xup_reactions_user_idx ON public.xup_reactions (user_id);

GRANT SELECT, INSERT, DELETE ON public.xup_reactions TO authenticated;
GRANT ALL ON public.xup_reactions TO service_role;

ALTER TABLE public.xup_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xup reactions visible to owner or reactor" ON public.xup_reactions;
CREATE POLICY "xup reactions visible to owner or reactor" ON public.xup_reactions
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.xups x WHERE x.id = xup_reactions.xup_id AND x.user_id = auth.uid())
);

DROP POLICY IF EXISTS "xup reactions insert own" ON public.xup_reactions;
CREATE POLICY "xup reactions insert own" ON public.xup_reactions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_view_xup(xup_id, auth.uid()));

DROP POLICY IF EXISTS "xup reactions delete own" ON public.xup_reactions;
CREATE POLICY "xup reactions delete own" ON public.xup_reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());