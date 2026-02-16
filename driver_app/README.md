# 기사 앱 (Driver App)

기사 웹페이지(`/driver`)를 그대로 앱 형태로 보여주는 WebView 앱입니다.  
**웹을 수정하면 앱에서도 동일하게 반영됩니다.** (단일 소스: Next.js 기사 웹)

## 요구 사항

- **Flutter**: `D:\tools\flutter`
- **Java (Android 빌드)**: `D:\Java\jdk-17.0.18+8`

## 기사 웹 URL 설정

앱이 로드할 기사 웹 주소를 설정해야 합니다.

1. **소스에서 기본값 변경**  
   `lib/app_config.dart`의 `defaultValue`를 실제 서비스 URL로 수정합니다.  
   예: `defaultValue: 'https://your-domain.com/driver'`

2. **빌드 시 URL 지정** (권장)  
   ```bash
   flutter run --dart-define=DRIVER_WEB_URL=https://your-domain.com/driver
   flutter build apk --dart-define=DRIVER_WEB_URL=https://your-domain.com/driver
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

# APK 빌드
flutter build apk --dart-define=DRIVER_WEB_URL=https://your-domain.com/driver
```

APK 출력: `build/app/outputs/flutter-apk/app-release.apk`

## 동작 방식

- 앱은 **WebView**로 `driverWebUrl`(기사 웹)만 전체 화면에 표시합니다.
- 로그인·대시보드·배송 상세·지갑·정산 등은 모두 **웹과 동일**하며, 웹을 수정하면 앱에서도 그대로 반영됩니다.
