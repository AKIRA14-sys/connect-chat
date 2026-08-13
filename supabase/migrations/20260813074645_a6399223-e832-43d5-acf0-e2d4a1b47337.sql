CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- CONTACTS
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_id),
  CHECK (owner_id <> contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts owner select" ON public.contacts FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "contacts owner insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "contacts owner update" ON public.contacts FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "contacts owner delete" ON public.contacts FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BLOCKS
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks owner select" ON public.blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "blocks owner insert" ON public.blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "blocks owner delete" ON public.blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- PUSH SUBSCRIPTIONS
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push own select" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push own insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push own update" ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "push own delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BLOCK HELPER
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = _a AND b.blocked_id = _b) OR (b.blocker_id = _b AND b.blocked_id = _a)
  )
$$;

-- DIRECT CHAT WITHOUT FRIEND REQUESTS
CREATE OR REPLACE FUNCTION public.get_or_create_direct(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _conv uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _me = _other THEN RAISE EXCEPTION 'You cannot message yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _other) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF public.is_blocked_between(_me, _other) THEN RAISE EXCEPTION 'This conversation is unavailable'; END IF;
  SELECT c.id INTO _conv FROM public.conversations c
    JOIN public.conversation_members a ON a.conversation_id = c.id AND a.user_id = _me
    JOIN public.conversation_members b ON b.conversation_id = c.id AND b.user_id = _other
    WHERE c.type = 'direct' LIMIT 1;
  IF _conv IS NOT NULL THEN RETURN _conv; END IF;
  INSERT INTO public.conversations (type, created_by) VALUES ('direct', _me) RETURNING id INTO _conv;
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES (_conv, _me, 'member'), (_conv, _other, 'member');
  RETURN _conv;
END; $$;

-- CALLS: allow anyone not blocked
DROP POLICY IF EXISTS "calls insert by caller" ON public.calls;
CREATE POLICY "calls insert by caller" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid() AND NOT public.is_blocked_between(caller_id, callee_id));

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members (user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON public.conversation_members (conversation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts (owner_id);
CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations (last_message_at DESC);

-- REALTIME
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;