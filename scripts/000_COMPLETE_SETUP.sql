-- ============================================
-- 완전한 데이터베이스 설정 스크립트
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요
-- ============================================

-- 1. 사용자 역할 enum 생성
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'driver', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. 배송 상태 enum 생성
DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'pending',      -- 배송 요청됨
    'accepted',     -- 배송원 수락
    'picked_up',    -- 픽업 완료
    'in_transit',   -- 배송 중
    'delivered',    -- 배송 완료
    'cancelled'     -- 취소됨
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. 사용자 프로필 테이블 생성
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role DEFAULT 'customer',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 배송원 추가 정보 테이블 생성
CREATE TABLE IF NOT EXISTS driver_info (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  bank_account TEXT,
  bank_name TEXT,
  rating DECIMAL(3, 2) DEFAULT 5.00,
  total_deliveries INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  current_location POINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 배송 요청 테이블 생성
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- 픽업 정보
  pickup_address TEXT NOT NULL,
  pickup_location POINT NOT NULL,
  pickup_contact_name TEXT NOT NULL,
  pickup_contact_phone TEXT NOT NULL,
  pickup_notes TEXT,
  
  -- 배송 정보
  delivery_address TEXT NOT NULL,
  delivery_location POINT NOT NULL,
  delivery_contact_name TEXT NOT NULL,
  delivery_contact_phone TEXT NOT NULL,
  delivery_notes TEXT,
  
  -- 배송 상세
  item_description TEXT,
  item_weight DECIMAL(10, 2),
  package_size TEXT,
  
  -- 가격 및 결제
  distance_km DECIMAL(10, 2),
  base_fee DECIMAL(10, 2) NOT NULL,
  distance_fee DECIMAL(10, 2) DEFAULT 0,
  total_fee DECIMAL(10, 2) NOT NULL,
  driver_fee DECIMAL(10, 2),
  platform_fee DECIMAL(10, 2),
  
  -- 상태
  status delivery_status DEFAULT 'pending',
  
  -- 시간 정보
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- 평가
  customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
  customer_review TEXT,
  driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
  driver_review TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 배송 위치 추적 테이블 생성
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  location POINT NOT NULL,
  heading DECIMAL(5, 2),
  speed DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 거래 내역 테이블 생성
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  transaction_type TEXT NOT NULL, -- 'payment', 'payout', 'refund'
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  
  payment_method TEXT,
  payment_details JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 세금계산서 테이블 생성
CREATE TABLE IF NOT EXISTS tax_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  
  invoice_number TEXT UNIQUE NOT NULL,
  issue_date DATE NOT NULL,
  
  -- 공급자 정보 (플랫폼)
  supplier_business_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_address TEXT NOT NULL,
  
  -- 공급받는자 정보
  buyer_name TEXT NOT NULL,
  buyer_business_number TEXT,
  buyer_address TEXT,
  
  -- 금액 정보
  supply_amount DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  
  status TEXT DEFAULT 'issued', -- 'issued', 'sent', 'cancelled'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 알림 테이블 생성
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'delivery_update', 'payment', 'system'
  is_read BOOLEAN DEFAULT false,
  
  kakao_sent BOOLEAN DEFAULT false,
  kakao_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_created ON delivery_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

-- 11. 업데이트 시간 자동 갱신 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 12. 트리거 생성
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_info_updated_at ON driver_info;
CREATE TRIGGER update_driver_info_updated_at BEFORE UPDATE ON driver_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) 설정
-- ============================================

-- 13. profiles 테이블 RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- profiles 테이블 RLS 정책 생성
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 14. driver_info 테이블 RLS 활성화
ALTER TABLE driver_info ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Drivers can insert own info" ON driver_info;
DROP POLICY IF EXISTS "Drivers can view own info" ON driver_info;
DROP POLICY IF EXISTS "Drivers can update own info" ON driver_info;
DROP POLICY IF EXISTS "Admins can view all driver info" ON driver_info;

-- driver_info 테이블 RLS 정책 생성
CREATE POLICY "Drivers can insert own info"
  ON driver_info FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Drivers can view own info"
  ON driver_info FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Drivers can update own info"
  ON driver_info FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all driver info"
  ON driver_info FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 15. deliveries 테이블 RLS 활성화
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Customers can view own deliveries" ON deliveries;
DROP POLICY IF EXISTS "Customers can create deliveries" ON deliveries;
DROP POLICY IF EXISTS "Drivers can view assigned deliveries" ON deliveries;
DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON deliveries;
DROP POLICY IF EXISTS "Admins can view all deliveries" ON deliveries;

-- deliveries 테이블 RLS 정책 생성
CREATE POLICY "Customers can view own deliveries"
  ON deliveries FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create deliveries"
  ON deliveries FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Drivers can view assigned deliveries"
  ON deliveries FOR SELECT
  USING (auth.uid() = driver_id OR driver_id IS NULL);

CREATE POLICY "Drivers can update assigned deliveries"
  ON deliveries FOR UPDATE
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all deliveries"
  ON deliveries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 16. delivery_tracking 테이블 RLS 활성화
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Drivers can insert tracking" ON delivery_tracking;
DROP POLICY IF EXISTS "Users can view delivery tracking" ON delivery_tracking;

-- delivery_tracking 테이블 RLS 정책 생성
CREATE POLICY "Drivers can insert tracking"
  ON delivery_tracking FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Users can view delivery tracking"
  ON delivery_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.id = delivery_tracking.delivery_id
      AND (deliveries.customer_id = auth.uid() OR deliveries.driver_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 17. transactions 테이블 RLS 활성화
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;

-- transactions 테이블 RLS 정책 생성
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 18. tax_invoices 테이블 RLS 활성화
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Users can view own tax invoices" ON tax_invoices;
DROP POLICY IF EXISTS "Admins can manage tax invoices" ON tax_invoices;

-- tax_invoices 테이블 RLS 정책 생성
CREATE POLICY "Users can view own tax invoices"
  ON tax_invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = tax_invoices.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage tax invoices"
  ON tax_invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 19. notifications 테이블 RLS 활성화
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- notifications 테이블 RLS 정책 생성
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 데이터베이스 설정이 완료되었습니다!';
  RAISE NOTICE '✅ 모든 테이블과 RLS 정책이 생성되었습니다.';
  RAISE NOTICE '✅ 이제 회원가입이 정상적으로 작동합니다.';
END $$;

