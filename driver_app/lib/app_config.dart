/// 기사 웹 URL. 웹을 변경하면 앱에서도 동일하게 반영됩니다.
/// - 개발: 로컬 또는 터널 URL (예: http://10.0.2.2:3000/driver — Android 에뮬레이터)
/// - 운영: 실제 서비스 URL (quick-hw.vercel.app). Wi‑Fi 디버깅 시 --dart-define=DRIVER_WEB_URL=http://PC_IP:3000/driver 로 로컬 지정 가능.
const String driverWebBaseUrl = String.fromEnvironment(
  'DRIVER_WEB_URL',
  defaultValue: 'https://quick-hw.vercel.app/driver',
);

String get driverWebUrl => driverWebBaseUrl.endsWith('/driver')
    ? driverWebBaseUrl
    : '$driverWebBaseUrl/driver';

/// API 베이스 URL (FCM 수신 로그 등)
String get apiBaseUrl {
  final u = driverWebBaseUrl;
  if (u.contains('/driver')) return u.replaceAll(RegExp(r'/driver.*'), '');
  return u;
}
