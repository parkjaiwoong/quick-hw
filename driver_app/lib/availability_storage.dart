import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 기사 '배송 가능' 상태를 네이티브에 저장/조회.
/// 웹뷰에서 토글 시 이 값이 갱신되고, FCM 백그라운드 핸들러에서 오버레이 노출 여부 결정에 사용.
const String _keyDriverIsAvailable = 'driver_is_available';

abstract class DriverAvailabilityStorage {
  /// 배송 가능 여부 저장 (웹뷰 토글 시 호출).
  static Future<void> save(bool isAvailable) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_keyDriverIsAvailable, isAvailable);
      if (kDebugMode) {
        debugPrint('[AvailabilityStorage] 저장: $isAvailable');
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[AvailabilityStorage] save error: $e');
    }
  }

  /// 배송 가능 여부 조회 (백그라운드 FCM 핸들러에서 오버레이 여부 결정 시 사용).
  /// 키가 없거나 읽기 실패 시 false(배송 불가)로 간주.
  static Future<bool> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_keyDriverIsAvailable) ?? false;
    } catch (e) {
      if (kDebugMode) debugPrint('[AvailabilityStorage] load error: $e');
      return false;
    }
  }
}
