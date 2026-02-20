import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'app_config.dart';

/// FCM 수신 즉시 DB에 로그 저장 (수신 확인용). 실패해도 무시.
void logFcmReceiptToDb(Map<String, dynamic> data, String source) {
  if (!Platform.isAndroid) return;
  final driverId = (data['driver_id'] ?? data['driverId'])?.toString();
  if (driverId == null || driverId.isEmpty) return;
  final deliveryId = (data['delivery_id'] ?? data['deliveryId'])?.toString() ?? '';
  final uri = Uri.parse('${apiBaseUrl}/api/driver/fcm-receipt-log');
  HttpClient().postUrl(uri).then((req) {
    req.headers.set('Content-Type', 'application/json');
    req.write(jsonEncode({
      'driver_id': driverId,
      'delivery_id': deliveryId.isEmpty ? null : deliveryId,
      'source': source,
      'raw_data': data,
    }));
    return req.close();
  }).then((_) {
    developer.log('FCM 수신 DB 로그 저장 완료', name: 'FCM_RECEIPT');
  }).catchError((e) {
    developer.log('FCM 수신 DB 로그 실패: $e', name: 'FCM_RECEIPT');
  });
}

/// 서버(push/send) FCM data 키: type, delivery_id, title, body, url, price, pickup, destination.
/// 앱 파싱: price/fee, pickup/origin_address/origin, destination/destination_address 모두 대응.
Map<String, String> buildOverlayPayloadFromFcmData(Map<String, dynamic> data) {
  String s(dynamic v) {
    final t = v?.toString() ?? '';
    return t.isEmpty ? '-' : t;
  }
  var deliveryId = (data['delivery_id'] ?? data['deliveryId'])?.toString() ?? '';
  final orderId = (data['order_id'] ?? data['orderId'] ?? data['order_number'])?.toString() ?? '';
  if (deliveryId.isEmpty && orderId.isNotEmpty) deliveryId = orderId;
  final pickup = s(data['pickup'] ?? data['origin_address'] ?? data['origin']);
  final destination = s(data['destination'] ?? data['destination_address'] ?? data['dest']);
  final price = s(data['price'] ?? data['fee']);
  return {
    'delivery_id': deliveryId,
    'deliveryId': deliveryId,
    'order_id': orderId,
    'orderId': orderId,
    'order_number': orderId,
    'pickup': pickup,
    'origin_address': pickup,
    'origin': pickup,
    'destination': destination,
    'destination_address': destination,
    'price': price,
    'fee': price,
  };
}

/// Flutter 측 백그라운드 FCM 핸들러. (최상단 top-level 함수 — 별도 isolate에서 호출되므로 @pragma 필수)
/// 테스트: 조건 없이 FCM 데이터 수신 즉시 showOverlay 호출.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    developer.log('===== FCM 백그라운드 핸들러 진입 =====', name: 'FCM_BG');
    await Firebase.initializeApp();
    final data = message.data;
    logFcmReceiptToDb(Map<String, dynamic>.from(data), 'background');
    developer.log('전체 수신 데이터: ${message.data}', name: 'FCM_BG');
    developer.log('🚨 [FCM_BG] 신호 포착 data=$data', name: 'FCM_BG');
    for (final e in data.entries) {
      developer.log('  data["${e.key}"] = ${e.value}', name: 'FCM_BG');
    }

    if (!Platform.isAndroid) return;

    // 오버레이는 네이티브 DriverFcmService에서만 처리 (DispatchOverlayActivity).
    // Flutter 백그라운드 핸들러에서 showOverlay 호출 시 네이티브 오버레이와 중첩되므로 스킵.
    developer.log('오버레이: 네이티브 DriverFcmService에서 처리 (중복 방지)', name: 'FCM_BG');
  } catch (e, st) {
    developer.log('백그라운드 핸들러 전체 오류: $e\n$st', name: 'FCM_BG');
  }
}

/// FCM 초기화·토큰 관리. 초기화는 main에서 한 번만 호출하고, 토큰은 getToken()으로 조회.
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
        debugPrint('[FCM] ✅ FCM 토큰 발급 성공 (길이: ${_token!.length})');
        debugPrint('[FCM]   토큰 앞 50자: ${_token!.length > 50 ? _token!.substring(0, 50) : _token}...');
      } else {
        // iOS: 권한 거부 또는 APNs 미설정 시 null. Android: 설정/네트워크 이슈 시 null 가능.
        debugPrint('[FCM] getToken() returned null. Check: iOS=APNs key, Android=google-services.json & internet.');
      }
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _token = newToken;
        debugPrint('[FCM] 🔄 FCM 토큰 갱신됨');
      });
    } catch (e, st) {
      // getToken() 실패 시: Google Play Services(Android), google-services.json, Firebase 프로젝트 설정 등 확인
      debugPrint('[FCM] initialize or getToken error: $e');
      debugPrint('$st');
    }
  }

  static Future<String?> getToken() async {
    if (_token != null) return _token;
    await initialize();
    return _token;
  }
}
