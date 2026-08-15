CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (char_length(reaction) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON public.message_reactions (message_id);

CREATE INDEX IF NOT EXISTS message_reactions_user_idx
  ON public.message_reactions (user_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE
ON public.message_reactions
TO authenticated;

DROP POLICY IF EXISTS "message reactions visible to conversation members"
ON public.message_reactions;

CREATE POLICY "message reactions visible to conversation members"
ON public.message_reactions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversation_members cm
      ON cm.conversation_id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "message reactions insert own"
ON public.message_reactions;

CREATE POLICY "message reactions insert own"
ON public.message_reactions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversation_members cm
      ON cm.conversation_id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "message reactions delete own"
ON public.message_reactions;

CREATE POLICY "message reactions delete own"
ON public.message_reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());