-- 공지사항 테이블
-- 관리자: 등록/수정/삭제 | 고객·기사: 조회

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  target_audience TEXT NOT NULL DEFAULT 'common' CHECK (target_audience IN ('customer', 'driver', 'common')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 최신순 조회
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON announcements(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience ON announcements(target_audience);

-- RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 읽기: 로그인 사용자 (고객, 기사, 관리자)
DROP POLICY IF EXISTS "Authenticated can read announcements" ON announcements;
CREATE POLICY "Authenticated can read announcements"
  ON announcements FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 쓰기: 관리자만
DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;
CREATE POLICY "Admins can manage announcements"
  ON announcements FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
