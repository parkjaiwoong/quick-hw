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
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() { _isLoading = true; _error = null; });
          },
          onPageFinished: (url) {
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
  Future<void> _injectFcmTokenToWeb() async {
    final t = await FcmService.getToken();
    if (t == null || !mounted) return;
    final escaped = t.replaceAll(r'\', r'\\').replaceAll("'", r"\'");
    try {
      await _controller.runJavaScript(
        "window.dispatchEvent(new CustomEvent('driverFcmToken', { detail: '$escaped' }));",
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            if (_error != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
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
              )
            else
              WebViewWidget(controller: _controller),
            if (_isLoading && _error == null)
              const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text('언넌 불러오는 중...'),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
