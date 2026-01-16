-- 추가 기능을 위한 테이블 생성

-- 정산 테이블
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 정산 기간
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  
  -- 정산 금액
  total_deliveries INTEGER DEFAULT 0,
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  platform_fee_total DECIMAL(10, 2) DEFAULT 0,
  net_earnings DECIMAL(10, 2) DEFAULT 0,
  
  -- 정산 상태
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled'
  
  -- 정산 정보
  settlement_date DATE,
  bank_account TEXT,
  bank_name TEXT,
  transaction_id TEXT,
  
  -- 메모
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사고 접수 테이블
CREATE TABLE IF NOT EXISTS accident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- 사고 정보
  accident_type TEXT NOT NULL, -- 'vehicle', 'package_damage', 'injury', 'other'
  accident_date TIMESTAMPTZ NOT NULL,
  accident_location TEXT,
  accident_description TEXT NOT NULL,
  
  -- 사고 상세
  vehicle_damage_description TEXT,
  package_damage_description TEXT,
  injury_description TEXT,
  witness_info TEXT,
  photos JSONB, -- 사진 URL 배열
  
  -- 처리 상태
  status TEXT DEFAULT 'reported', -- 'reported', 'investigating', 'resolved', 'closed'
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL, -- 담당 관리자
  
  -- 처리 정보
  investigation_notes TEXT,
  resolution TEXT,
  compensation_amount DECIMAL(10, 2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 포인트 시스템 테이블
CREATE TABLE IF NOT EXISTS points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 포인트 정보
  points DECIMAL(10, 2) NOT NULL, -- 적립/사용 포인트
  point_type TEXT NOT NULL, -- 'earned', 'used', 'expired', 'refunded'
  source_type TEXT, -- 'delivery', 'referral', 'promotion', 'purchase'
  source_id UUID, -- 관련 ID (delivery_id, referral_id 등)
  
  -- 포인트 상세
  description TEXT,
  expires_at TIMESTAMPTZ, -- 포인트 만료일
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 추천인 시스템 테이블
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- 추천한 사람
  referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- 추천받은 사람
  
  -- 추천 상태
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'rewarded'
  
  -- 보상 정보
  referrer_reward_points DECIMAL(10, 2) DEFAULT 0,
  referred_reward_points DECIMAL(10, 2) DEFAULT 0,
  
  -- 완료 조건 (첫 배송 완료 등)
  completion_condition TEXT DEFAULT 'first_delivery',
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자 포인트 잔액 뷰 (성능 최적화)
CREATE OR REPLACE VIEW user_point_balance AS
SELECT 
  user_id,
  SUM(CASE WHEN point_type = 'earned' THEN points ELSE 0 END) - 
  SUM(CASE WHEN point_type IN ('used', 'expired') THEN points ELSE 0 END) as balance
FROM points
WHERE expires_at IS NULL OR expires_at > NOW()
GROUP BY user_id;

-- 인덱스 생성
CREATE INDEX idx_settlements_driver ON settlements(driver_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_period ON settlements(settlement_period_start, settlement_period_end);

CREATE INDEX idx_accident_reports_delivery ON accident_reports(delivery_id);
CREATE INDEX idx_accident_reports_reporter ON accident_reports(reporter_id);
CREATE INDEX idx_accident_reports_status ON accident_reports(status);

CREATE INDEX idx_points_user ON points(user_id);
CREATE INDEX idx_points_type ON points(point_type);
CREATE INDEX idx_points_expires ON points(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_id);
CREATE INDEX idx_referrals_status ON referrals(status);

-- 트리거 생성
CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accident_reports_updated_at BEFORE UPDATE ON accident_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

