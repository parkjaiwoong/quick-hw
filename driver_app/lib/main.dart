import 'dart:async';
import 'dart:ui' as ui;

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:vibration/vibration.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'app_config.dart';
import 'app_version_service.dart';
import 'fcm_service.dart';

/// 디버깅 없이 기기 화면에서 오류 확인용: 여기에 쌓인 메시지를 화면에 표시
final ValueNotifier<List<String>> screenErrorLog = ValueNotifier<List<String>>([]);
const int _maxScreenErrors = 20;

void addScreenError(String message) {
  final line = '${DateTime.now().toString().substring(11, 19)} $message';
  final next = [...screenErrorLog.value, line];
  screenErrorLog.value = next.length > _maxScreenErrors ? next.sublist(next.length - _maxScreenErrors) : next;
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 화면에 오류 찍기 (디버거 없이 기기에서 원인 확인용)
  FlutterError.onError = (FlutterErrorDetails details) {
    addScreenError('ERR: ${details.exception}\n${details.stack?.toString().split('\n').take(5).join('\n') ?? ''}');
    FlutterError.presentError(details);
  };
  ui.PlatformDispatcher.instance.onError = (Object error, StackTrace stackTrace) {
    addScreenError('DISP: $error\n${stackTrace.toString().split('\n').take(5).join('\n')}');
    return true;
  };
  runZonedGuarded(() {
    _runApp();
  }, (Object error, StackTrace stackTrace) {
    addScreenError('ZONE: $error\n${stackTrace.toString().split('\n').take(5).join('\n')}');
  });
}

Future<void> _runApp() async {
  debugPrint('[기사앱] main() 시작 — 디버그 콘솔에 이 로그가 보이면 연결됨');
  // 백그라운드 메시지 핸들러는 반드시 main() 최상위에서 등록 (클래스/메서드 안이면 안 됨)
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await FcmService.initialize();
  debugPrint('[기사앱] FcmService.initialize 완료');
  // Analytics 라이브러리 로드 (Messaging "analytics library is missing" 경고 제거)
  FirebaseAnalytics.instance;
  await getMyDeviceToken();

  // 포그라운드 수신 시: 로그 + 네이티브 진동 (WebView UI/소리보다 먼저 도달할 수 있음)
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    try {
      debugPrint('[FCM] 📩 포그라운드 메시지 수신');
      debugPrint('[FCM]   title: ${message.notification?.title}');
      debugPrint('[FCM]   body: ${message.notification?.body}');
      debugPrint('[FCM]   data: ${message.data}');
      try {
        Vibration.vibrate(duration: 200);
        Future.delayed(const Duration(milliseconds: 250), () {
          try { Vibration.vibrate(duration: 200); } catch (_) {}
        });
      } catch (_) {}
    } catch (e, _) {
      debugPrint('[FCM] onMessage 처리 중 오류: $e');
      addScreenError('FCM onMessage: $e');
    }
  });
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    try {
      debugPrint('[FCM] 👆 알림 탭해서 앱 열림');
      debugPrint('[FCM]   title: ${message.notification?.title}');
      debugPrint('[FCM]   data: ${message.data}');
    } catch (e, _) {
      debugPrint('[FCM] onMessageOpenedApp 처리 중 오류: $e');
      addScreenError('FCM onMessageOpenedApp: $e');
    }
  });
  try {
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) {
      debugPrint('[FCM] 🚀 앱이 알림으로부터 실행됨 (종료 상태에서 탭)');
      debugPrint('[FCM]   data: ${initial.data}');
    }
  } catch (e, _) {
    debugPrint('[FCM] getInitialMessage 오류: $e');
    addScreenError('FCM getInitialMessage: $e');
  }

  // 테스트용: 무조건 한 건 넣어서 모달에 내용이 보이도록 (반영 확인)
  addScreenError('테스트: 오류 로그 반영 확인');

  runApp(const DriverApp());
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
      home: const ScreenErrorWrapper(child: DriverWebViewPage()),
    );
  }
}

/// 디버거 없이 기기에서 오류 확인: 제일 상단 모달 형태로 오류2내용 표시 (테스트 1건 항상, 신규 건은 밑에 추가)
class ScreenErrorWrapper extends StatelessWidget {
  const ScreenErrorWrapper({super.key, required this.child});
  final Widget child;

  static const double _modalWidth = 300.0;
  static const double _modalHeight = 220.0;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        // 제일 상단 모달: 오류2내용 제목 + 바로 밑 여백 + 목록(스크롤)
        Positioned(
          top: MediaQuery.of(context).padding.top + 4,
          left: (MediaQuery.of(context).size.width - _modalWidth) / 2,
          width: _modalWidth,
          height: _modalHeight,
          child: Material(
            elevation: 16,
            shadowColor: Colors.black54,
            borderRadius: BorderRadius.circular(12),
            child: ValueListenableBuilder<List<String>>(
              valueListenable: screenErrorLog,
              builder: (context, list, _) {
                return Container(
                  decoration: BoxDecoration(
                    color: Colors.grey[900],
                    border: Border.all(color: Colors.orange, width: 2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 오류2내용 헤더
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 10, 8, 6),
                        child: Row(
                          children: [
                            const Icon(Icons.warning_amber, color: Colors.orange, size: 22),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '오류2내용 => ${list.isEmpty ? "없음" : "${list.length}건"}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            IconButton(
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                              icon: const Icon(Icons.clear_all, color: Colors.white70, size: 20),
                              onPressed: () => screenErrorLog.value = [],
                            ),
                          ],
                        ),
                      ),
                      const Divider(height: 1, color: Colors.white24),
                      // 오류2내용 바로 밑 여백 후 목록 (신규 건은 여기 추가됨)
                      const SizedBox(height: 8),
                      Expanded(
                        child: list.isEmpty
                            ? const Center(
                                child: Text(
                                  '오류 없음\n(반영 확인용)',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: Colors.white54, fontSize: 11),
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                itemCount: list.length,
                                itemBuilder: (_, i) => Padding(
                                  padding: const EdgeInsets.only(bottom: 6),
                                  child: SelectableText(
                                    list[i],
                                    style: const TextStyle(color: Colors.white70, fontSize: 10),
                                    maxLines: 4,
                                  ),
                                ),
                              ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class DriverWebViewPage extends StatefulWidget {
  const DriverWebViewPage({super.key});

  @override
  State<DriverWebViewPage> createState() => _DriverWebViewPageState();
}

class _DriverWebViewPageState extends State<DriverWebViewPage> {
  late final WebViewController _controller;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();


    // 🔍 확인 포인트 1: 이 로그가 한 번만 찍히는지, 아니면 계속 반복되는지 보세요.
    debugPrint('[기사앱] initState 호출됨');

    _checkAppVersion();
    _controller = _createController();
  }

  WebViewController _createController() {
    final c = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            debugPrint('[기사앱] 페이지 로딩 시작: $url');
            if (mounted) setState(() { _isLoading = true; _error = null; });
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
            _injectFcmTokenToWeb();
          },
          onWebResourceError: (e) {
            debugPrint('[기사앱] 에러 발생: ${e.url} — ${e.description}');
            addScreenError('WebView: ${e.description} (${e.url})');
            if (mounted) {
              setState(() {
              _isLoading = false;
              _error = e.description;
            });
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(driverWebUrl));
    return c;
  }

  /// 앱 실행 시 서버에서 최신 버전 확인 후 업데이트 안내
  Future<void> _checkAppVersion() async {
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;
    final result = await AppVersionService.checkUpdate();
    if (!mounted || result == null || !result.shouldUpdate) return;
    final mustUpdate = result.mustUpdate;
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
                AppVersionService.openDownloadUrl(result.downloadUrl);
              },
              child: const Text('업데이트'),
            ),
          ],
        ),
      );
    });
  }

  /// FCM 토큰을 웹에 전달해 서버에 등록 (탭 종료 후에도 푸시 수신)
  /// React 리스너가 붙기 전에 이벤트가 나가면 유실되므로, 지연 후 여러 번 전달
  Future<void> _injectFcmTokenToWeb() async {
    final t = await FcmService.getToken();
    if (t == null || !mounted) return;
    debugPrint('[FCM] 📤 FCM 토큰을 웹에 전달함 → 웹에서 /api/driver/fcm-token 호출 예정');
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
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16),
              ),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 1. WebView: 항상 최하단, initState에서 한 번만 생성된 컨트롤러 사용
            WebViewWidget(
              key: const Key('driver_webview'),
              controller: _controller,
            ),
            // 2. 로딩/에러 시에만 위에 오버레이
            if (_error != null)
              _buildErrorOverlay()
            else if (_isLoading)
              _buildLoadingOverlay(),
          ],
        ),
      ),
    );
  }
}

/// 내 기기 FCM 토큰을 권한 요청 후 가져와 콘솔에 출력 (디버그/복사용)
Future<void> getMyDeviceToken() async {
  try {
    NotificationSettings settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      String? token = await FirebaseMessaging.instance.getToken();
      debugPrint('------- 내 기기 FCM 토큰 -------');
      debugPrint(token ?? '');
      debugPrint('------------------------------');
    } else {
      debugPrint('사용자가 알림 권한을 거절했습니다.');
    }
  } catch (e, _) {
    debugPrint('getMyDeviceToken 오류: $e');
    addScreenError('getMyDeviceToken: $e');
  }
}
