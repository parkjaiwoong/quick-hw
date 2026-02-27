import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io';

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';
import 'package:vibration/vibration.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';
import 'app_version_service.dart';
import 'availability_storage.dart';
import 'fcm_service.dart';
import 'overlay_alert_service.dart';

/// 배차 수락 팝업에서 "수락" 후 MainActivity가 전달하는 delivery_id (MethodChannel)
const _launchChannel = MethodChannel('com.quickhw.driver_app/launch');

/// 오버레이 전용 채널 (overlayMain 엔트리 포인트에서 payload 수신 / 수락·거절 전달)
const _overlayChannel = MethodChannel('com.quickhw.driver_app/overlay');

void main() async {
  // 1. 바인딩 초기화 (필수)
  WidgetsFlutterBinding.ensureInitialized();

  // 2. Firebase 초기화
  await Firebase.initializeApp();

  // 3. 백그라운드 핸들러 등록 (반드시 runApp 호출 전!)
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  // 4. 알림 권한 및 포그라운드 설정 호출
  await FcmService.initialize();

  // 5. 포그라운드 FCM 수신·토큰 로그·앱 실행
  FirebaseAnalytics.instance;
  await logFcmToken();
  FirebaseMessaging.onMessage.listen(_onForegroundMessage);
  runApp(const DriverApp());
}

/// 오버레이 전용 엔트리 포인트. 별도 isolate/엔진에서 실행되므로 반드시 @pragma 필요.
/// 시스템이 앱이 꺼져 있어도 이 함수를 찾아 실행할 수 있게 함.
/// Android에서 배차 FCM 수신 시 Flutter 오버레이가 이 함수를 진입점으로 실행함.
@pragma('vm:entry-point')
void overlayMain() {
  WidgetsFlutterBinding.ensureInitialized();
  _runOverlayApp();
}

/// runApp은 즉시 실행하고, payload는 위젯 내부에서 비동기 수신. getPayload는 호출하지 않으므로 여기서 앱이 멈추지 않음.
void _runOverlayApp() {
  developer.log('[Overlay] runApp 실행 직전', name: 'FCM_OVERLAY');
  runApp(const OverlayApp());
}

/// 오버레이용 payload 비동기 조회 (MethodChannel getPayload → 없으면 overlayListener 대기).
/// 예외 또는 payload 없어도 빈 맵을 반환해 기본 UI가 뜨도록 함.
Future<Map<String, String>> _getOverlayPayload() async {
  try {
    Map<String, String> payload = {};
    try {
      final result = await _overlayChannel.invokeMethod<Map<Object?, Object?>>('getPayload');
      if (result != null && result.isNotEmpty) {
        payload = result.map((k, v) => MapEntry(k?.toString() ?? '', v?.toString() ?? ''));
        developer.log('[Overlay] getPayload: $payload', name: 'FCM_OVERLAY');
      }
    } catch (_) {}
    if (payload.isEmpty) {
      try {
        final fromListener = await FlutterOverlayWindow.overlayListener
            .map((event) => _payloadFromOverlayEvent(event))
            .where((p) => p.isNotEmpty)
            .first
            .timeout(const Duration(seconds: 3));
        if (fromListener.isNotEmpty) {
          payload = fromListener;
          developer.log('[Overlay] overlayListener/shareData: $payload', name: 'FCM_OVERLAY');
        }
      } on TimeoutException catch (_) {
      } catch (_) {}
    }
    return payload;
  } catch (e, st) {
    debugPrint('[Overlay] _getOverlayPayload 예외: $e');
    debugPrint('[Overlay] $st');
    return {};
  }
}

/// overlayListener 이벤트를 overlayMain에서 쓸 payload 맵으로 변환 (shareData로 전달된 주문 데이터).
Map<String, String> _payloadFromOverlayEvent(dynamic event) {
  if (event is! Map) return {};
  final map = event.map((k, v) => MapEntry(k?.toString() ?? '', v?.toString() ?? ''));
  return Map<String, String>.from(map);
}


/// '다른 앱 위에 표시' 권한: 앱 실행 시 확인 후 없으면 다이얼로그 → 확인 시 설정 화면으로 이동.
Future<void> requestOverlayPermissionWithDialog(BuildContext context) async {
  if (!Platform.isAndroid) return;
  try {
    print('[오버레이] 권한 체크 시작');
    final granted = await FlutterOverlayWindow.isPermissionGranted();
    print('[오버레이] 현재 권한 상태: $granted');
    if (granted) return;
    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('권한 필요'),
        content: const Text('배차 팝업을 위해 설정이 필요합니다.'),
        actions: [
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await FlutterOverlayWindow.requestPermission();
            },
            child: const Text('확인'),
          ),
        ],
      ),
    );
  } catch (e, st) {
    print('[오버레이] 권한 체크/다이얼로그 오류: $e');
    debugPrint('[오버레이] $st');
  }
}

/// 포그라운드 FCM 수신 시 WebView의 배송대기중 영역에 주입 (오버레이 X)
typedef FcmForegroundInjectFn = Future<void> Function(Map<String, dynamic> data);
FcmForegroundInjectFn? _fcmForegroundInject;

void setFcmForegroundInjector(FcmForegroundInjectFn? fn) {
  _fcmForegroundInject = fn;
}

/// 현재 WebView 화면: main(메인) / available(배송대기중). 배송대기중에서만 FCM 처리.
String _currentDriverScreen = 'main';
void setCurrentDriverScreen(String screen) {
  _currentDriverScreen = screen;
  if (kDebugMode) debugPrint('[기사앱] 현재 화면: $_currentDriverScreen');
}

/// 포그라운드 FCM: 배송대기중 화면에서만 오버레이 표시 + WebView 배송대기중 영역 주입
Future<void> _onForegroundMessage(RemoteMessage message) async {
  try {
    developer.log('===== FCM 포그라운드 수신 =====', name: 'FCM_FG');
    logFcmReceiptToDb(Map<String, dynamic>.from(message.data), 'foreground');
    developer.log('전체 수신 데이터: ${message.data}', name: 'FCM_FG');
    if (kDebugMode) {
      developer.log('notification: ${message.notification?.title}', name: 'FCM_FG');
    }
    final data = message.data;
    if (data.isEmpty || !Platform.isAndroid) return;
    final typeRaw = (data['type'] ?? '').toString();
    final deliveryIdRaw = (data['delivery_id'] ?? data['deliveryId'] ?? data['order_id'] ?? data['orderId'] ?? data['order_number'])?.toString() ?? '';
    final isNewDelivery = typeRaw == 'new_delivery_request' || typeRaw == 'new_delivery' || deliveryIdRaw.isNotEmpty;
    if (!isNewDelivery) return;

    // 메인 화면에서는 FCM 무시 (배송대기중에서만 처리)
    if (_currentDriverScreen != 'available') {
      if (kDebugMode) debugPrint('[FCM 포그라운드] 메인 화면 — 스킵 (배송대기중에서만 수신)');
      return;
    }
    final isAvailable = await DriverAvailabilityStorage.load();
    if (!isAvailable) {
      if (kDebugMode) debugPrint('[FCM 포그라운드] 배송가능 OFF — 스킵');
      return;
    }
    try { Vibration.vibrate(duration: 200); } catch (_) {}
    Future.delayed(const Duration(milliseconds: 250), () {
      try { Vibration.vibrate(duration: 200); } catch (_) {}
    });
    // 앱이 포그라운드(화면에 보임): 오버레이 X, WebView 배송대기중 영역에만 주입
    // 오버레이는 백그라운드/종료 시 DriverFcmService(네이티브)가 처리
    await _fcmForegroundInject?.call(Map<String, dynamic>.from(data));
  } catch (_) {}
}

/// 오버레이 디듀프: 동일 delivery_id에 대해 짧은 시간 내 중복 표시 방지 (FCM+Realtime 동시 수신 시)
String? _lastOverlayDeliveryId;
int _lastOverlayShownAt = 0;
const _overlayDedupeMs = 2500;

/// 신규 배차 오버레이 표시.
/// 포그라운드: DispatchOverlayActivity (MainActivity 위에 스택). 백그라운드: Full Screen Intent → DispatchOverlayActivity.
Future<void> _showFlutterOverlay(Map<String, String> overlayPayload, {String source = 'fcm'}) async {
  if (!Platform.isAndroid) return;
  try {
    final deliveryId = overlayPayload['delivery_id'] ?? overlayPayload['deliveryId'] ?? '';
    final now = DateTime.now().millisecondsSinceEpoch;

    // 동일 배차에 대한 중복 표시 방지 (FCM과 Realtime이 동시에 올 때)
    if (deliveryId.isNotEmpty && deliveryId == _lastOverlayDeliveryId && (now - _lastOverlayShownAt) < _overlayDedupeMs) {
      if (kDebugMode) debugPrint('[$source] 오버레이 디듀프 스킵: delivery_id=$deliveryId');
      return;
    }

    await OverlayAlertService.triggerOverlayVibration();

    // 포그라운드: DispatchOverlayActivity 사용 (앱 위에 스택됨, FlutterOverlayWindow는 일부 기기에서 미표시)
    final map = <String, dynamic>{
      'delivery_id': deliveryId,
      'deliveryId': deliveryId,
      'pickup': overlayPayload['pickup'] ?? overlayPayload['origin_address'] ?? overlayPayload['origin'] ?? '-',
      'origin_address': overlayPayload['pickup'] ?? overlayPayload['origin_address'] ?? overlayPayload['origin'] ?? '-',
      'origin': overlayPayload['pickup'] ?? overlayPayload['origin_address'] ?? overlayPayload['origin'] ?? '-',
      'destination': overlayPayload['destination'] ?? overlayPayload['destination_address'] ?? overlayPayload['dest'] ?? '-',
      'destination_address': overlayPayload['destination'] ?? overlayPayload['destination_address'] ?? overlayPayload['dest'] ?? '-',
      'dest': overlayPayload['destination'] ?? overlayPayload['destination_address'] ?? overlayPayload['dest'] ?? '-',
      'price': overlayPayload['price'] ?? overlayPayload['fee'] ?? '-',
      'fee': overlayPayload['price'] ?? overlayPayload['fee'] ?? '-',
    };
    await _launchChannel.invokeMethod('showDispatchOverlay', map);
    _lastOverlayDeliveryId = deliveryId;
    _lastOverlayShownAt = now;
    if (kDebugMode) debugPrint('[$source] 오버레이 표시 완료 (DispatchOverlayActivity)');
  } catch (e, st) {
    debugPrint('[$source] 오버레이 오류: $e');
    debugPrint('$st');
  }
}

/// FCM data로 오버레이 표시 (포그라운드 전용 — FlutterOverlayWindow 시스템 팝업)
/// 앱이나 다른 화면 위에 중앙에 필요한 카드만 표시 (전체 덮지 않음)
Future<void> _showOverlayForFcmData(Map<String, dynamic> data) async {
  if (!Platform.isAndroid) return;
  try {
    final overlayPayload = Map<String, String>.from(
      buildOverlayPayloadFromFcmData(Map<String, dynamic>.from(data)),
    );
    var deliveryId = overlayPayload['delivery_id'] ?? overlayPayload['deliveryId'] ?? overlayPayload['order_id'] ?? overlayPayload['orderId'] ?? overlayPayload['order_number'] ?? '';
    if (deliveryId.isEmpty) {
      deliveryId = 'fcm-${DateTime.now().millisecondsSinceEpoch}';
    }
    overlayPayload['delivery_id'] = deliveryId;
    overlayPayload['deliveryId'] = deliveryId;
    await _showFlutterOverlay(overlayPayload, source: 'FCM');
  } catch (e, st) {
    debugPrint('[FCM 포그라운드] 오버레이 오류: $e');
    debugPrint('$st');
  }
}

class DriverApp extends StatelessWidget {
  const DriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '언넌',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const DriverWebViewPage(),
    );
  }
}

/// 오버레이 전용 앱: runApp 직후 화면이 뜨고, 내부에서 payload를 비동기로 받아 표시.
class OverlayApp extends StatelessWidget {
  const OverlayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
        scaffoldBackgroundColor: Colors.transparent,
      ),
      home: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) {
            try {
              FlutterOverlayWindow.closeOverlay();
            } catch (_) {}
          }
        },
        child: const Scaffold(
          backgroundColor: Colors.transparent,
          body: _OverlayPayloadLoader(),
        ),
      ),
    );
  }
}

/// payload를 비동기로 기다렸다가 배차 수락 위젯으로 전달. 로딩 중에는 로딩 표시.
class _OverlayPayloadLoader extends StatefulWidget {
  const _OverlayPayloadLoader();

  @override
  State<_OverlayPayloadLoader> createState() => _OverlayPayloadLoaderState();
}

class _OverlayPayloadLoaderState extends State<_OverlayPayloadLoader> {
  Map<String, String>? _payload;

  @override
  void initState() {
    super.initState();
    OverlayAlertService.playDispatchSound().catchError((_) {});
    _getOverlayPayload().then((payload) {
      print('[Overlay] overlayMain 위젯에 payload 적용: $payload');
      if (mounted) setState(() => _payload = payload);
    }).catchError((_, __) {
      if (mounted) setState(() => _payload = {});
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_payload == null) {
      return const Material(
        color: Colors.transparent,
        child: Center(
          child: SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          ),
        ),
      );
    }
    return DispatchAcceptOverlayWidget(payload: _payload!);
  }
}

/// 배차 수락 오버레이: SharedPreferences에 저장할 키
const _kPendingAcceptPath = 'driver_pending_accept_path';

/// 카카오픽 스타일 오버레이: 흰색 카드, [퀵 배송] 태그, 경로(출발→도착), 금액, 넘기기/수락하기 버튼.
/// 앱 열림(FlutterOverlayWindow) / 앱 닫힘(DispatchOverlayActivity) 공통 UI.
class DispatchAcceptOverlayWidget extends StatefulWidget {
  const DispatchAcceptOverlayWidget({super.key, required this.payload});

  final Map<String, String> payload;

  @override
  State<DispatchAcceptOverlayWidget> createState() => _DispatchAcceptOverlayWidgetState();
}

class _DispatchAcceptOverlayWidgetState extends State<DispatchAcceptOverlayWidget>
    with SingleTickerProviderStateMixin {
  bool _acceptSent = false;
  bool _showSuccess = false;
  late AnimationController _successController;
  late Animation<double> _successScale;

  String get _deliveryId => widget.payload['delivery_id'] ?? widget.payload['deliveryId'] ?? '';
  String get _price => widget.payload['price'] ?? widget.payload['fee'] ?? '-';
  String get _pickup => widget.payload['pickup'] ?? widget.payload['origin_address'] ?? widget.payload['origin'] ?? '-';
  String get _destination =>
      widget.payload['destination'] ?? widget.payload['destination_address'] ?? widget.payload['dest'] ?? '-';

  @override
  void initState() {
    super.initState();
    _successController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );
    _successScale = Tween<double>(begin: 0.5, end: 1.15)
        .chain(CurveTween(curve: Curves.elasticOut))
        .animate(_successController);
  }

  @override
  void dispose() {
    _successController.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    if (_deliveryId.isEmpty || _acceptSent) return;
    _acceptSent = true;
    setState(() => _showSuccess = true);
    _successController.forward();

    await Future.delayed(const Duration(milliseconds: 600));

    const openPath = '/driver/delivery/';
    final openUrl = '$openPath$_deliveryId?accept_delivery=$_deliveryId';

    // FlutterOverlayWindow: SharedPreferences에 URL 저장 후 close (앱 복귀 시 WebView 로드)
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kPendingAcceptPath, openUrl);
    } catch (_) {}

    // DispatchOverlayActivity: MethodChannel으로 MainActivity 시작 및 finish
    try {
      await _overlayChannel.invokeMethod('accept', {
        'deliveryId': _deliveryId,
        'openUrl': openUrl,
      });
    } catch (_) {
      // FlutterOverlayWindow: MethodChannel 없음 → closeOverlay로 닫기
      try {
        await FlutterOverlayWindow.closeOverlay();
      } catch (_) {}
    }
  }

  Future<void> _dismiss() async {
    try {
      await _overlayChannel.invokeMethod('dismiss');
    } catch (_) {
      // FlutterOverlayWindow: MethodChannel 없음 → closeOverlay로 닫기
      try {
        await FlutterOverlayWindow.closeOverlay();
      } catch (_) {}
    }
  }

  // 카카오픽 스타일 색상
  static const Color _teal = Color(0xFF00C7BE); // 틸(녹청) — 태그, 수락 버튼
  static const Color _originBullet = Color(0xFF5AC8FA); // 출발 (연한 블루)
  static const Color _destBullet = Color(0xFFAF52DE); // 도착 (퍼플)
  static const Color _skipBtnGray = Color(0xFF9E9E9E);
  static const Color _infoBoxGray = Color(0xFFF5F5F5);

  @override
  Widget build(BuildContext context) {
    // 흰색 카드 — 창 크기(가로 85%, 세로 36%)에 꽉 채워 검정 여백 없음
    // ClipRRect로 카드 모서리를 유지하면서 창 경계에서 잘라냄
    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox.expand(
              child: Material(
                color: Colors.white,
                child: Column(
                  mainAxisSize: MainAxisSize.max,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 헤더: [퀵 배송] 태그 | 작게 보기 v
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 10, 10, 0),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _teal,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text(
                              '퀵 배송',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: _acceptSent ? null : _dismiss,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '작게 보기',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                  const SizedBox(width: 2),
                                  Icon(Icons.keyboard_arrow_down, size: 18, color: Colors.grey.shade600),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    // 경로: 출발 → 도착 (불릿 + 텍스트)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Column(
                            children: [
                              Container(
                                width: 9,
                                height: 9,
                                decoration: const BoxDecoration(
                                  color: _originBullet,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              Container(
                                width: 2,
                                height: 12,
                                margin: const EdgeInsets.symmetric(vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade300,
                                  borderRadius: BorderRadius.circular(1),
                                ),
                              ),
                              Container(
                                width: 9,
                                height: 9,
                                decoration: const BoxDecoration(
                                  color: _destBullet,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _pickup,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: Colors.black87,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _destination,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: Colors.black87,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    // 배송 정보 박스 (회색)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: _infoBoxGray,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          '퀵 배송',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // 금액 (큰 숫자 + 아이콘)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        children: [
                          if (_price != '-') ...[
                            Text(
                              _price,
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(Icons.monetization_on_outlined, size: 20, color: Colors.amber.shade700),
                          ],
                        ],
                      ),
                    ),
                    const Spacer(),
                    // 버튼: 넘기기(회색) | 수락하기(틸)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 44,
                              child: TextButton(
                                onPressed: _acceptSent ? null : _dismiss,
                                style: TextButton.styleFrom(
                                  backgroundColor: _skipBtnGray,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                child: const Text('넘기기', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 2,
                            child: SizedBox(
                              height: 44,
                              child: ElevatedButton(
                                onPressed: _acceptSent ? null : _accept,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: _teal,
                                  foregroundColor: Colors.white,
                                  disabledBackgroundColor: Colors.grey.shade400,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  elevation: 0,
                                ),
                                child: Text(
                                  _acceptSent ? '처리 중…' : '수락하기',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_showSuccess) _buildSuccessOverlay(),
        ],
      ),
    );
  }

  Widget _buildSuccessOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withOpacity(0.35),
        child: Center(
          child: ScaleTransition(
            scale: _successScale,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.15),
                    blurRadius: 20,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      color: _teal,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check, size: 40, color: Colors.white),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    '배차 수락 완료',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class DriverWebViewPage extends StatefulWidget {
  const DriverWebViewPage({super.key});

  @override
  State<DriverWebViewPage> createState() => _DriverWebViewPageState();
}

class _DriverWebViewPageState extends State<DriverWebViewPage> with WidgetsBindingObserver {
  late final WebViewController _controller;
  bool _isLoading = true;
  String? _error;
  String? _lastSentFcmToken;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    debugPrint('[기사앱] initState');
    _checkAppVersion();
    _controller = _createController();
    _registerFcmForegroundInjector();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // [권한 호출 위치] '다른 앱 위에 표시'는 initState에서만 호출 (배송 가능 버튼과 무관). 800ms 후 requestOverlayPermissionWithDialog(context)
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) requestOverlayPermissionWithDialog(context);
      });
    });
  }

  @override
  void dispose() {
    setFcmForegroundInjector(null);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _registerFcmForegroundInjector() {
    setFcmForegroundInjector((data) async {
      if (!mounted) return;
      final payload = buildOverlayPayloadFromFcmData(data);
      var deliveryId = payload['delivery_id'] ?? payload['deliveryId'] ?? '';
      if (deliveryId.isEmpty) deliveryId = 'fcm-${DateTime.now().millisecondsSinceEpoch}';
      final pickup = payload['pickup'] ?? payload['origin_address'] ?? '-';
      final dest = payload['destination'] ?? payload['destination_address'] ?? '-';
      final price = payload['price'] ?? payload['fee'] ?? '-';
      final feeNum = price.isNotEmpty && price != '-'
          ? double.tryParse(price.replaceAll(RegExp(r'[^\d.]'), ''))
          : null;
      final detail = jsonEncode({
        'delivery': {
          'id': deliveryId,
          'pickup_address': pickup,
          'delivery_address': dest,
          'driver_fee': feeNum,
          'total_fee': feeNum,
        },
        'notificationId': 'fcm-$deliveryId',
      });
      final js = "try{var d=$detail;window.dispatchEvent(new CustomEvent('driverNewDeliveryFcm',{detail:d}));}catch(e){}";
      try {
        await _controller.runJavaScript(js);
        if (kDebugMode) debugPrint('[기사앱] FCM 포그라운드 → WebView 배송대기중 주입 완료');
      } catch (e) {
        if (kDebugMode) debugPrint('[기사앱] FCM 주입 오류: $e');
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      _handleLaunchUrl();
    }
  }

  WebViewController _createController() {
    final c = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent('QuickHWDriverApp/1.0');
    _setupAndroidGeolocation(c);
    c
      ..addJavaScriptChannel(
        'DriverScreenChannel',
        onMessageReceived: (JavaScriptMessage message) async {
          final screen = message.message == 'available' ? 'available' : 'main';
          setCurrentDriverScreen(screen);
        },
      )
      ..addJavaScriptChannel(
        'AvailabilityChannel',
        onMessageReceived: (JavaScriptMessage message) async {
          final v = message.message == 'true';
          await DriverAvailabilityStorage.save(v);
          if (kDebugMode) debugPrint('[기사앱] 배송 가능 상태 저장: $v');
          if (v) _injectFcmTokenToWeb();
        },
      )
      ..addJavaScriptChannel(
        'RequestFcmTokenSync',
        onMessageReceived: (_) async {
          await _injectFcmTokenToWeb(forceResend: true);
        },
      )
      ..addJavaScriptChannel(
        'RequestLocationPermission',
        onMessageReceived: (_) async {
          if (!Platform.isAndroid) return;
          final status = await Permission.location.status;
          if (!status.isGranted) await Permission.location.request();
          if (kDebugMode) debugPrint('[기사앱] RequestLocationPermission → ${status.isGranted ? "허용됨" : "거부됨"}');
        },
      )
      ..addJavaScriptChannel(
        'FlutterOverlayChannel',
        onMessageReceived: (JavaScriptMessage message) async {
          // 앱이 포그라운드(화면에 보임)이면 오버레이 X — WebView 배송대기중 카드가 이미 표시됨
          // 오버레이는 백그라운드/종료 시 DriverFcmService(네이티브)가 처리
          if (kDebugMode) debugPrint('[기사앱] FlutterOverlayChannel: 앱 포그라운드 — 오버레이 스킵');
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            debugPrint('[기사앱] 페이지 로딩 시작: $url');
            if (mounted) setState(() { _isLoading = true; _error = null; });
          },
          onPageFinished: (url) async {
            if (mounted) setState(() => _isLoading = false);
            _injectFcmTokenToWeb();
            for (final delay in [800, 2000, 4000, 7000]) {
              Future.delayed(Duration(milliseconds: delay), () {
                if (mounted) _injectFcmTokenToWeb(forceResend: true);
              });
            }
            _handleLaunchUrl();
            // 배송상세 페이지: 위치 권한 사전 요청 (내 위치 지도 표시를 위해)
            if (Platform.isAndroid && (url.contains('/driver/delivery/') || url.contains('/driver/delivery'))) {
              var status = await Permission.location.status;
              if (!status.isGranted) {
                status = await Permission.location.request();
                if (kDebugMode) debugPrint('[기사앱] 배송상세 진입 → 위치 권한 사전 요청: ${status.isGranted ? "허용" : "거부"}');
              }
            }
          },
          onWebResourceError: (e) {
            debugPrint('[기사앱] 에러: ${e.description}');
            if (mounted) setState(() { _isLoading = false; _error = e.description; });
          },
        ),
      )
      ..loadRequest(Uri.parse(driverWebUrl));
    return c;
  }

  /// Android WebView에서 navigator.geolocation 사용 시 앱 위치 권한과 연동
  void _setupAndroidGeolocation(WebViewController controller) {
    if (!Platform.isAndroid) return;
    final android = controller.platform;
    if (android is! AndroidWebViewController) return;
    // WebView geolocation 활성화 및 콜백: 앱 위치 권한 요청 후 허용 시 retain=true로 전체 화면 공통 사용
    android.setGeolocationEnabled(true);
    android.setGeolocationPermissionsPromptCallbacks(
      onShowPrompt: (GeolocationPermissionsRequestParams request) async {
        var status = await Permission.location.status;
        if (!status.isGranted) {
          status = await Permission.location.request();
        }
        final allow = status.isGranted;
        if (kDebugMode) {
          debugPrint('[기사앱] 위치 권한 WebView origin=${request.origin} → ${allow ? "허용" : "거부"}');
        }
        return GeolocationPermissionsResponse(allow: allow, retain: allow);
      },
    );
  }

  /// 오버레이/배차 수락으로 진입 시: open_url 있으면 해당 URL 로드, 없으면 accept_delivery_id로 쿼리 로드
  Future<void> _handleLaunchUrl() async {
    if (!Platform.isAndroid || !mounted) return;
    try {
      final path = await _launchChannel.invokeMethod<String>('getLaunchOpenUrl');
      if (path != null && path.isNotEmpty) {
        final base = Uri.parse(driverWebUrl).origin;
        final url = path.startsWith('http') ? path : '$base$path';
        await _controller.loadRequest(Uri.parse(url));
        debugPrint('[기사앱] 배차 수락으로 진입: $url');
        return;
      }
      final id = await _launchChannel.invokeMethod<String>('getLaunchAcceptDeliveryId');
      if (id != null && id.isNotEmpty && mounted) {
        final uri = driverWebUrl.contains('?')
            ? '$driverWebUrl&accept_delivery=$id'
            : '$driverWebUrl?accept_delivery=$id';
        await _controller.loadRequest(Uri.parse(uri));
        debugPrint('[기사앱] 배차 수락으로 진입: accept_delivery=$id');
        return;
      }
      // FlutterOverlayWindow 수락 시 SharedPreferences에 저장된 경로 로드
      final prefs = await SharedPreferences.getInstance();
      final pendingPath = prefs.getString(_kPendingAcceptPath);
      if (pendingPath != null && pendingPath.isNotEmpty && mounted) {
        await prefs.remove(_kPendingAcceptPath);
        final base = Uri.parse(driverWebUrl).origin;
        final url = pendingPath.startsWith('http') ? pendingPath : '$base$pendingPath';
        await _controller.loadRequest(Uri.parse(url));
        debugPrint('[기사앱] FlutterOverlayWindow 수락으로 진입: $url');
      }
    } catch (_) {}
  }

  /// 앱을 열 때마다 서버에 최신 버전을 물어보고, 필요 시 업데이트 안내(필수 시 다이얼로그 후 다운로드 페이지 열기).
  Future<void> _checkAppVersion() async {
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    final result = await AppVersionService.checkUpdate();
    if (!mounted || result == null || !result.shouldUpdate) return;
    final mustUpdate = result.mustUpdate;
    final downloadUrl = result.downloadUrl;
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      showDialog(
        context: context,
        barrierDismissible: !mustUpdate,
        builder: (ctx) => AlertDialog(
          title: Text(mustUpdate ? '업데이트 필요' : '새 버전이 있습니다'),
          content: Text(
            mustUpdate
                ? '원활한 이용을 위해 앱을 업데이트해 주세요.\n(현재: ${result.currentVersion} → 최신: ${result.latestVersion ?? result.minVersion})'
                : '새 버전 ${result.latestVersion}이 있습니다. 업데이트하시겠습니까?',
          ),
          actions: [
            if (!mustUpdate)
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('나중에'),
              ),
            FilledButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                AppVersionService.openDownloadUrl(downloadUrl);
              },
              child: const Text('업데이트'),
            ),
          ],
        ),
      );
    });
  }

  /// 토큰이 변경되었을 때만 웹에 1회 전달. forceResend=true면 React 마운트 지연 대비 재전달.
  Future<void> _injectFcmTokenToWeb({bool forceResend = false}) async {
    final t = await FcmService.getToken();
    if (t == null || !mounted) return;
    if (!forceResend && _lastSentFcmToken == t) return;
    if (!forceResend) _lastSentFcmToken = t;
    if (kDebugMode) {
      debugPrint('[기사앱] FCM 토큰 웹 전달(서버 DB 대조용) 끝 24자: ${t.length >= 24 ? t.substring(t.length - 24) : t}');
    }
    final escaped = t.replaceAll(r'\', r'\\').replaceAll("'", r"\'");
    // window에 저장 + 이벤트: React 마운트 전 전달돼도 마운트 시 window에서 읽어 등록 가능
    final js = "window.__driverFcmToken='$escaped';window.dispatchEvent(new CustomEvent('driverFcmToken',{detail:'$escaped'}));";
    try {
      await _controller.runJavaScript(js);
      if (kDebugMode) debugPrint('[기사앱] FCM 토큰 웹 전달 완료 (토큰 변경 시 1회)');
    } catch (_) {
      _lastSentFcmToken = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            WebViewWidget(key: const Key('driver_webview'), controller: _controller),
            if (_error != null)
              _buildErrorOverlay()
            else if (_isLoading)
              _buildLoadingOverlay(),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingOverlay() {
    return Container(
      color: Colors.white,
      child: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('언넌 불러오는 중...'),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorOverlay() {
    return Container(
      color: Colors.white,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text(_error!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16)),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () {
                  setState(() { _error = null; _isLoading = true; });
                  _controller.loadRequest(Uri.parse(driverWebUrl));
                },
                icon: const Icon(Icons.refresh),
                label: const Text('다시 시도'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// FCM 토큰 로그 (서버 등록/디버깅용). initialize() 이후 한 번 호출.
Future<void> logFcmToken() async {
  try {
    final token = await FcmService.getToken();
    if (token != null && token.isNotEmpty) {
      debugPrint('------- 내 기기 FCM 토큰 -------');
      debugPrint(token);
      debugPrint('------------------------------');
    }
  } catch (e) {
    debugPrint('logFcmToken 오류: $e');
  }
}
