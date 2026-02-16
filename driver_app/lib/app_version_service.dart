import 'dart:convert';
import 'dart:io';

import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_config.dart';

/// 서버에 등록된 최신 앱 버전과 비교해 업데이트 안내.
class AppVersionService {
  /// [driverWebUrl]의 origin + /api/driver/app-version 호출.
  /// 최신 버전이 현재보다 크면 업데이트 안내용 결과 반환.
  static Future<AppVersionResult?> checkUpdate() async {
    try {
      final baseUri = Uri.parse(driverWebUrl);
      final origin = baseUri.origin;
      final uri = Uri.parse('$origin/api/driver/app-version');
      final res = await _fetch(uri);
      if (res == null) return null;
      final data = res as Map<String, dynamic>;
      final latest = data['latestVersion'] as String?;
      final minVer = data['minVersion'] as String?;
      final downloadUrl = data['downloadUrl'] as String?;
      if (latest == null && minVer == null) return null;

      final info = await PackageInfo.fromPlatform();
      final current = info.version;

      final needUpdate = minVer != null && _compareVersion(current, minVer) < 0;
      final hasNewer = latest != null && _compareVersion(current, latest) < 0;

      return AppVersionResult(
        currentVersion: current,
        latestVersion: latest ?? minVer,
        minVersion: minVer,
        downloadUrl: downloadUrl,
        mustUpdate: needUpdate,
        shouldUpdate: hasNewer || needUpdate,
      );
    } catch (_) {
      return null;
    }
  }

  static Future<dynamic> _fetch(Uri uri) async {
    final client = HttpClient();
    try {
      final request = await client.getUrl(uri);
      request.headers.set('Accept', 'application/json');
      final response = await request.close();
      if (response.statusCode != 200) return null;
      final body = await response.transform(utf8.decoder).join();
      return jsonDecode(body);
    } finally {
      client.close();
    }
  }

  /// [downloadUrl]을 브라우저/스토어로 열기
  static Future<void> openDownloadUrl(String? downloadUrl) async {
    if (downloadUrl == null || downloadUrl.isEmpty) return;
    final uri = Uri.tryParse(downloadUrl);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class AppVersionResult {
  final String currentVersion;
  final String? latestVersion;
  final String? minVersion;
  final String? downloadUrl;
  final bool mustUpdate;
  final bool shouldUpdate;

  AppVersionResult({
    required this.currentVersion,
    this.latestVersion,
    this.minVersion,
    this.downloadUrl,
    required this.mustUpdate,
    required this.shouldUpdate,
  });
}

/// 반환: a < b -> -1, a == b -> 0, a > b -> 1
int _compareVersion(String a, String b) {
  final aa = _parseVersion(a);
  final bb = _parseVersion(b);
  for (var i = 0; i < aa.length || i < bb.length; i++) {
    final va = i < aa.length ? aa[i] : 0;
    final vb = i < bb.length ? bb[i] : 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

List<int> _parseVersion(String s) {
  return s.split('.').map((e) => int.tryParse(e.trim()) ?? 0).toList();
}
