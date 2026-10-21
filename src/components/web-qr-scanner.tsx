import { Ionicons } from '@expo/vector-icons';
import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useI18n } from '@/store/app-context';

/**
 * Browser QR scanner: getUserMedia + jsQR on a canvas. Works in Safari and Chrome,
 * unlike the BarcodeDetector API that expo-camera relies on for web.
 */
export function WebQrScanner({ onScan, paused, permissionText, allowText, accent }: { onScan: (data: string) => void; paused: boolean; permissionText: string; allowText: string; accent: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  useEffect(() => {
    onScanRef.current = onScan;
    pausedRef.current = paused;
  });
  const { t } = useI18n();
  // Why the camera is not running: no camera API in this viewer (an in-app browser, http), the person refused, no camera on the device, or it is busy.
  const [status, setStatus] = useState<'idle' | 'running' | 'denied' | 'unsupported' | 'nocamera' | 'busy'>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const id = setTimeout(() => setStatus('unsupported'), 0);
      return () => clearTimeout(id);
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (video && ctx && video.readyState >= 2 && !pausedRef.current) {
        // ponytail: decode at half resolution every frame; good enough for a phone held at arm's length
        canvas.width = video.videoWidth / 2;
        canvas.height = video.videoHeight / 2;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) onScanRef.current(code.data);
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          video.setAttribute('playsinline', 'true');
          void video.play();
        }
        setStatus('running');
        raf = requestAnimationFrame(tick);
      })
      .catch((e: { name?: string }) => setStatus(e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'nocamera' : e?.name === 'NotReadableError' ? 'busy' : 'denied'));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [attempt]);

  if (status !== 'idle' && status !== 'running') {
    const why = status === 'unsupported' ? t('scan_unsupported') : status === 'nocamera' ? t('scan_no_camera') : status === 'busy' ? t('scan_busy') : t('scan_denied_how');
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={34} color={Colors.textMuted} />
        <T type="small" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
          {permissionText}
        </T>
        <T type="small" color={Colors.text} style={{ textAlign: 'center', maxWidth: 300, fontWeight: '600' }}>
          {why}
        </T>
        {status === 'unsupported' ? (
          <T type="small" color={Colors.textMuted} selectable style={{ textAlign: 'center' }}>
            {typeof location !== 'undefined' ? location.origin + '/staff' : ''}
          </T>
        ) : null}
        {status !== 'unsupported' && status !== 'nocamera' ? <Button title={allowText} size="sm" onPress={() => setAttempt((a) => a + 1)} style={{ backgroundColor: accent }} /> : null}
      </View>
    );
  }

  // Plain <video>: react-native-web renders host elements as-is.
  return <video ref={videoRef} muted autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.three },
});
