-- Fix: Functions with role mutable search_path (Supabase security warning)
-- Set search_path = public on each function so they are not subject to search_path injection.

ALTER FUNCTION public.increment_driver_wallet_pending(uuid, numeric) SET search_path = public;
ALTER FUNCTION public.move_driver_wallet_pending_to_available(uuid, numeric) SET search_path = public;
ALTER FUNCTION public.calculate_rewards_for_order(uuid) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.calculate_distance(double precision, double precision, double precision, double precision) SET search_path = public;
ALTER FUNCTION public.find_nearby_drivers(double precision, double precision, double precision, integer) SET search_path = public;
ALTER FUNCTION public.notify_nearby_drivers() SET search_path = public;
ALTER FUNCTION public.mark_other_notifications_read() SET search_path = public;
