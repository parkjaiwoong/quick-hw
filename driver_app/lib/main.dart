import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'app_config.dart';
import 'fcm_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FcmService.initialize();
  runApp(const DriverApp());
}

class DriverApp extends StatelessWidget {
  const DriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '기사 앱',
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
                    Text('기사 페이지 불러오는 중...'),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
