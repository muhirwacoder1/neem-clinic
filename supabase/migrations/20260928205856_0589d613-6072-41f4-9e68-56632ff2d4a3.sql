DROP POLICY IF EXISTS "staff read blocks" ON public.blocked_slots;
CREATE POLICY "staff read blocks" ON public.blocked_slots FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));