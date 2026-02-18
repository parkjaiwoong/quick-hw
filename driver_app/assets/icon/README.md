# 앱 아이콘

이 폴더에 **app_icon.png** 를 넣은 뒤 아래 명령으로 앱 아이콘을 갱신하세요.

- **권장 크기**: 1024×1024 픽셀 (PNG, 투명 배경 가능)
- **파일 이름**: `app_icon.png`

아이콘 생성:

```bash
cd driver_app
flutter pub get
dart run flutter_launcher_icons
```

실행 후 `android/app/src/main/res/` 아래 mipmap 폴더들이 자동 생성·덮어쓰기 됩니다.
