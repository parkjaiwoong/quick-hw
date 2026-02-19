import 'dart:developer' as developer;
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';

import 'overlay_alert_service.dart';

/// 서버(push/send) FCM data 키: type, delivery_id, title, body, url (snake_case).
/// 앱 파싱: delivery_id/deliveryId, order_id/orderId/order_number, origin_address/origin, destination_address/destination, fee/price 모두 대응.
Map<String, String> buildOverlayPayloadFromFcmData(Map<String, dynamic> data) {
  String s(dynamic v) {
    final t = v?.toString() ?? '';
    return t.isEmpty ? '-' : t;
  }
  var deliveryId = (data['delivery_id'] ?? data['deliveryId'])?.toString() ?? '';
  final orderId = (data['order_id'] ?? data['orderId'] ?? data['order_number'])?.toString() ?? '';
  if (deliveryId.isEmpty && orderId.isNotEmpty) deliveryId = orderId;
  final origin = s(data['origin_address'] ?? data['origin']);
  final dest = s(data['destination_address'] ?? data['destination']);
  final fee = s(data['fee'] ?? data['price']);
  return {
    'delivery_id': deliveryId,
    'deliveryId': deliveryId,
    'order_id': orderId,
    'orderId': orderId,
    'order_number': orderId,
    'origin_address': origin,
    'origin': origin,
    'destination_address': dest,
    'destination': dest,
    'fee': fee,
    'price': fee,
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
    developer.log('전체 수신 데이터: ${message.data}', name: 'FCM_BG');
    developer.log('🚨 [FCM_BG] 신호 포착 data=$data', name: 'FCM_BG');
    for (final e in data.entries) {
      developer.log('  data["${e.key}"] = ${e.value}', name: 'FCM_BG');
    }

    if (!Platform.isAndroid) return;

    // message.data만 있어도 동작 (notification 없음). delivery_id, order_id, type 등 있으면 오버레이 표시
    try {
      final dataMap = Map<String, dynamic>.from(data);
      final deliveryIdRaw = (data['delivery_id'] ?? data['deliveryId'] ?? data['order_id'] ?? data['orderId'] ?? data['order_number'])?.toString() ?? '';
      final typeRaw = (data['type'] ?? '').toString();
      final isDelivery = typeRaw == 'new_delivery_request' || typeRaw == 'new_delivery' || deliveryIdRaw.isNotEmpty;
      if (!isDelivery || dataMap.isEmpty) {
        developer.log('오버레이 스킵: 배송 관련 키 없음 type=$typeRaw delivery_id/order_id=$deliveryIdRaw', name: 'FCM_BG');
        return;
      }
      final overlayPayload = buildOverlayPayloadFromFcmData(dataMap);
      for (final e in overlayPayload.entries) {
        developer.log('  파싱["${e.key}"] = ${e.value}', name: 'FCM_BG');
      }
      final deliveryId = overlayPayload['delivery_id'] ?? overlayPayload['deliveryId'] ?? overlayPayload['order_id'] ?? overlayPayload['orderId'] ?? '';
      if (deliveryId.isEmpty) {
        final id = 'fcm-${DateTime.now().millisecondsSinceEpoch}';
        overlayPayload['delivery_id'] = id;
        overlayPayload['deliveryId'] = id;
      }
      developer.log('shareData 후 showOverlay 호출: $overlayPayload', name: 'FCM_BG');
      await OverlayAlertService.triggerOverlayVibration();
      try {
        await FlutterOverlayWindow.shareData(overlayPayload);
      } catch (e, st) {
        developer.log('shareData 오류: $e\n$st', name: 'FCM_BG');
        return;
      }
      try {
        await FlutterOverlayWindow.showOverlay(
          overlayTitle: '신규 배차 요청',
          overlayContent: '출발: ${overlayPayload['origin_address'] ?? '-'}',
          alignment: OverlayAlignment.center,
          width: 400,
          height: 520,
        );
        developer.log('🚨 showOverlay 완료', name: 'FCM_BG');
      } catch (e, st) {
        developer.log('showOverlay 오류: $e\n$st', name: 'FCM_BG');
      }
    } catch (e, st) {
      developer.log('shareData/showOverlay 오류: $e\n$st', name: 'FCM_BG');
    }
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
