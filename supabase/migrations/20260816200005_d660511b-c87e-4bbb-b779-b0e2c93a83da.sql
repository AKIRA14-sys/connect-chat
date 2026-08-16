-- 1. Stickers
ALTER TYPE public.msg_type ADD VALUE IF NOT EXISTS 'sticker';

-- 2. XUPs storage policies (bucket "xups" already created)
CREATE POLICY "xup media read authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'xups');
CREATE POLICY "xup media insert own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'xups' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "xup media update own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'xups' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'xups' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "xup media delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'xups' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Contacts -> profiles relationships (fixes PostgREST embeds)
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_contact_profile_fkey FOREIGN KEY (contact_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT contacts_owner_profile_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Message reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, reaction)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions visible to conv members" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_member(m.conversation_id, auth.uid())));
CREATE POLICY "reactions insert own" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_member(m.conversation_id, auth.uid())));
CREATE POLICY "reactions delete own" ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON public.message_reactions(message_id);
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- 5. Delete for me
CREATE TABLE IF NOT EXISTS public.message_deletions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_deletions TO authenticated;
GRANT ALL ON public.message_deletions TO service_role;
ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hidden messages select own" ON public.message_deletions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "hidden messages insert own" ON public.message_deletions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "hidden messages update own" ON public.message_deletions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "hidden messages delete own" ON public.message_deletions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS message_deletions_user_idx ON public.message_deletions(user_id);

-- messages stay hidden for that user across reloads
DROP POLICY IF EXISTS "messages visible to members" ON public.messages;
CREATE POLICY "messages visible to members" ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_member(conversation_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.message_deletions d
      WHERE d.message_id = messages.id AND d.user_id = auth.uid()
    )
  );

-- 6. XUP indexes for expiration filtering
CREATE INDEX IF NOT EXISTS xups_expires_idx ON public.xups(expires_at);