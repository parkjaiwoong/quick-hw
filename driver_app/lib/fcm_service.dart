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
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      _token = await FirebaseMessaging.instance.getToken();
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _token = newToken;
      });
    } catch (_) {}
  }

  static Future<String?> getToken() async {
    if (_token != null) return _token;
    await initialize();
    return _token;
  }
}
