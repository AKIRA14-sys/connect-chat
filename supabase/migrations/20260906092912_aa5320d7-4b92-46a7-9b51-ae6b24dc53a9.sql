ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS invite_slug text,
  ADD COLUMN IF NOT EXISTS invite_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS join_approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slow_mode_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disappear_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS announce_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_invite_slug_uidx
  ON public.conversations (invite_slug)
  WHERE invite_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.group_bans (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_bans TO authenticated;
GRANT ALL ON public.group_bans TO service_role;

ALTER TABLE public.group_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_bans_select_members" ON public.group_bans;
CREATE POLICY "group_bans_select_members" ON public.group_bans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members m
      WHERE m.conversation_id = group_bans.conversation_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "group_bans_admin_write" ON public.group_bans;
CREATE POLICY "group_bans_admin_write" ON public.group_bans
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members m
      WHERE m.conversation_id = group_bans.conversation_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_members m
      WHERE m.conversation_id = group_bans.conversation_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_join_requests TO authenticated;
GRANT ALL ON public.group_join_requests TO service_role;

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "join_req_select" ON public.group_join_requests;
CREATE POLICY "join_req_select" ON public.group_join_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members m
      WHERE m.conversation_id = group_join_requests.conversation_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "join_req_insert_self" ON public.group_join_requests;
CREATE POLICY "join_req_insert_self" ON public.group_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "join_req_admin_update" ON public.group_join_requests;
CREATE POLICY "join_req_admin_update" ON public.group_join_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members m
      WHERE m.conversation_id = group_join_requests.conversation_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "conversations_select_by_active_invite" ON public.conversations;
CREATE POLICY "conversations_select_by_active_invite" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    type = 'group'
    AND invite_enabled = true
    AND invite_slug IS NOT NULL
  );

DROP POLICY IF EXISTS "group_bans_select_own" ON public.group_bans;
CREATE POLICY "group_bans_select_own" ON public.group_bans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
