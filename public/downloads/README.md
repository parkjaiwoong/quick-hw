# 기사 앱 APK 배포 (Vercel 등)

- **APK 빌드 위치**: 프로젝트 루트의 `driver_app`에서 빌드 시  
  → `driver_app/build/app/outputs/flutter-apk/app-release.apk` 에 생성됩니다.

- **Vercel에서 다운로드 가능하게 하려면**  
  빌드한 APK를 이 폴더에 `driver-app.apk` 이름으로 복사해 두고 커밋/배포하면 됩니다.

  ```powershell
  # driver_app에서 APK 빌드 후 (프로젝트 루트에서)
  copy driver_app\build\app\outputs\flutter-apk\app-release.apk public\downloads\driver-app.apk
  ```

- 배포 후 다운로드 URL:  
  `https://(당신의 Vercel 도메인)/downloads/driver-app.apk`  
  예: `https://delivery-app.vercel.app/downloads/driver-app.apk`

- 환경 변수는 **필요 없습니다.** 같은 사이트의 `/downloads/driver-app.apk` 로 자동 링크됩니다. APK를 다른 URL(CDN 등)에서 받게 하려면 `NEXT_PUBLIC_DRIVER_APP_APK_URL` 만 설정하면 됩니다.
