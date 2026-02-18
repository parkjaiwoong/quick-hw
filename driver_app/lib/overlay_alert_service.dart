import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:vibration/vibration.dart';

/// 오버레이가 뜰 때 기사님께 알리기 위한 진동·알림음.
/// FCM/웹 채널에서 showOverlay 직전에 [triggerOverlayVibration] 호출,
/// 오버레이 위젯 첫 빌드 시 [playDispatchSound] 호출 (백그라운드에서도 재생되도록).
class OverlayAlertService {
  OverlayAlertService._();

  /// 강한 진동 (두 번 울림). showOverlay 호출 직전에 사용.
  static Future<void> triggerOverlayVibration() async {
    if (!Platform.isAndroid) return;
    try {
      final has = await Vibration.hasVibrator();
      if (has != true) return;
      await Vibration.vibrate(duration: 400);
      await Future<void>.delayed(const Duration(milliseconds: 200));
      await Vibration.vibrate(duration: 400);
    } catch (e) {
      if (kDebugMode) debugPrint('[OverlayAlert] 진동 오류: $e');
    }
  }

  static bool _soundErrorLogged = false;

  /// 배차 알림음 재생. 파일 없어도 예외를 모두 흡수해 오버레이는 무조건 뜨게 함.
  static Future<void> playDispatchSound() async {
    try {
      try {
        final player = AudioPlayer();
        await player.setReleaseMode(ReleaseMode.release);
        await player.play(AssetSource('sounds/dispatch_alert.mp3'));
      } catch (e) {
        if (kDebugMode && !_soundErrorLogged) {
          _soundErrorLogged = true;
          try {
            debugPrint('[OverlayAlert] 알림음 재생 오류(파일 없음 시 정상): $e — 진동만 사용됩니다.');
          } catch (_) {}
        }
      }
    } catch (_) {
      // 알림음 실패가 오버레이에 영향을 주지 않도록 모든 예외 흡수
    }
  }
}
