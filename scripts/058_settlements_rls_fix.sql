-- Fix: public.settlements exposed via API without RLS (sensitive column: bank_account)
-- Supabase Security Advisory: Table with potentially sensitive data must have RLS enabled.

-- 1. Enable Row Level Security on settlements
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Drivers can view own settlements" ON public.settlements;
DROP POLICY IF EXISTS "Admins can manage settlements" ON public.settlements;

-- 3. Create RLS policies
-- Drivers: SELECT only their own rows
CREATE POLICY "Drivers can view own settlements"
  ON public.settlements FOR SELECT
  USING (auth.uid() = driver_id);

-- Admins: full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage settlements"
  ON public.settlements FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Ensure service role / backend operations work via SECURITY DEFINER functions if needed.
-- Note: Service role key bypasses RLS; anon key respects these policies.
-- Unauthenticated requests will get no rows (auth.uid() = null fails both policies).
