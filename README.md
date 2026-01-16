# 퀵HW - 카카오T 스타일 퀵배송 플랫폼

모바일 최적화된 종합 퀵배송 시스템입니다. 고객, 배송원, 관리자를 위한 완전한 솔루션을 제공합니다.

## 주요 기능

### 🎯 핵심 기능
- **위치 기반 배송원 자동 할당**: 고객이 배송 요청 시 반경 10km 내 가까운 배송원들에게 자동으로 알림 전송
- **실시간 배송 추적**: Supabase Realtime을 활용한 배송원 위치 실시간 추적
- **자동 알림 시스템**: 배송 상태 변경 시 관련 사용자들에게 자동 알림
- **수익 관리**: 플랫폼 수수료, 배송원 수익 자동 계산 및 관리
- **세금계산서 발행**: 관리자용 세금계산서 발행 기능

### 👥 역할별 기능

#### 고객 (Customer)
- 지도 기반 배송 요청
- 실시간 배송 추적
- 배송 이력 관리
- 배송원 평가 및 리뷰

#### 배송원 (Driver)
- 가까운 배송 요청 자동 수신 (반경 10km)
- 배송 수락/거부
- GPS 기반 실시간 위치 업데이트
- 배송 상태 관리 (수락 → 픽업 → 배송 중 → 완료)
- 수익 통계 확인

#### 관리자 (Admin)
- 전체 배송 모니터링
- 플랫폼 수익 분석
- 세금계산서 발행
- 사용자 관리

## 기술 스택

- **프론트엔드**: Next.js 16, React 19, TypeScript
- **스타일링**: Tailwind CSS v4, shadcn/ui
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth
- **실시간**: Supabase Realtime
- **배포**: Vercel

## 시스템 아키텍처

### 위치 기반 배송원 할당 시스템

1. **배송 요청 생성**
   - 고객이 배송 요청을 생성하면 `deliveries` 테이블에 INSERT
   - `notify_nearby_drivers` 트리거가 자동 실행

2. **가까운 배송원 찾기**
   - `find_nearby_drivers` 함수가 반경 10km 내 활성 배송원 검색
   - 하버사인 공식으로 거리 계산 후 가까운 순으로 정렬

3. **자동 알림 전송**
   - 찾은 배송원들에게 `notifications` 테이블에 알림 생성
   - Supabase Realtime을 통해 실시간으로 알림 전송

4. **배송원 수락**
   - 배송원이 배송을 수락하면 다른 배송원의 알림은 자동으로 읽음 처리
   - 배송 상태가 'accepted'로 변경

### 데이터베이스 스키마

```sql
-- 주요 테이블
- users: 사용자 기본 정보
- user_profiles: 사용자 프로필 (고객)
- driver_info: 배송원 정보 및 현재 위치
- deliveries: 배송 요청 및 상태
- delivery_tracking: GPS 추적 기록
- notifications: 실시간 알림
- pricing_config: 요금 설정
- invoices: 세금계산서
```

### Row Level Security (RLS)

모든 테이블에 RLS 정책이 적용되어 있어 사용자는 자신의 데이터만 접근 가능합니다.

## 설치 및 실행
 
### 🚀 빠른 시작 (로컬 개발)

#### 1단계: 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하세요:

```bash
# Windows PowerShell
Copy-Item .env.local.example .env.local

# 또는 직접 생성
```

`.env.local` 파일 내용:
```env
NEXT_PUBLIC_QUICKSUPABASE_URL=https://xzqfrdzzmbkhkddtiune.supabase.co
NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/verify-email
```

#### 2단계: 의존성 설치

```bash
npm install
```

또는 pnpm 사용:
```bash
pnpm install
```

#### 3단계: 개발 서버 실행

**방법 1: npm 사용**
```bash
npm run dev
```

**방법 2: PowerShell 스크립트 사용 (Windows)**
```powershell
.\start-dev.ps1
```

**방법 3: 다른 포트로 실행**
```bash
npm run dev -- -p 3001
```

#### 4단계: 브라우저에서 접속

개발 서버가 시작되면 브라우저에서 접속:
- **로컬 주소**: http://localhost:3000

> 📖 더 자세한 내용은 [LOCAL_SETUP.md](./LOCAL_SETUP.md) 파일을 참고하세요.

### 📊 데이터베이스 설정

`scripts` 폴더의 SQL 파일들을 Supabase 대시보드에서 순서대로 실행:

```bash
scripts/001_create_schema.sql
scripts/002_row_level_security.sql
scripts/003_seed_data.sql
scripts/004_functions.sql
scripts/005_nearby_driver_allocation.sql
```

또는 `scripts/000_COMPLETE_SETUP.sql` 파일을 실행하여 한 번에 설정할 수 있습니다.

## 사용 방법

### 고객으로 시작하기

1. 메인 페이지에서 "고객으로 가입" 클릭
2. 이메일 인증 완료
3. "배송 요청하기" 클릭
4. 픽업 및 배송 정보 입력
5. 실시간으로 배송 상태 확인

### 배송원으로 시작하기

1. 메인 페이지에서 "배송원으로 가입" 클릭
2. 차량 정보 및 면허 정보 입력
3. 위치 권한 허용 (GPS 추적 필요)
4. "근무 시작" 토글로 배송 가능 상태 전환
5. 가까운 배송 요청 수신 및 수락

### 관리자

1. 관리자 계정으로 로그인
2. `/admin` 페이지에서 전체 배송 현황 확인
3. 수익 분석 및 세금계산서 발행

## 위치 추적 시스템

### GPS 위치 업데이트

배송원의 위치는 다음과 같이 업데이트됩니다:

1. **자동 위치 업데이트**: `DriverLocationUpdater` 컴포넌트가 30초마다 자동으로 GPS 위치 수집
2. **실시간 전송**: Supabase를 통해 `driver_info` 테이블 업데이트
3. **추적 기록**: 진행 중인 배송이 있으면 `delivery_tracking` 테이블에 기록

### 실시간 추적

고객은 배송 상세 페이지에서:
- 배송원의 현재 위치를 실시간으로 확인
- 예상 도착 시간 확인
- 배송 상태 타임라인 확인

## 알림 시스템

### 자동 알림 발송 시점

1. **배송 요청 생성**: 가까운 배송원들에게 알림
2. **배송원 수락**: 고객에게 알림
3. **픽업 완료**: 고객에게 알림
4. **배송 시작**: 고객에게 알림
5. **배송 완료**: 고객과 배송원에게 알림
6. **배송 취소**: 모든 관련자에게 알림

### 카카오톡 알림 (향후 구현)

현재는 앱 내 알림만 구현되어 있으며, 카카오톡 알림은 다음 단계로 추가 가능합니다:
- 카카오톡 비즈니스 API 연동
- 알림톡 템플릿 등록
- `notifications` 테이블의 데이터를 카카오톡으로 전송

## 요금 계산

요금은 자동으로 계산됩니다:

```
총 요금 = 기본 요금 + (거리 × km당 요금)
배송원 수익 = 총 요금 - 플랫폼 수수료
```

기본 설정:
- 기본 요금: 5,000원
- km당 요금: 1,000원
- 플랫폼 수수료: 20%
- 최소 배송원 수익: 4,000원

## 보안

- Row Level Security (RLS)로 모든 데이터 보호
- Supabase Auth를 통한 안전한 인증
- 역할 기반 접근 제어 (RBAC)
- 환경 변수를 통한 민감 정보 관리

## 모바일 최적화

- 반응형 디자인으로 모든 화면 크기 지원
- 터치 친화적인 UI
- 하단 네비게이션으로 빠른 이동
- PWA 지원 가능 (향후 추가)

## 라이선스

MIT

## 문의

시스템 관련 문의사항은 이슈로 등록해주세요.
