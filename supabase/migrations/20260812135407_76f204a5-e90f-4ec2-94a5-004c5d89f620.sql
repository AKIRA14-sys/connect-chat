
CREATE TYPE public.app_role AS ENUM ('master_admin','admin','user');
CREATE TYPE public.friend_status AS ENUM ('pending','accepted','blocked');
CREATE TYPE public.conv_type AS ENUM ('direct','group');
CREATE TYPE public.member_role AS ENUM ('owner','admin','member');
CREATE TYPE public.msg_type AS ENUM ('text','image','video','audio','system');
CREATE TYPE public.account_status AS ENUM ('active','suspended','banned');
CREATE TYPE public.call_kind AS ENUM ('voice','video');
CREATE TYPE public.call_status AS ENUM ('ringing','accepted','declined','missed','ended','failed');
CREATE TYPE public.report_target AS ENUM ('user','message','group','media');
CREATE TYPE public.report_status AS ENUM ('open','resolved','rejected');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'New user',
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  show_online_status BOOLEAN NOT NULL DEFAULT true,
  show_read_receipts BOOLEAN NOT NULL DEFAULT true,
  discoverable BOOLEAN NOT NULL DEFAULT true,
  status public.account_status NOT NULL DEFAULT 'active',
  suspended_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$')
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','master_admin'))
$$;

CREATE POLICY "roles readable by self and admins" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own or admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name','New user'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.status := OLD.status;
    NEW.suspended_until := OLD.suspended_until;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status public.friend_status NOT NULL DEFAULT 'pending',
  blocked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships visible to participants" ON public.friendships FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "friendships insert own" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "friendships update participants" ON public.friendships FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid())
  WITH CHECK (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "friendships delete participants" ON public.friendships FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b) OR (f.requester_id = _b AND f.addressee_id = _a))
  )
$$;

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.conv_type NOT NULL DEFAULT 'direct',
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  only_admins_add_members BOOLEAN NOT NULL DEFAULT false,
  only_admins_edit_info BOOLEAN NOT NULL DEFAULT true,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_conv UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = _conv AND m.user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.is_conv_admin(_conv UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members m
    WHERE m.conversation_id = _conv AND m.user_id = _user AND m.role IN ('owner','admin'))
$$;

CREATE POLICY "conversations visible to members" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_member(id, auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "conversations create own" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "conversations update by admins" ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conv_admin(id, auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_conv_admin(id, auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "conversations delete by owner or platform admin" ON public.conversations FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "members visible to members" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_member(conversation_id, auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "members insert" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conv_admin(conversation_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );
CREATE POLICY "members update by conv admins" ON public.conversation_members FOR UPDATE TO authenticated
  USING (public.is_conv_admin(conversation_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_conv_admin(conversation_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members delete self or admin" ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_conv_admin(conversation_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type public.msg_type NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_duration INTEGER,
  reply_to UUID REFERENCES public.messages ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON public.messages (conversation_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages visible to members" ON public.messages FOR SELECT TO authenticated
  USING (public.is_member(conversation_id, auth.uid()));
CREATE POLICY "messages insert by members" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_member(conversation_id, auth.uid()));
CREATE POLICY "messages update own" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages delete own or conv admin" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.is_conv_admin(conversation_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.bump_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER bump_conv AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

CREATE OR REPLACE FUNCTION public.rate_limit_messages()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER; st public.account_status;
BEGIN
  SELECT status INTO st FROM public.profiles WHERE id = NEW.sender_id;
  IF st IS NOT NULL AND st <> 'active' THEN RAISE EXCEPTION 'Account is % and cannot send messages', st; END IF;
  SELECT count(*) INTO n FROM public.messages
    WHERE sender_id = NEW.sender_id AND created_at > now() - interval '10 seconds';
  IF n >= 30 THEN RAISE EXCEPTION 'Rate limit exceeded, slow down'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER rate_limit_msgs BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_messages();

CREATE TABLE public.message_reads (
  message_id UUID NOT NULL REFERENCES public.messages ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reads visible to conv members" ON public.message_reads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_member(m.conversation_id, auth.uid())));
CREATE POLICY "reads insert own" ON public.message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind public.call_kind NOT NULL DEFAULT 'voice',
  status public.call_status NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls visible to participants" ON public.calls FOR SELECT TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "calls insert by caller" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid() AND public.are_friends(caller_id, callee_id));
CREATE POLICY "calls update by participants" ON public.calls FOR UPDATE TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid())
  WITH CHECK (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status public.report_status NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports visible to reporter or admin" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "reports insert own" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports update by admin" ON public.reports FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit visible to admins" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "audit insert by admins" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND admin_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_or_create_direct(_other UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me UUID := auth.uid(); _conv UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.are_friends(_me, _other) THEN RAISE EXCEPTION 'You can only chat with friends'; END IF;
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
GRANT EXECUTE ON FUNCTION public.get_or_create_direct(UUID) TO authenticated;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.message_reads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;

CREATE POLICY "avatars read authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "chat media read by conv members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media' AND public.is_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "chat media write by conv members" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND public.is_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "chat media delete by owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-media' AND owner = auth.uid());
