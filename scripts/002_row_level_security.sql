-- Row Level Security (RLS) 활성화

-- profiles 테이블 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 프로필 생성 가능 (회원가입 시)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 사용자는 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 사용자는 자신의 프로필만 업데이트 가능
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 관리자는 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- driver_info 테이블 RLS
ALTER TABLE driver_info ENABLE ROW LEVEL SECURITY;

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

-- deliveries 테이블 RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 고객은 자신의 배송만 조회
CREATE POLICY "Customers can view own deliveries"
  ON deliveries FOR SELECT
  USING (auth.uid() = customer_id);

-- 고객은 배송 요청 생성 가능
CREATE POLICY "Customers can create deliveries"
  ON deliveries FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- 배송원은 자신이 담당하는 배송 조회
CREATE POLICY "Drivers can view assigned deliveries"
  ON deliveries FOR SELECT
  USING (auth.uid() = driver_id OR driver_id IS NULL);

-- 배송원은 배송 상태 업데이트 가능
CREATE POLICY "Drivers can update assigned deliveries"
  ON deliveries FOR UPDATE
  USING (auth.uid() = driver_id);

-- 관리자는 모든 배송 조회 및 수정
CREATE POLICY "Admins can view all deliveries"
  ON deliveries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- delivery_tracking 테이블 RLS
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

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

-- transactions 테이블 RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

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

-- tax_invoices 테이블 RLS
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;

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

-- notifications 테이블 RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
