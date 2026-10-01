import { Ionicons } from '@expo/vector-icons';
import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';

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
  const [status, setStatus] = useState<'idle' | 'running' | 'denied'>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const id = setTimeout(() => setStatus('denied'), 0);
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
      .catch(() => setStatus('denied'));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [attempt]);

  if (status === 'denied') {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={34} color={Colors.textMuted} />
        <T type="small" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 260 }}>
          {permissionText}
        </T>
        <Button title={allowText} size="sm" onPress={() => setAttempt((a) => a + 1)} style={{ backgroundColor: accent }} />
      </View>
    );
  }

  // Plain <video>: react-native-web renders host elements as-is.
  return <video ref={videoRef} muted autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.three },
});
