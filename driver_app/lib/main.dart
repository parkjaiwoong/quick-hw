import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'app_config.dart';
import 'app_version_service.dart';
import 'fcm_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // 백그라운드 메시지 핸들러는 반드시 main() 최상위에서 등록 (클래스/메서드 안이면 안 됨)
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await FcmService.initialize();
  await getMyDeviceToken();
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
      home: const DriverWebViewPage(),
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
    _checkAppVersion();
    _controller = _createController();
  }

  WebViewController _createController() {
    final c = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() { _isLoading = true; _error = null; });
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
            _injectFcmTokenToWeb();
          },
          onWebResourceError: (e) {
            if (mounted) setState(() {
              _isLoading = false;
              _error = e.description ?? '로드 실패';
            });
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
      print("------- 내 기기 FCM 토큰 -------");
      print(token);
      print("------------------------------");
    } else {
      print('사용자가 알림 권한을 거절했습니다.');
    }
  } catch (e, st) {
    print('getMyDeviceToken 오류: $e');
    print(st);
  }
}
