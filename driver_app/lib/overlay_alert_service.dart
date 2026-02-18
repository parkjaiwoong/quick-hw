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

  /// 배차 알림음 재생. assets/sounds/dispatch_alert.mp3 (파일 없으면 무시).
  /// 오버레이가 표시될 때 한 번 호출 (백그라운드/포그라운드 모두).
  static Future<void> playDispatchSound() async {
    try {
      final player = AudioPlayer();
      await player.setReleaseMode(ReleaseMode.release);
      await player.play(AssetSource('sounds/dispatch_alert.mp3'));
    } catch (e) {
      if (kDebugMode) debugPrint('[OverlayAlert] 알림음 재생 오류: $e');
    }
  }
}
