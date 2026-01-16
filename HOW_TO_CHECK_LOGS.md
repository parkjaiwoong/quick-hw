# 서버 로그 확인 방법

## 서버 로그란?

Next.js 개발 서버(`npm run dev`)를 실행한 터미널 창에 출력되는 메시지입니다.

## 확인 방법

### 방법 1: 터미널 창 확인
1. `npm run dev`를 실행한 터미널 창을 찾으세요
2. 회원가입을 시도하면 그 터미널에 로그가 출력됩니다
3. 다음과 같은 메시지들이 보일 것입니다:
   - `SignUp successful!`
   - `User ID: ...`
   - `Error message: ...`
   - `Profile creation attempt ...`

### 방법 2: 새로운 터미널에서 확인
터미널 창을 찾을 수 없다면:
1. 새로운 터미널을 열고 프로젝트 폴더로 이동
2. `npm run dev`를 실행 (이미 실행 중이면 에러가 날 수 있음)
3. 회원가입 시도
4. 로그 확인

### 방법 3: VS Code 터미널 확인
VS Code를 사용 중이라면:
1. 하단의 "터미널" 탭 클릭
2. `npm run dev`가 실행 중인 터미널 확인
3. 회원가입 시도 시 로그 확인

## 로그에서 확인할 내용

회원가입 시도 시 다음과 같은 로그가 출력됩니다:

```
Creating profile for user: [사용자ID]
User exists in auth.users, proceeding with profile creation...
Attempting profile creation (attempt 1/5)...
Profile data: { id: ..., email: ..., ... }
❌ Profile creation attempt 1/5 failed:
Error message: [에러 메시지]
Error code: [에러 코드]
User ID: [사용자 ID]
```

이 정보를 복사해서 알려주시면 문제를 해결할 수 있습니다.

