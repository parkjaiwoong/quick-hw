-- Enable RLS on all public tables reported by Supabase (RLS Disabled in Public)
-- Run via: node scripts/apply-059-rls.js

-- Helper: enable RLS only if table exists
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'fcm_receipt_log','connection_test','platform_settings','pricing_config',
    'orders','customer','customer_referral','rider','referrals','points',
    'accident_reports','trigger_logs','notification_audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'RLS enabled: %', t;
    END IF;
  END LOOP;
END $$;

-- ========== fcm_receipt_log (insert by service role; anon read none)
DROP POLICY IF EXISTS "Admins can view fcm_receipt_log" ON public.fcm_receipt_log;
CREATE POLICY "Admins can view fcm_receipt_log"
  ON public.fcm_receipt_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Allow insert for authenticated (driver app sends with JWT)
DROP POLICY IF EXISTS "Drivers can insert fcm_receipt_log" ON public.fcm_receipt_log;
CREATE POLICY "Drivers can insert fcm_receipt_log"
  ON public.fcm_receipt_log FOR INSERT
  WITH CHECK (auth.uid() = driver_id OR driver_id IS NULL);

-- ========== connection_test (if exists: admin only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='connection_test') THEN
    DROP POLICY IF EXISTS "Admins can manage connection_test" ON public.connection_test;
    CREATE POLICY "Admins can manage connection_test"
      ON public.connection_test FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ========== platform_settings (read: authenticated, write: admin)
DROP POLICY IF EXISTS "Authenticated can read platform_settings" ON public.platform_settings;
CREATE POLICY "Authenticated can read platform_settings"
  ON public.platform_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins can manage platform_settings" ON public.platform_settings;
CREATE POLICY "Admins can manage platform_settings"
  ON public.platform_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== pricing_config (read: authenticated, write: admin)
DROP POLICY IF EXISTS "Authenticated can read pricing_config" ON public.pricing_config;
CREATE POLICY "Authenticated can read pricing_config"
  ON public.pricing_config FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins can manage pricing_config" ON public.pricing_config;
CREATE POLICY "Admins can manage pricing_config"
  ON public.pricing_config FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== orders (customer own + admin)
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = customer_id);
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;
CREATE POLICY "Customers can insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
CREATE POLICY "Admins can manage orders"
  ON public.orders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== customer (admin only; app uses via service/admin)
DROP POLICY IF EXISTS "Admins can manage customer" ON public.customer;
CREATE POLICY "Admins can manage customer"
  ON public.customer FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== customer_referral (admin all; rider read own)
DROP POLICY IF EXISTS "Admins can manage customer_referral" ON public.customer_referral;
CREATE POLICY "Admins can manage customer_referral"
  ON public.customer_referral FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Riders can view own customer_referral" ON public.customer_referral;
CREATE POLICY "Riders can view own customer_referral"
  ON public.customer_referral FOR SELECT
  USING (auth.uid() = rider_id);

-- ========== rider (admin only)
DROP POLICY IF EXISTS "Admins can manage rider" ON public.rider;
CREATE POLICY "Admins can manage rider"
  ON public.rider FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== referrals (user own + admin)
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
DROP POLICY IF EXISTS "Admins can manage referrals" ON public.referrals;
CREATE POLICY "Admins can manage referrals"
  ON public.referrals FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== points (user own + admin)
DROP POLICY IF EXISTS "Users can view own points" ON public.points;
CREATE POLICY "Users can view own points"
  ON public.points FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own points" ON public.points;
CREATE POLICY "Users can insert own points"
  ON public.points FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage points" ON public.points;
CREATE POLICY "Admins can manage points"
  ON public.points FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== accident_reports (driver/customer/reporter + admin)
DROP POLICY IF EXISTS "Users can view related accident_reports" ON public.accident_reports;
CREATE POLICY "Users can view related accident_reports"
  ON public.accident_reports FOR SELECT
  USING (
    auth.uid() = driver_id OR auth.uid() = customer_id OR auth.uid() = reporter_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
DROP POLICY IF EXISTS "Users can insert accident_reports" ON public.accident_reports;
CREATE POLICY "Users can insert accident_reports"
  ON public.accident_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id OR auth.uid() = driver_id OR auth.uid() = customer_id);
DROP POLICY IF EXISTS "Drivers and admin can update accident_reports" ON public.accident_reports;
CREATE POLICY "Drivers and admin can update accident_reports"
  ON public.accident_reports FOR UPDATE
  USING (auth.uid() = driver_id OR auth.uid() = reporter_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can manage accident_reports" ON public.accident_reports;
CREATE POLICY "Admins can manage accident_reports"
  ON public.accident_reports FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== trigger_logs (admin only; debug)
DROP POLICY IF EXISTS "Admins can manage trigger_logs" ON public.trigger_logs;
CREATE POLICY "Admins can manage trigger_logs"
  ON public.trigger_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ========== notification_audit_log (insert by service role; admin read)
DROP POLICY IF EXISTS "Admins can view notification_audit_log" ON public.notification_audit_log;
CREATE POLICY "Admins can view notification_audit_log"
  ON public.notification_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Service can insert notification_audit_log" ON public.notification_audit_log;
CREATE POLICY "Service can insert notification_audit_log"
  ON public.notification_audit_log FOR INSERT
  WITH CHECK (true);
