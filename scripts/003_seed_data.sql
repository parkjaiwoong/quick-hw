-- 테스트 데이터 시드 (개발용)

-- 관리자 계정은 Supabase Auth를 통해 생성되어야 하므로 여기서는 스키마만 준비

-- 참고: 실제 사용자 계정은 앱에서 회원가입을 통해 생성됩니다
-- 이 파일은 개발 환경에서 테스트용 데이터를 생성하는 데 사용할 수 있습니다

-- 기본 요금 설정 (별도 테이블이 필요할 수 있음)
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_fee DECIMAL(10, 2) DEFAULT 3000,
  per_km_fee DECIMAL(10, 2) DEFAULT 1000,
  platform_commission_rate DECIMAL(5, 2) DEFAULT 20.00,
  min_driver_fee DECIMAL(10, 2) DEFAULT 2000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pricing_config (base_fee, per_km_fee, platform_commission_rate, min_driver_fee)
VALUES (3000, 1000, 20.00, 2000);

-- 플랫폼 설정
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT DEFAULT '퀵HW',
  business_number TEXT DEFAULT '123-45-67890',
  ceo_name TEXT DEFAULT '홍길동',
  company_address TEXT DEFAULT '서울특별시 강남구 테헤란로 123',
  contact_phone TEXT DEFAULT '02-1234-5678',
  contact_email TEXT DEFAULT 'contact@quickhw.com',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (company_name, business_number, ceo_name, company_address, contact_phone, contact_email)
VALUES ('퀵HW', '123-45-67890', '홍길동', '서울특별시 강남구 테헤란로 123', '02-1234-5678', 'contact@quickhw.com');
