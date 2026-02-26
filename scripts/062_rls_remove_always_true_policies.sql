-- Fix: RLS policies with WITH CHECK (true) or USING (true) that bypass row-level security
-- Supabase: "RLS Policy Always True" – replace with restrictive checks.

-- ========== notification_audit_log
-- Inserts are done only via service role (lib/actions/deliveries.ts). Remove the
-- permissive INSERT policy; service role bypasses RLS and can still insert.
DROP POLICY IF EXISTS "Service can insert notification_audit_log" ON public.notification_audit_log;

-- ========== notifications
-- Replace "System can create notifications" WITH CHECK (true) with a restrictive policy:
-- Only admins can insert for any user; authenticated users can insert only for themselves (user_id = auth.uid()).
-- Service role inserts bypass RLS.
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Admins or self can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
