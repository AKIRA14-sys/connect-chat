-- ============================================================
-- WHATSXUP — ADD STICKER MESSAGE TYPE
-- ============================================================

-- The existing public.msg_type enum currently contains:
-- text, image, video, audio, system
--
-- The chat UI already supports sticker messages, so add the
-- missing enum value to the database.

ALTER TYPE public.msg_type
ADD VALUE IF NOT EXISTS 'sticker';