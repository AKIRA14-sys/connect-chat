-- ============================================================
-- WHATSXUP MESSAGE STATES + PER-USER DELETIONS
-- Sent / Delivered / Read
-- ============================================================

-- ============================================================
-- 1. DELIVERY STATE
-- ============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS messages_delivered_idx
  ON public.messages (delivered_at);

-- ============================================================
-- 2. DELIVERY RECEIPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_deliveries (
  message_id uuid NOT NULL
    REFERENCES public.messages(id)
    ON DELETE CASCADE,

  user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  delivered_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_deliveries_user_idx
  ON public.message_deliveries(user_id, delivered_at);

ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.message_deliveries TO authenticated;
GRANT ALL ON public.message_deliveries TO service_role;

-- Remove old policies if this migration is re-run.
DROP POLICY IF EXISTS "message deliveries visible to conversation members"
ON public.message_deliveries;

DROP POLICY IF EXISTS "message deliveries insert own"
ON public.message_deliveries;

-- Members of the conversation can see delivery receipts.
CREATE POLICY "message deliveries visible to conversation members"
ON public.message_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = message_id
      AND public.is_member(m.conversation_id, auth.uid())
  )
);

-- A user can only create their own delivery receipt.
CREATE POLICY "message deliveries insert own"
ON public.message_deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- ============================================================
-- 3. PER-USER MESSAGE DELETIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_deletions (
  message_id uuid NOT NULL
    REFERENCES public.messages(id)
    ON DELETE CASCADE,

  user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  deleted_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_deletions_user_idx
  ON public.message_deletions(user_id, deleted_at);

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE
ON public.message_deletions
TO authenticated;

GRANT ALL
ON public.message_deletions
TO service_role;

DROP POLICY IF EXISTS "message deletions visible to owner"
ON public.message_deletions;

DROP POLICY IF EXISTS "message deletions insert own"
ON public.message_deletions;

DROP POLICY IF EXISTS "message deletions delete own"
ON public.message_deletions;

CREATE POLICY "message deletions visible to owner"
ON public.message_deletions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

CREATE POLICY "message deletions insert own"
ON public.message_deletions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "message deletions delete own"
ON public.message_deletions
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);

-- ============================================================
-- 4. AUTOMATIC MESSAGE DELIVERY
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_message_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. REALTIME
-- ============================================================

ALTER TABLE public.messages
  REPLICA IDENTITY FULL;

ALTER TABLE public.message_deliveries
  REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime
    ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime
    ADD TABLE public.message_deliveries;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

-- ============================================================
-- DONE
-- ============================================================