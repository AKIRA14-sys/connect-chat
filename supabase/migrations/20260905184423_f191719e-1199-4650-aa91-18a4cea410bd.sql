-- Profile relationships (mirrors the existing contacts pattern) so the app can
-- load display names / avatars alongside members, messages, xups and comments.
ALTER TABLE public.conversation_members
  ADD CONSTRAINT conversation_members_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_profile_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.xups
  ADD CONSTRAINT xups_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.xup_comments
  ADD CONSTRAINT xup_comments_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.xup_reactions
  ADD CONSTRAINT xup_reactions_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.xup_views
  ADD CONSTRAINT xup_views_viewer_profile_fkey
  FOREIGN KEY (viewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Comment text column name expected by the app.
ALTER TABLE public.xup_comments RENAME COLUMN content TO comment;

-- Helpful indexes for comments / reshares.
CREATE INDEX IF NOT EXISTS xup_comments_xup_created_idx
  ON public.xup_comments (xup_id, created_at);
CREATE INDEX IF NOT EXISTS xups_reshared_from_idx
  ON public.xups (reshared_from);

-- Live updates for reactions and mutes.
ALTER TABLE public.xup_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.xup_mutes REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.xup_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.xup_mutes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;