-- Fix: View public.user_point_balance is defined with SECURITY DEFINER
-- Supabase: Views should run with the querying user's permissions (SECURITY INVOKER)
-- so that RLS on the underlying `points` table is enforced.

-- PostgreSQL 15+: set view to run as the invoking user, not the view owner
ALTER VIEW IF EXISTS public.user_point_balance SET (security_invoker = true);
