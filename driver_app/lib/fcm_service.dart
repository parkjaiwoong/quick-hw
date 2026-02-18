import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';
import 'package:vibration/vibration.dart';

import 'availability_storage.dart';

/// overlayMain(entry point)으로 전달할 주문(배차) 데이터 맵 구성.
/// FCM data의 주문 번호, 주소 등과 동일한 키로 맞춰 overlay 위젯에서 그대로 사용.
Map<String, String> buildOverlayPayloadFromFcmData(Map<String, dynamic> data) {
  String s(dynamic v) {
    final t = v?.toString() ?? '';
    return t.isEmpty ? '-' : t;
  }
  final deliveryId = (data['delivery_id'] ?? data['deliveryId'])?.toString() ?? '';
  final orderId = (data['order_id'] ?? data['orderId'] ?? data['order_number'])?.toString() ?? '';
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

/// Flutter 측 백그라운드 FCM 핸들러.
/// 별도 isolate에서 실행되므로 반드시 @pragma('vm:entry-point') 필요.
/// FCM data에 배차 정보가 포함되어 있으면 FlutterOverlayWindow.showOverlay() 호출,
/// 주문 번호·주소 등은 shareData로 entry point(overlayMain)에 전달.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // 로그: adb logcat에서 확인 가능 (flutter 태그 또는 패키지명). 앱 종료 시에는 네이티브 DriverFcmService 로그 우선 확인.
  debugPrint('[FCM] 백그라운드 메시지 수신');
  debugPrint('[FCM]   data: ${message.data}');
  print('[FCM] background handler: data=${message.data}');
  final data = message.data;
  final type = data['type'];
  final hasDispatchInfo = (type == 'new_delivery_request' || type == 'new_delivery') &&
      ((data['delivery_id'] ?? data['deliveryId'] ?? '').toString().isNotEmpty);
  if (!hasDispatchInfo || !Platform.isAndroid) {
    debugPrint('[FCM] skip: hasDispatchInfo=$hasDispatchInfo Android=$Platform.isAndroid');
    return;
  }

  // 배송 가능 상태일 때만 오버레이 표시 (웹뷰에서 토글 시 네이티브에 저장된 값 사용)
  final isAvailable = await DriverAvailabilityStorage.load();
  if (!isAvailable) {
    debugPrint('[FCM] 배송 불가 상태 — 오버레이 미표시');
    print('[FCM] overlay skipped: driver not available');
    return;
  }

  debugPrint('[FCM] 배송 가능 상태 — 오버레이 표시 시도');
  try {
    final hasVibrator = await Vibration.hasVibrator();
    if (hasVibrator == true) {
      Vibration.vibrate(duration: 200);
      await Future.delayed(const Duration(milliseconds: 250));
      Vibration.vibrate(duration: 200);
    }
  } catch (_) {}
  try {
    final dataMap = Map<String, dynamic>.from(data);
    final overlayPayload = buildOverlayPayloadFromFcmData(dataMap);
    if ((overlayPayload['delivery_id'] ?? '').isEmpty) return;
    // entry point(overlayMain)가 overlayListener로 수신: 주문 번호, 출발지·도착지, 요금 등
    await FlutterOverlayWindow.shareData(overlayPayload);
    await FlutterOverlayWindow.showOverlay(
      overlayTitle: '신규 배차 요청',
      overlayContent: '출발: ${overlayPayload['origin_address']}',
      alignment: OverlayAlignment.center,
      width: 400,
      height: 520,
    );
    debugPrint('[FCM] showOverlay 완료');
    print('[FCM] overlay shown');
  } catch (e) {
    debugPrint('[FCM] shareData/showOverlay 오류: $e');
    print('[FCM] overlay error: $e');
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
