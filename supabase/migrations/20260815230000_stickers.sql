-- ============================================================
-- WHATSXUP STICKERS
-- ============================================================

ALTER TYPE public.msg_type
  ADD VALUE IF NOT EXISTS 'sticker';

ALTER TABLE public.messages
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