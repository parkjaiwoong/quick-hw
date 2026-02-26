# 로컬 테스트 가이드

## 0. 한 번에 실행 (권장)

```powershell
.\test-local.ps1
```

또는

```bash
npm run test:local:run
```

→ `.env.local` 확인, `npm install`, 웹 서버 시작, 브라우저 자동 열기

### 로컬 테스트 URL

| 화면 | URL |
|------|-----|
| 웹 앱 | http://localhost:3000 |
| 기사 대시보드 | http://localhost:3000/driver |
| 수락 가능한 배송 | http://localhost:3000/driver/available |

### 기사 화면 접근

- **로그인 후 role=driver인 계정** 또는
- **role_override=driver** 쿠키 설정 후 접근 가능

---

## 1. 웹 앱 (Next.js)

### 실행

```powershell
# .env.local이 없으면 .env.example 복사 후 서버 시작
.\start-dev.ps1
```

또는

```bash
# .env.local 직접 생성 후
npm install
npm run dev
```

### 접속

- 브라우저: http://localhost:3000

### .env.local 생성

`.env.example`을 복사하거나 `.\start-dev.ps1` 실행 시 자동 생성됨.

```powershell
Copy-Item .env.example .env.local
```

---

## 2. 기사 앱 (Flutter) — 로컬 웹 연결

기사 앱 WebView가 **로컬 개발 서버**를 보게 하려면 `DRIVER_WEB_URL`을 지정합니다.

### 에뮬레이터

```bash
cd driver_app
flutter pub get
flutter run --dart-define=DRIVER_WEB_URL=http://10.0.2.2:3000/driver
```

`10.0.2.2` = Android 에뮬레이터에서 호스트 PC localhost

### 실기기 (같은 Wi‑Fi)

1. PC IP 확인: `ipconfig` → IPv4 주소 (예: 192.168.0.10)
2. 기기 연결 후:

```bash
cd driver_app
flutter run --dart-define=DRIVER_WEB_URL=http://192.168.0.10:3000/driver
```

(IP를 실제 PC IP로 변경)

### 디버그 빌드

```bash
cd driver_app
flutter run --dart-define=DRIVER_WEB_URL=http://10.0.2.2:3000/driver
```

### 릴리스 APK (로컬 URL 테스트용)

```bash
cd driver_app
flutter build apk --debug --dart-define=DRIVER_WEB_URL=http://192.168.0.10:3000/driver
```

설치 후 같은 Wi‑Fi에서 PC가 `192.168.0.10`이고 `npm run dev`가 떠 있으면 로컬 웹에 연결됨.

---

## 3. 전체 로컬 테스트 흐름

1. **웹 서버 실행**  
   ```bash
   npm run dev
   ```

2. **기사 앱 실행**  
   ```bash
   cd driver_app
   flutter run --dart-define=DRIVER_WEB_URL=http://10.0.2.2:3000/driver
   ```
   (실기기면 `10.0.2.2` 대신 PC IP 사용)

3. **테스트**
   - 브라우저: http://localhost:3000 → 고객/관리자 화면
   - 기사 앱: WebView가 http://localhost:3000/driver 로드

---

## 4. 오버레이·FCM 테스트

- FCM/푸시는 Vercel 배포 URL 또는 `ngrok` 등 터널이 필요합니다.
- 로컬 `http://localhost:3000`은 기기에서 접근 불가하므로 FCM 전송 시 `baseUrl`은 터널 URL로 설정해야 합니다.

---

## 5. 요약

| 대상        | 명령어 |
|------------|--------|
| 웹 앱      | `.\start-dev.ps1` 또는 `npm run dev` 또는 `npm run test:local` |
| 기사 앱 (에뮬레이터) | `npm run driver-app:run-emu` |
| 기사 앱 (Chrome/Windows) | `npm run driver-app:run-dev` (localhost) |

### npm 스크립트

| 스크립트 | 설명 |
|----------|------|
| `npm run test:local:run` | **한 번에** 웹 서버 + 브라우저 자동 열기 |
| `npm run test:local` | 웹 개발 서버만 실행 |
| `npm run driver-app:run-dev` | 기사 앱 (Chrome/디스크톱, localhost 연결) |
| `npm run driver-app:run-emu` | 기사 앱 (에뮬레이터, 10.0.2.2:3000 연결) |
| `npm run driver-app:run-device` | 기사 앱 (실기기, 192.168.0.10 연결). PC IP가 다르면 `ipconfig`로 확인 후 `package.json`의 `driver-app:run-device` IP 수정 |
