/// 기사 웹 URL. 웹을 변경하면 앱에서도 동일하게 반영됩니다.
/// - 개발: 로컬 또는 터널 URL (예: http://10.0.2.2:3000/driver — Android 에뮬레이터)
/// - 운영: 실제 서비스 URL (예: https://your-app.vercel.app/driver)
const String driverWebBaseUrl = String.fromEnvironment(
  'DRIVER_WEB_URL',
  defaultValue: 'https://your-app.vercel.app/driver',
);

String get driverWebUrl => driverWebBaseUrl.endsWith('/driver')
    ? driverWebBaseUrl
    : '$driverWebBaseUrl/driver';
