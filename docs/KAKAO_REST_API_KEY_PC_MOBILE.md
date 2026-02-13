# PC에서 "카카오 REST API 키가 필요합니다" 나올 때

## 원인 (PC vs 모바일 차이)

- **모바일에서 정상 동작**: 모바일에서 **같은 Wi‑Fi의 로컬 주소**(예: `http://192.168.x.x:3000`) 또는 터널로 연 **localhost**로 접속하면, 요청이 **PC에서 돌아가는 Next.js 개발 서버**로 갑니다. 이 서버는 **PC의 `.env.local`**을 읽기 때문에 `KAKAO_REST_API_KEY`가 있으면 정상 동작합니다.
- **PC에서 오류**: PC 브라우저에서 **Vercel 배포 URL**(예: `https://xxx.vercel.app`)로 접속하면, "현재 위치로 설정" 시 요청이 **Vercel 서버**로 갑니다. Vercel 프로젝트에 `KAKAO_REST_API_KEY`를 넣지 않았으면 서버에서 키가 비어 있어 위 메시지가 뜹니다.

즉, **기기(PC/모바일) 차이가 아니라 "어느 서버가 요청을 처리하느냐"** 차이입니다.

- 로컬 개발 서버(PC의 `.env.local` 사용) → 키 있으면 동작  
- Vercel 서버(배포 환경 변수 사용) → 여기에 키가 없으면 동작 안 함  

## 해결 방법

### 1) Vercel 배포 사이트에서도 쓰고 싶을 때 (권장)

1. [Vercel 대시보드](https://vercel.com) → 해당 프로젝트 선택  
2. **Settings** → **Environment Variables**  
3. **Add**  
   - Name: `KAKAO_REST_API_KEY`  
   - Value: 카카오 개발자 콘솔에서 복사한 **REST API 키** (JavaScript 키 아님)  
   - Environment: Production(필요하면 Preview, Development도 동일하게 추가)  
4. 저장 후 **재배포**(Deployments → ... → Redeploy) 하거나, 다음 배포부터 적용됩니다.

이렇게 하면 PC에서든 모바일에서든 **배포 URL**로 접속해도 "현재 위치로 설정"이 동작합니다.

### 2) PC에서만 로컬로 테스트할 때

- PC에서 `http://localhost:3000`으로 접속하고, **프로젝트 루트의 `.env.local`**에 이미 `KAKAO_REST_API_KEY=...`가 있다면 그대로 사용됩니다.
- 키를 수정했다면 **개발 서버 재시작** (`npm run dev` 다시 실행).

### 3) 카카오 REST API 키 확인

- [카카오 개발자 콘솔](https://developers.kakao.com) → 내 애플리케이션 → **앱 키**  
- **REST API 키** 복사 (네이티브/JavaScript 키가 아님)  
- 로컬: `.env.local`에 `KAKAO_REST_API_KEY=복사한키`  
- 배포: Vercel Environment Variables에 동일한 이름·값으로 추가  

요약: **PC에서 배포 URL로 접속해 오류가 나면, Vercel에 `KAKAO_REST_API_KEY`를 추가하고 재배포**하면 됩니다.
