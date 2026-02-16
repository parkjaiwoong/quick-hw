import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

/// FCM 토큰을 가져와 WebView에 전달. 백그라운드 메시지 시 시스템 알림 표시.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  if (message.notification != null) {
    // Android: foreground가 아니면 시스템 알림이 자동 표시됨
  }
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
      if (_token == null) {
        // iOS: 권한 거부 또는 APNs 미설정 시 null. Android: 설정/네트워크 이슈 시 null 가능.
        print('[FCM] getToken() returned null. Check: iOS=APNs key, Android=google-services.json & internet.');
      }
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _token = newToken;
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
