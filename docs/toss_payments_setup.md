# 토스페이먼츠 결제 키 설정

"결제 키가 설정되지 않아 카드 등록을 사용할 수 없습니다" 메시지가 나오면, **토스페이먼츠 클라이언트 키**가 배포 환경에 설정되지 않은 상태입니다.

## 1. 키 발급

1. [토스페이먼츠 개발자 콘솔](https://developers.tosspayments.com/my/api-keys) 접속 후 로그인
2. **클라이언트 키**(테스트용은 `test_ck_...`) 복사
3. **시크릿 키**(테스트용은 `test_sk_...`) 복사 — 서버에서 결제 확인·빌링 시 필요

## 2. 로컬 개발 (.env.local)

프로젝트 루트에 `.env.local` 파일을 만들고 다음을 추가합니다.

```env
# 토스페이먼츠 (카드 결제 + 카드 등록)
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxxxxxxxxxxx
TOSS_SECRET_KEY=test_sk_xxxxxxxxxxxx
```

- `NEXT_PUBLIC_` 이 붙은 키만 브라우저에 노출됩니다. 클라이언트 키만 해당합니다.
- 시크릿 키는 반드시 서버 전용으로 두고, Git이나 클라이언트 코드에 넣지 마세요.

## 3. Vercel 배포

1. Vercel 대시보드 → 해당 프로젝트 → **Settings** → **Environment Variables**
2. 다음 변수 추가:
   - **Key:** `NEXT_PUBLIC_TOSS_CLIENT_KEY`  
     **Value:** 토스 개발자 콘솔에서 복사한 클라이언트 키  
     **Environment:** Production(필요 시 Preview, Development도 동일 값으로 추가)
   - **Key:** `TOSS_SECRET_KEY`  
     **Value:** 토스 시크릿 키  
     **Environment:** Production(및 필요한 환경)

3. 저장 후 **Redeploy** 한 번 실행해 주세요. 환경 변수 변경 후 재배포해야 적용됩니다.

## 4. 참고

- 테스트 키로는 실제 결제가 발생하지 않습니다.
- 본인 도메인(예: Vercel URL)을 토스 개발자 콘솔의 **사이트 도메인**에 등록해야 결제창이 정상 동작할 수 있습니다.
- `.env.example`에도 동일 키 이름이 안내되어 있습니다.
