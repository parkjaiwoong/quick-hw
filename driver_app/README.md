# 기사 앱 (Driver App)

기사 웹페이지(`/driver`)를 그대로 앱 형태로 보여주는 WebView 앱입니다.  
**웹을 수정하면 앱에서도 동일하게 반영됩니다.** (단일 소스: Next.js 기사 웹)

**Flutter/앱 코드 수정 후 모바일에 반영하려면**: `driver_app`에서 `flutter pub get` 실행 후 앱을 다시 빌드·설치하세요. (`flutter run` 또는 `flutter build apk` 후 APK 재설치)

## 요구 사항

- **Flutter**: `D:\tools\flutter`
- **Java (Android 빌드)**: `D:\Java\jdk-17.0.18+8`

## 기사 웹 URL 설정

앱이 로드할 기사 웹 주소를 설정해야 합니다.

1. **소스에서 기본값 변경**  
   `lib/app_config.dart`의 `defaultValue`를 실제 서비스 URL로 수정합니다.  
   예: `defaultValue: 'https://quick-hw.vercel.app/driver'`

2. **빌드 시 URL 지정** (권장)  
   ```bash
   flutter run --dart-define=DRIVER_WEB_URL=https://quick-hw.vercel.app/driver
   flutter build apk --dart-define=DRIVER_WEB_URL=https://quick-hw.vercel.app/driver
   ```

3. **개발 시 로컬 웹**  
   - 실제 기기: PC와 같은 Wi‑Fi, Next.js를 `npm run dev`로 실행 후 PC IP로 접근  
     예: `--dart-define=DRIVER_WEB_URL=http://192.168.0.10:3000/driver`  
   - Android 에뮬레이터: `http://10.0.2.2:3000/driver` (호스트 PC의 localhost)

## 빌드 및 실행 (Windows)

PowerShell에서 Flutter/Java 경로를 지정한 뒤 실행:

```powershell
$env:JAVA_HOME = "D:\Java\jdk-17.0.18+8"
$env:PATH = "D:\tools\flutter\bin;$env:PATH"

cd driver_app

# 실행 (URL은 필요 시 --dart-define 추가)
flutter run

# APK 빌드 (기본: 모든 CPU 포함, 약 50~70MB)
flutter build apk --dart-define=DRIVER_WEB_URL=https://quick-hw.vercel.app/driver

# APK 용량 줄이기 (권장): CPU별로 나누면 개별 APK는 약 30~35MB
flutter build apk --dart-define=DRIVER_WEB_URL=https://quick-hw.vercel.app/driver --split-per-abi
```

APK 출력:
- 기본: `build/app/outputs/flutter-apk/app-release.apk` (약 50~70MB)
- `--split-per-abi` 사용 시: `app-release-arm64-v8a.apk`(대부분 폰), `app-release-armeabi-v7a.apk`(구형) 등. 배포 시 **arm64-v8a** 하나만 써도 대부분 기기에서 동작하며 다운로드가 더 빠릅니다.

```powershell
# 용량 줄인 APK 하나만 배포할 때 (arm64-v8a 권장)
copy driver_app\build\app\outputs\flutter-apk\app-release-arm64-v8a.apk public\downloads\driver-app.apk
```

Vercel 등 웹에서 APK 다운로드 링크를 쓰려면, 빌드한 APK를 Next.js `public/downloads/driver-app.apk`로 복사한 뒤 배포하면 된다. 자세한 내용은 `public/downloads/README.md` 참고.

## FCM (앱 백그라운드/종료 시 배송 요청 푸시)

앱을 닫거나 다른 앱을 쓰는 중에도 배송 요청 알림을 받으려면 Firebase를 설정하세요.

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성 후 **Android** 앱 추가 (패키지명 `com.quickhw.driver_app`).
2. **google-services.json** 다운로드 후 `driver_app/android/app/google-services.json`에 넣기.
3. 서버 쪽 FCM 전송 설정은 프로젝트 루트의 `docs/push_notifications_setup.md` 참고.

앱 실행 후 기사로 로그인하면 FCM 토큰이 자동으로 서버에 등록됩니다.

## 앱 자동 업데이트 안내 (버전 체크)

앱을 실행할 때마다 서버(`/api/driver/app-version`)에서 최신 버전을 확인합니다.  
서버에 새 버전이 등록되어 있으면 **「새 버전이 있습니다」** 다이얼로그가 뜨고, **업데이트** 버튼으로 APK 다운로드 URL(또는 스토어 링크)을 엽니다.

**서버 쪽 설정 (Next.js 환경 변수)**  
기사 웹과 같은 도메인에 다음을 설정하면 버전 체크가 동작합니다.

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_DRIVER_APP_LATEST_VERSION` | 최신 앱 버전 (예: `1.0.1`). 이 버전보다 낮으면 업데이트 안내 |
| `NEXT_PUBLIC_DRIVER_APP_MIN_VERSION` | (선택) 필수 최소 버전. 이보다 낮으면 **업데이트 필요**로만 안내 |
| `NEXT_PUBLIC_DRIVER_APP_DOWNLOAD_URL` | 새 APK 다운로드 URL 또는 스토어 링크 (예: `https://quick-hw.vercel.app/downloads/driver-app.apk`) |

새 APK를 빌드한 뒤 `pubspec.yaml`의 `version`을 올리고, 서버 env에 `NEXT_PUBLIC_DRIVER_APP_LATEST_VERSION`과 `NEXT_PUBLIC_DRIVER_APP_DOWNLOAD_URL`을 설정한 후 배포하면, 사용자가 앱을 열 때 업데이트 안내가 표시됩니다.

## 동작 방식

- 앱은 **WebView**로 `driverWebUrl`(기사 웹)만 전체 화면에 표시합니다.
- 로그인·대시보드·배송 상세·지갑·정산 등은 모두 **웹과 동일**하며, 웹을 수정하면 앱에서도 그대로 반영됩니다.
