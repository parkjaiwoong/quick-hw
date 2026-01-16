# 기술 스택 및 언어 정리

## 📝 사용 언어

### 프로그래밍 언어
- **TypeScript** (5.x)
  - 모든 컴포넌트와 로직에 TypeScript 사용
  - 타입 안정성 보장
  - `.ts`, `.tsx` 파일 확장자

### 마크업/스타일 언어
- **HTML** (JSX/TSX 내부)
- **CSS** (Tailwind CSS 클래스 기반)
- **SQL** (데이터베이스 스키마 및 쿼리)

---

## 🛠️ 프론트엔드 기술

### 핵심 프레임워크
- **Next.js 16.0.10**
  - App Router 사용 (`app/` 디렉토리 구조)
  - Server Components 및 Server Actions
  - 파일 기반 라우팅

- **React 19.2.0**
  - 최신 React 버전
  - React DOM 19.2.0

### UI 라이브러리
- **shadcn/ui**
  - Radix UI 기반 컴포넌트 라이브러리
  - 접근성(Accessibility) 최적화
  - 사용된 Radix UI 패키지:
    - `@radix-ui/react-accordion`
    - `@radix-ui/react-alert-dialog`
    - `@radix-ui/react-avatar`
    - `@radix-ui/react-checkbox`
    - `@radix-ui/react-dialog`
    - `@radix-ui/react-dropdown-menu`
    - `@radix-ui/react-label`
    - `@radix-ui/react-popover`
    - `@radix-ui/react-select`
    - `@radix-ui/react-slider`
    - `@radix-ui/react-switch`
    - `@radix-ui/react-tabs`
    - `@radix-ui/react-toast`
    - `@radix-ui/react-tooltip`
    - 기타 다수

### 스타일링
- **Tailwind CSS v4.1.9**
  - 유틸리티 퍼스트 CSS 프레임워크
  - PostCSS 통합 (`@tailwindcss/postcss`)
  - `tailwindcss-animate` (애니메이션)
  - `tailwind-merge` (클래스 병합)
  - `tw-animate-css` (추가 애니메이션)

### 아이콘
- **lucide-react** (0.454.0)
  - 아이콘 라이브러리

### 폼 관리
- **react-hook-form** (7.60.0)
  - 폼 상태 관리 및 검증
- **@hookform/resolvers** (3.10.0)
  - 폼 검증 리졸버
- **zod** (3.25.76)
  - 스키마 기반 검증

### 날짜/시간
- **date-fns** (4.1.0)
  - 날짜 포맷팅 및 조작
- **react-day-picker** (9.8.0)
  - 날짜 선택 컴포넌트

### 차트/데이터 시각화
- **recharts** (2.15.4)
  - 차트 라이브러리

### 기타 UI 라이브러리
- **cmdk** (1.0.4) - 명령 팔레트
- **embla-carousel-react** (8.5.1) - 캐러셀
- **input-otp** (1.4.1) - OTP 입력
- **react-resizable-panels** (2.1.7) - 리사이즈 가능한 패널
- **sonner** (1.7.4) - 토스트 알림
- **vaul** (1.1.2) - 바텀 시트
- **next-themes** (0.4.6) - 다크모드 지원

---

## 🗄️ 백엔드 및 데이터베이스

### 데이터베이스
- **Supabase**
  - PostgreSQL 기반
  - Row Level Security (RLS) 적용
  - 실시간 기능 (Realtime)

### 인증
- **Supabase Auth**
  - 이메일/비밀번호 인증
  - 세션 관리

### 클라이언트 라이브러리
- **@supabase/supabase-js** (2.89.0)
  - Supabase JavaScript 클라이언트
- **@supabase/ssr** (0.8.0)
  - Next.js SSR 통합

---

## 🔧 개발 도구

### 빌드 도구
- **Next.js 내장 빌드 시스템**
- **PostCSS** (8.5)
  - Tailwind CSS 처리

### 타입 정의
- **@types/node** (22)
- **@types/react** (19)
- **@types/react-dom** (19)

### 유틸리티
- **class-variance-authority** (0.7.1)
  - 컴포넌트 variant 관리
- **clsx** (2.1.1)
  - 조건부 클래스명 관리

---

## 📊 분석 및 모니터링

- **@vercel/analytics** (1.3.1)
  - 웹사이트 분석

---

## 🚀 배포

- **Vercel**
  - Next.js 최적화 배포 플랫폼
  - 자동 빌드 및 배포

---

## 📁 프로젝트 구조

```
delivery-app/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 메인 페이지
│   ├── layout.tsx          # 루트 레이아웃
│   ├── globals.css         # 전역 스타일
│   ├── admin/              # 관리자 페이지
│   ├── auth/               # 인증 페이지
│   ├── customer/           # 고객 페이지
│   ├── driver/             # 배송원 페이지
│   └── terms/               # 약관 페이지
├── components/             # React 컴포넌트
│   ├── ui/                 # shadcn/ui 컴포넌트
│   └── layout/             # 레이아웃 컴포넌트
├── lib/                    # 유틸리티 및 헬퍼
│   ├── actions/             # Server Actions
│   ├── hooks/               # React Hooks
│   ├── supabase/           # Supabase 클라이언트
│   └── types/               # TypeScript 타입 정의
├── hooks/                  # 커스텀 훅
├── public/                 # 정적 파일
├── scripts/                # SQL 스크립트
└── styles/                 # 추가 스타일
```

---

## 🎯 주요 특징

1. **타입 안정성**: TypeScript로 전체 프로젝트 타입 정의
2. **서버 컴포넌트**: Next.js 16 App Router 활용
3. **실시간 기능**: Supabase Realtime으로 실시간 업데이트
4. **접근성**: Radix UI 기반으로 접근성 최적화
5. **반응형 디자인**: Tailwind CSS로 모바일 최적화
6. **보안**: Row Level Security (RLS)로 데이터 보호

---

## 📦 패키지 관리

- **npm** 또는 **pnpm** (pnpm-lock.yaml 존재)

---

## 🔐 환경 변수

- `NEXT_PUBLIC_QUICKSUPABASE_URL`
- `NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
