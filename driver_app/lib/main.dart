import 'dart:async';
import 'dart:io';

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';
import 'package:vibration/vibration.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'app_config.dart';
import 'app_version_service.dart';
import 'availability_storage.dart';
import 'fcm_service.dart';

/// 배차 수락 팝업에서 "수락" 후 MainActivity가 전달하는 delivery_id (MethodChannel)
const _launchChannel = MethodChannel('com.quickhw.driver_app/launch');

/// 오버레이 전용 채널 (overlayMain 엔트리 포인트에서 payload 수신 / 수락·거절 전달)
const _overlayChannel = MethodChannel('com.quickhw.driver_app/overlay');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await _runApp();
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
  print('[Overlay] runApp 실행 직전');
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
        print('[Overlay] overlayMain 수신(getPayload): $payload');
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
          print('[Overlay] overlayMain 수신(overlayListener/shareData): $payload');
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

Future<void> _runApp() async {
  await FcmService.initialize();
  FirebaseAnalytics.instance;
  await logFcmToken();
  FirebaseMessaging.onMessage.listen(_onForegroundMessage);
  runApp(const DriverApp());
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

/// 포그라운드 FCM: 새 배송 요청일 때만 진동 (Full Screen Intent는 백그라운드에서 네이티브가 처리)
void _onForegroundMessage(RemoteMessage message) {
  try {
    final type = message.data['type'];
    final isNewDelivery = type == 'new_delivery_request' || type == 'new_delivery';
    if (isNewDelivery) {
      try { Vibration.vibrate(duration: 200); } catch (_) {}
      Future.delayed(const Duration(milliseconds: 250), () {
        try { Vibration.vibrate(duration: 200); } catch (_) {}
      });
    }
  } catch (_) {}
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
      home: const Scaffold(
        backgroundColor: Colors.transparent,
        body: _OverlayPayloadLoader(),
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

/// 기사님이 볼 배차 알림 위젯 (오버레이 전용). 배경 투명 + 카드만 표시.
/// UI 구성: 상단 '신규 배차 요청' 타이틀 / 중간 출발지·도착지·요금 / 하단 슬라이드 수락 버튼 + 거절 버튼.
class DispatchAcceptOverlayWidget extends StatefulWidget {
  const DispatchAcceptOverlayWidget({super.key, required this.payload});

  final Map<String, String> payload;

  @override
  State<DispatchAcceptOverlayWidget> createState() => _DispatchAcceptOverlayWidgetState();
}

class _DispatchAcceptOverlayWidgetState extends State<DispatchAcceptOverlayWidget> {
  double _slideValue = 0;
  final GlobalKey _slideKey = GlobalKey();
  bool _acceptSent = false;

  String get _deliveryId => widget.payload['delivery_id'] ?? widget.payload['deliveryId'] ?? '';
  String get _origin => widget.payload['origin_address'] ?? widget.payload['origin'] ?? '-';
  String get _dest => widget.payload['destination_address'] ?? widget.payload['destination'] ?? '-';
  String get _fee => widget.payload['fee'] ?? widget.payload['price'] ?? '-';

  Future<void> _accept() async {
    if (_deliveryId.isEmpty || _acceptSent) return;
    _acceptSent = true;
    const openPath = '/driver?accept_delivery=';
    final openUrl = '$openPath$_deliveryId';
    try {
      await FlutterOverlayWindow.closeOverlay();
    } catch (_) {}
    try {
      await _overlayChannel.invokeMethod('accept', {
        'deliveryId': _deliveryId,
        'openUrl': openUrl,
      });
    } catch (_) {}
  }

  Future<void> _dismiss() async {
    try {
      await _overlayChannel.invokeMethod('dismiss');
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    // 배경 투명: 다른 앱 위에 카드만 보이도록 함. 카드 뒤만 살짝 딤 처리.
    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onTap: _dismiss,
              child: Container(color: Colors.black26),
            ),
          ),
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Card(
                    elevation: 8,
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            '신규 배차 요청',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 16),
                          _infoRow('출발지', _origin),
                          const SizedBox(height: 10),
                          _infoRow('도착지', _dest),
                          if (_fee != '-') ...[
                            const SizedBox(height: 10),
                            _infoRow('요금', _fee),
                          ],
                          const SizedBox(height: 20),
                          _slideAcceptButton(context),
                          const SizedBox(height: 10),
                          TextButton(
                            onPressed: _acceptSent ? null : _dismiss,
                            child: const Text('거절'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
        ),
        const SizedBox(height: 2),
        Text(
          value.isEmpty ? '-' : value,
          style: const TextStyle(fontSize: 15),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _slideAcceptButton(BuildContext context) {
    return GestureDetector(
      key: _slideKey,
      onHorizontalDragUpdate: (d) {
        if (_acceptSent) return;
        final box = _slideKey.currentContext?.findRenderObject() as RenderBox?;
        final w = box?.size.width ?? 0;
        if (w <= 0) return;
        setState(() {
          _slideValue = (_slideValue * w + d.delta.dx).clamp(0.0, w) / w;
          if (_slideValue >= 0.95) _accept();
        });
      },
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: Colors.grey.shade300,
          borderRadius: BorderRadius.circular(24),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          alignment: Alignment.center,
          children: [
            FractionallySizedBox(
              widthFactor: _slideValue,
              child: Container(color: Theme.of(context).colorScheme.primary),
            ),
            Text(
              _slideValue >= 0.95 ? '수락됨' : '슬라이드하여 수락하기 →',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// widthFactor만 적용하는 SizedBox (Stack 내 레이아웃용).
class FractionallySizedBox extends StatelessWidget {
  const FractionallySizedBox({super.key, required this.widthFactor, required this.child});

  final double widthFactor;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SizedBox(
          width: constraints.maxWidth * widthFactor,
          child: child,
        );
      },
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
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'AvailabilityChannel',
        onMessageReceived: (JavaScriptMessage message) async {
          final v = message.message == 'true';
          await DriverAvailabilityStorage.save(v);
          if (kDebugMode) debugPrint('[기사앱] 배송 가능 상태 저장: $v');
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            debugPrint('[기사앱] 페이지 로딩 시작: $url');
            if (mounted) setState(() { _isLoading = true; _error = null; });
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
            _injectFcmTokenToWeb();
            _handleLaunchUrl();
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

  Future<void> _injectFcmTokenToWeb() async {
    final t = await FcmService.getToken();
    if (t == null || !mounted) return;
    final escaped = t.replaceAll(r'\', r'\\').replaceAll("'", r"\'");
    final js = "window.dispatchEvent(new CustomEvent('driverFcmToken', { detail: '$escaped' }));";
    for (final delayMs in [0, 1500, 3500]) {
      if (!mounted) return;
      if (delayMs > 0) await Future.delayed(Duration(milliseconds: delayMs));
      if (!mounted) return;
      try {
        await _controller.runJavaScript(js);
      } catch (_) {}
    }
  }

  /// 테스트: 오버레이가 뜨면 FCM 연결 문제, 안 뜨면 OverlayApp 렌더링 문제.
  Future<void> _testOverlay() async {
    if (!Platform.isAndroid) return;
    try {
      const testPayload = <String, String>{
        'delivery_id': 'test-overlay-1',
        'deliveryId': 'test-overlay-1',
        'order_id': 'test-order',
        'origin_address': '테스트 출발지',
        'destination_address': '테스트 도착지',
        'fee': '0원',
      };
      await FlutterOverlayWindow.shareData(testPayload);
      await FlutterOverlayWindow.showOverlay(
        overlayTitle: '신규 배차 요청',
        overlayContent: '테스트 출발지',
        alignment: OverlayAlignment.center,
        width: 400,
        height: 520,
      );
      debugPrint('[기사앱] 오버레이 테스트: showOverlay 호출 완료');
    } catch (e) {
      debugPrint('[기사앱] 오버레이 테스트 실패: $e');
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
      floatingActionButton: Platform.isAndroid
          ? FloatingActionButton.small(
              onPressed: _testOverlay,
              tooltip: '배차 오버레이 테스트',
              child: const Icon(Icons.notifications_active),
            )
          : null,
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
