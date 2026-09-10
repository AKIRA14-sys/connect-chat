ALTER TABLE public.xups ADD COLUMN IF NOT EXISTS interaction jsonb;

CREATE TABLE IF NOT EXISTS public.xup_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xup_id uuid NOT NULL REFERENCES public.xups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (xup_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xup_poll_votes TO authenticated;
GRANT ALL ON public.xup_poll_votes TO service_role;

ALTER TABLE public.xup_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xup_poll_votes_select" ON public.xup_poll_votes;
CREATE POLICY "xup_poll_votes_select" ON public.xup_poll_votes
  FOR SELECT TO authenticated
  USING (public.can_view_xup(xup_id, auth.uid()));

DROP POLICY IF EXISTS "xup_poll_votes_insert" ON public.xup_poll_votes;
CREATE POLICY "xup_poll_votes_insert" ON public.xup_poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_xup(xup_id, auth.uid()));

DROP POLICY IF EXISTS "xup_poll_votes_update" ON public.xup_poll_votes;
CREATE POLICY "xup_poll_votes_update" ON public.xup_poll_votes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "xup_poll_votes_delete" ON public.xup_poll_votes;
CREATE POLICY "xup_poll_votes_delete" ON public.xup_poll_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS xup_poll_votes_xup_idx ON public.xup_poll_votes(xup_id);