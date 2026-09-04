CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own fcm tokens"
  ON public.fcm_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fcm tokens"
  ON public.fcm_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fcm tokens"
  ON public.fcm_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fcm tokens"
  ON public.fcm_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX fcm_tokens_user_id_idx ON public.fcm_tokens(user_id);

CREATE TRIGGER fcm_tokens_updated_at
  BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();