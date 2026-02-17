import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:vibration/vibration.dart';

/// FCM 토큰을 가져와 WebView에 전달. 백그라운드 메시지 시 시스템 알림 표시 + 진동.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // 백그라운드 수신 로그 (별도 isolate → Android는 logcat에서 [FCM] 검색)
  print('[FCM] 🔔 백그라운드 메시지 수신 (배송가능 시 UI/소리/진동 확인)');
  print('[FCM]   title: ${message.notification?.title}');
  print('[FCM]   body: ${message.notification?.body}');
  print('[FCM]   data: ${message.data}');
  final data = message.data;
  print('[FCM]   delivery_id: ${data != null ? data['delivery_id'] : null}');
  try {
    final hasVibrator = await Vibration.hasVibrator();
    if (hasVibrator == true) {
      Vibration.vibrate(duration: 200);
      await Future.delayed(const Duration(milliseconds: 250));
      Vibration.vibrate(duration: 200);
      print('[FCM] 🔔 백그라운드 진동 실행');
    }
  } catch (_) {}
  // Android: notification payload 있으면 시스템 알림(소리/진동) 자동 표시됨
}

class FcmService {
  static String? _token;
  static String? get token => _token;

  static Future<void> initialize() async {
    if (!Platform.isAndroid && !Platform.isIOS) return;
    try {
      await Firebase.initializeApp();
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      // onBackgroundMessage는 main() 최상위에서만 등록 (main.dart에서 호출)
      _token = await FirebaseMessaging.instance.getToken();
      if (_token != null) {
        print('[FCM] ✅ FCM 토큰 발급 성공 (길이: ${_token!.length})');
        print('[FCM]   토큰 앞 50자: ${_token!.length > 50 ? _token!.substring(0, 50) : _token}...');
      } else {
        // iOS: 권한 거부 또는 APNs 미설정 시 null. Android: 설정/네트워크 이슈 시 null 가능.
        print('[FCM] getToken() returned null. Check: iOS=APNs key, Android=google-services.json & internet.');
      }
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _token = newToken;
        print('[FCM] 🔄 FCM 토큰 갱신됨');
      });
    } catch (e, st) {
      // getToken() 실패 시: Google Play Services(Android), google-services.json, Firebase 프로젝트 설정 등 확인
      print('[FCM] initialize or getToken error: $e');
      print(st);
    }
  }

  static Future<String?> getToken() async {
    if (_token != null) return _token;
    await initialize();
    return _token;
  }
}
