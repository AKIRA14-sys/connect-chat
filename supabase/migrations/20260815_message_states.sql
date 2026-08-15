ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE TABLE IF NOT EXISTS public.message_deletions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_deletions_user_idx
ON public.message_deletions(user_id, deleted_at);

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message deletions visible to owner"
ON public.message_deletions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "message deletions insert own"
ON public.message_deletions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "message deletions delete own"
ON public.message_deletions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE TABLE IF NOT EXISTS public.message_deletions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_deletions_user_idx
ON public.message_deletions(user_id, deleted_at);

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message deletions visible to owner"
ON public.message_deletions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "message deletions insert own"
ON public.message_deletions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "message deletions delete own"
ON public.message_deletions
FOR DELETE TO authenticated
USING (user_id = auth.uid());