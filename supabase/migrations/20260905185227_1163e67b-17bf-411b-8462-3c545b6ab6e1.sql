DROP POLICY "conversations visible to members" ON public.conversations;
CREATE POLICY "conversations visible to members" ON public.conversations
  FOR SELECT TO authenticated
  USING (is_member(id, auth.uid()) OR created_by = auth.uid() OR is_admin(auth.uid()));