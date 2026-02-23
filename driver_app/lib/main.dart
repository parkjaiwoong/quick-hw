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

/// 배터리 최적화 제외 여부 확인 후, 미제외 시 안내 다이얼로그를 띄우고 [설정 열기]로 시스템 화면 이동.
/// 백그라운드에서도 배차 알림(오버레이)이 즉시 뜨도록 요청.
Future<void> requestBatteryOptimizationExclusionWithDialog(BuildContext context) async {
  if (!Platform.isAndroid) return;
  try {
    final excluded = await _launchChannel.invokeMethod<bool>('getBatteryOptimizationExcluded');
    if (excluded == true) return;
    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('배터리 최적화 제외'),
        content: const Text(
          '백그라운드에서도 배차 요청이 즉시 알림으로 뜨려면 '
          '"배터리 최적화 제외"가 필요합니다.\n\n'
          '아래 [설정 열기]를 누르면 설정 화면으로 이동합니다. '
          '언넌 앱을 "제한 없음" 또는 "최적화 안 함"으로 설정해 주세요.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _launchChannel.invokeMethod('openBatteryOptimizationSettings');
            },
            child: const Text('설정 열기'),
          ),
        ],
      ),
    );
  } catch (_) {}
}

/// 포그라운드 FCM: message.data만 있어도 동작 (notification 불필요). 배송 관련 키 있으면 진동 + 오버레이
/// 앱 화면 위에 모달처럼 오버레이 표시 (앱은 그대로 둔 채 위에 띄움)
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
    if (isNewDelivery) {
      // 배송가능 체크: 배송가능 누른 기사에게만 오버레이 표시
      final isAvailable = await DriverAvailabilityStorage.load();
      if (!isAvailable) {
        if (kDebugMode) debugPrint('[FCM 포그라운드] 배송가능 OFF — 오버레이 스킵');
        return;
      }
      try { Vibration.vibrate(duration: 200); } catch (_) {}
      Future.delayed(const Duration(milliseconds: 250), () {
        try { Vibration.vibrate(duration: 200); } catch (_) {}
      });
      _showOverlayForFcmData(message.data);
    }
  } catch (_) {}
}

/// 오버레이 디듀프: 동일 delivery_id에 대해 짧은 시간 내 중복 표시 방지 (FCM+Realtime 동시 수신 시)
String? _lastOverlayDeliveryId;
int _lastOverlayShownAt = 0;
const _overlayDedupeMs = 2500;

/// FlutterOverlayWindow 오버레이 표시 — 중앙 팝업, 중첩 방지, 디듀프 적용
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
    // 기존 오버레이 먼저 닫기 (중첩 방지)
    try {
      await FlutterOverlayWindow.closeOverlay();
      await Future.delayed(const Duration(milliseconds: 100));
    } catch (_) {}

    await FlutterOverlayWindow.shareData(overlayPayload);
    await FlutterOverlayWindow.showOverlay(
      overlayTitle: '신규 배차 요청',
      overlayContent: '출발: ${overlayPayload['pickup'] ?? overlayPayload['origin_address'] ?? '-'}\n도착: ${overlayPayload['destination'] ?? overlayPayload['destination_address'] ?? '-'}',
      alignment: OverlayAlignment.center,
      width: WindowSize.matchParent,
      height: 320,
      positionGravity: PositionGravity.none,
    );
    _lastOverlayDeliveryId = deliveryId;
    _lastOverlayShownAt = now;
    if (kDebugMode) debugPrint('[$source] 오버레이 표시 완료 (중앙 팝업)');
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

/// 심플 다크모드 오버레이: message.data의 price, pickup, destination 연결.
/// 배경 85% 불투명 짙은 네이비 / 금액 상단 중앙 형광노랑 / 경로 수직점선+화살표 / 하단 수락·거절 버튼
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

    // 오버레이 닫기 (FlutterOverlayWindow 방식 — 포그라운드 팝업)
    try {
      await FlutterOverlayWindow.closeOverlay();
    } catch (_) {}

    // DispatchOverlayActivity 방식(백그라운드)에서 실행된 경우 MethodChannel로도 닫기
    // (포그라운드에서는 _overlayChannel이 없으므로 예외 무시)
    try {
      const openPath = '/driver?accept_delivery=';
      final openUrl = '$openPath$_deliveryId';
      await _overlayChannel.invokeMethod('accept', {
        'deliveryId': _deliveryId,
        'openUrl': openUrl,
      });
    } catch (_) {}
  }

  Future<void> _dismiss() async {
    // FlutterOverlayWindow 방식 닫기 (포그라운드)
    try {
      await FlutterOverlayWindow.closeOverlay();
    } catch (_) {}
    // DispatchOverlayActivity 방식 닫기 (백그라운드) — 예외 무시
    try {
      await _overlayChannel.invokeMethod('dismiss');
    } catch (_) {}
  }

  static const Color _bgNavy = Color(0xF20D1B2A); // 짙은 네이비 95% 불투명
  static const Color _priceColor = Color(0xFFD4FF00); // 형광 노랑
  static const Color _acceptBtnColor = Color(0xFF42A5F5); // 밝은 파란색

  @override
  Widget build(BuildContext context) {
    // 중앙 팝업 카드 스타일 — 화면 전체 덮지 않고 필요한 카드만 중앙에 표시 (이전 버전 디자인)
    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          // 배경 딤 — 터치 시 넘기기 (반투명, 카드 영역 외부만)
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _acceptSent ? null : _dismiss,
              child: Container(color: Colors.black.withOpacity(0.45)),
            ),
          ),
          // 중앙 카드
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Material(
                color: Colors.transparent,
                child: Container(
                  decoration: BoxDecoration(
                    color: _bgNavy,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.6),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 헤더: 타이틀 + 금액
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                        child: Row(
                          children: [
                            const Icon(Icons.local_shipping, color: Color(0xFF42A5F5), size: 22),
                            const SizedBox(width: 8),
                            const Text(
                              '신규 배차 요청',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            const Spacer(),
                            if (_price != '-')
                              Text(
                                _price,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: _priceColor,
                                  letterSpacing: -0.5,
                                ),
                              ),
                          ],
                        ),
                      ),
                      Container(height: 1, color: Colors.white12),
                      // 경로
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 14, 20, 4),
                        child: Row(
                          children: [
                            const Icon(Icons.circle, size: 9, color: Color(0xFF66BB6A)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _pickup,
                                style: const TextStyle(fontSize: 13, color: Colors.white70),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(left: 24, top: 2, bottom: 2),
                        child: Container(width: 2, height: 12, color: Colors.white24),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                        child: Row(
                          children: [
                            const Icon(Icons.location_on, size: 11, color: Color(0xFFEF5350)),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                _destination,
                                style: const TextStyle(fontSize: 13, color: Colors.white70),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // 버튼
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                        child: Row(
                          children: [
                            Expanded(
                              child: SizedBox(
                                height: 48,
                                child: OutlinedButton(
                                  onPressed: _acceptSent ? null : _dismiss,
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.white70,
                                    side: const BorderSide(color: Colors.white24),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: const Text('넘기기'),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              flex: 2,
                              child: SizedBox(
                                height: 48,
                                child: ElevatedButton(
                                  onPressed: _acceptSent ? null : _accept,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: _acceptBtnColor,
                                    foregroundColor: Colors.white,
                                    disabledBackgroundColor: Colors.grey.shade700,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    elevation: 0,
                                  ),
                                  child: Text(
                                    _acceptSent ? '처리 중…' : '수락하기',
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                    ),
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
          ),
          if (_showSuccess) _buildSuccessOverlay(),
        ],
      ),
    );
  }

  Widget _buildSuccessOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withOpacity(0.45),
        child: Center(
          child: ScaleTransition(
            scale: _successScale,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 28),
              decoration: BoxDecoration(
                color: _bgNavy,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.5),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2E7D32),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: _priceColor.withOpacity(0.4),
                          blurRadius: 16,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.check, size: 40, color: Colors.white),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    '배차 수락 완료',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // [권한 호출 위치] '다른 앱 위에 표시'는 initState에서만 호출 (배송 가능 버튼과 무관). 800ms 후 requestOverlayPermissionWithDialog(context)
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) requestOverlayPermissionWithDialog(context);
      });
      Future.delayed(const Duration(milliseconds: 4000), () {
        if (mounted) requestBatteryOptimizationExclusionWithDialog(context);
      });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      _handleLaunchUrl();
    }
  }

  WebViewController _createController() {
    final c = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted);
    _setupAndroidGeolocation(c);
    c
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
          if (!Platform.isAndroid) return;
          try {
            final data = jsonDecode(message.message) as Map<String, dynamic>?;
            if (data == null || data.isEmpty) {
              debugPrint('[기사앱] FlutterOverlayChannel: payload 비어있음');
              return;
            }
            final overlayPayload = Map<String, String>.from(
              buildOverlayPayloadFromFcmData(Map<String, dynamic>.from(data)),
            );
            final deliveryId = overlayPayload['delivery_id'] ?? overlayPayload['deliveryId'] ?? '';
            if (deliveryId.isEmpty) {
              overlayPayload['delivery_id'] = 'web-${DateTime.now().millisecondsSinceEpoch}';
              overlayPayload['deliveryId'] = overlayPayload['delivery_id']!;
            }
            await _showFlutterOverlay(overlayPayload, source: 'Realtime');
          } catch (e, st) {
            debugPrint('[기사앱] FlutterOverlayChannel 오류: $e');
            debugPrint('$st');
          }
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
      if (id == null || id.isEmpty || !mounted) return;
      final uri = driverWebUrl.contains('?')
          ? '$driverWebUrl&accept_delivery=$id'
          : '$driverWebUrl?accept_delivery=$id';
      await _controller.loadRequest(Uri.parse(uri));
      debugPrint('[기사앱] 배차 수락으로 진입: accept_delivery=$id');
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
