# Leaked Password Protection (Supabase Auth)

Supabase 경고: **Leaked Password Protection Disabled** 해결 방법.

## 설명

- Supabase Auth가 **HaveIBeenPwned.org** API로 유출된 비밀번호를 검사해, 유출된 비밀번호 사용을 막는 기능입니다.
- 이 기능은 **코드/환경 변수가 아니라 Supabase 대시보드**에서만 켤 수 있습니다.

## 활성화 방법

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속 후 해당 프로젝트 선택
2. 왼쪽 메뉴 **Authentication** → **Providers** (또는 **Auth** → **Providers**)
3. **Email** 프로바이더 선택
4. **Password** 섹션에서 **"Prevent the use of leaked passwords"** (유출된 비밀번호 사용 방지) 옵션 **켜기**
5. (선택) 비밀번호 강도 설정
   - Required characters: 숫자, 대소문자, 기호 등
   - Minimum length: 8자 이상 권장
6. **Save** 저장

직접 링크 (프로젝트 ID는 대시보드 URL 기준으로 자동 적용):

- `https://supabase.com/dashboard/project/<PROJECT_REF>/auth/providers`  
  → **Email** 클릭 후 위 옵션 활성화

## 요구 사항

- **Pro Plan 이상**에서만 사용 가능합니다.  
  Free 플랜이면 대시보드에 해당 옵션이 없을 수 있습니다.

## 참고

- [Password security | Supabase Docs](https://supabase.com/docs/guides/auth/password-security)
- 기존 사용자는 기존 비밀번호로 로그인 가능.  
  비밀번호를 **변경**하거나 **신규 가입** 시 유출 비밀번호면 거부됩니다.
