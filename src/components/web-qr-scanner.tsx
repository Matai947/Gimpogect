import { Ionicons } from '@expo/vector-icons';
import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useI18n } from '@/store/app-context';

/**
 * Browser QR scanner: getUserMedia + jsQR on a canvas. Works in Safari and Chrome,
 * unlike the BarcodeDetector API that expo-camera relies on for web.
 */
export function WebQrScanner({ onScan, paused, permissionText, allowText, accent, barcodes }: { onScan: (data: string) => void; paused: boolean; permissionText: string; allowText: string; accent: string; barcodes?: boolean }) {
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
  // Phones with two or three back cameras: the browser may open a depth or macro lens that cannot focus on a QR.
  // The desk can switch through them; the choice is remembered on this phone.
  const [cams, setCams] = useState<string[]>([]);
  const [camId, setCamId] = useState<string | null>(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('scan-cam') : null;
    } catch {
      return null;
    }
  });
  // the lens the browser opened by itself, before any switch
  const [openedId, setOpenedId] = useState('');
  const curId = camId ?? openedId;
  const nextCam = () => {
    if (cams.length < 2) return;
    const id = cams[(cams.indexOf(curId) + 1) % cams.length];
    try {
      localStorage.setItem('scan-cam', id);
    } catch {
      // private mode: the switch still works until the page is closed
    }
    setCamId(id);
  };

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

    type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    const Native = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    let detector: Detector | null = null;
    try {
      detector = Native && !barcodes ? new Native({ formats: ['qr_code'] }) : null;
    } catch {
      detector = null;
    }
    // Product barcodes: the browser's own detector rarely knows them (never on iPhone), so the polyfill (zxing) reads them everywhere.
    if (barcodes)
      import('barcode-detector/ponyfill')
        .then(({ BarcodeDetector }) => {
          if (!cancelled) detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'] }) as unknown as Detector;
        })
        .catch(() => setStatus('unsupported'));
    let busy = false;
    let busySince = 0;
    let frame = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      // Safari sometimes pauses the picture (after a re-layout, a tab switch): start it again instead of showing a frozen frame
      if (video && video.paused && video.srcObject) void video.play().catch(() => {});
      // the browser's own detector can hang on a frame and never answer: after 2 s it is dropped and jsQR reads instead
      if (busy && Date.now() - busySince > 2000) {
        busy = false;
        if (!barcodes) detector = null;
      }
      if (!video || !ctx || video.readyState < 2 || pausedRef.current || busy) return;
      // The browser's own QR detector (cheap Androids) can answer "nothing" on every frame without failing:
      // jsQR reads every other turn too, so the code is found either way.
      const turn = frame++ % 4;
      if (detector && (barcodes || turn < 2)) {
        busy = true;
        busySince = Date.now();
        detector
          .detect(video)
          .then((codes) => codes[0]?.rawValue && onScanRef.current(codes[0].rawValue))
          .catch(() => {
            if (!barcodes) detector = null; // a QR detector that fails once is not trusted again: jsQR takes over
          })
          .finally(() => (busy = false));
        return;
      }
      if (barcodes) return; // the barcode reader is still loading
      // jsQR: every other frame, alternating the whole picture (scaled) and its centre at full resolution.
      if (turn % 2) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      const centre = frame % 4 === 1;
      const side = Math.min(w, h);
      const crop = centre ? Math.round(side * 0.7) : side;
      const sx = Math.round((w - crop) / 2);
      const sy = Math.round((h - crop) / 2);
      const out = Math.min(crop, 720);
      canvas.width = out;
      canvas.height = out;
      ctx.drawImage(video, sx, sy, crop, crop, 0, 0, out, out);
      const img = ctx.getImageData(0, 0, out, out);
      const code = jsQR(img.data, out, out, { inversionAttempts: 'dontInvert' });
      if (code?.data) onScanRef.current(code.data);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { ...(camId ? { deviceId: { exact: camId } } : { facingMode: { ideal: 'environment' } }), width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stream = s;
        // keep refocusing (budget phones start at a fixed focus far away)
        s.getVideoTracks().forEach((tr) => void tr.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {}));
        // the back cameras, once the permission has given them names
        void navigator.mediaDevices.enumerateDevices().then((list) => {
          if (cancelled) return;
          const vids = list.filter((d) => d.kind === 'videoinput');
          const back = vids.filter((d) => !/front|user|передн|фронт/i.test(d.label));
          setCams((back.length ? back : vids).map((d) => d.deviceId).filter(Boolean));
          setOpenedId(s.getVideoTracks()[0]?.getSettings().deviceId ?? '');
        });
        // the camera was taken away (another app, the phone locked): open it again by itself
        s.getVideoTracks().forEach((tr) => tr.addEventListener('ended', () => !cancelled && setAttempt((a) => a + 1)));
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          video.setAttribute('playsinline', 'true');
          void video.play();
        }
        setStatus('running');
        raf = requestAnimationFrame(tick);
      })
      .catch((e: { name?: string }) => {
        // a remembered camera that is gone (another phone, unplugged): forget it and open the default one
        if (camId && (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError')) {
          try {
            localStorage.removeItem('scan-cam');
          } catch {}
          setCamId(null);
          return;
        }
        setStatus(e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'nocamera' : e?.name === 'NotReadableError' ? 'busy' : 'denied');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [attempt, barcodes, camId]);

  if (status !== 'idle' && status !== 'running') {
    const why = status === 'unsupported' ? t('scan_unsupported') : status === 'nocamera' ? t('scan_no_cam_device') : status === 'busy' ? t('scan_busy') : t('scan_denied_how');
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
  return (
    <>
      <video ref={videoRef} muted autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      {cams.length > 1 ? (
        <Pressable onPress={nextCam} style={styles.switch} accessibilityLabel={t('scan_switch_cam')}>
          <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
          <T type="small" color="#FFFFFF" style={{ fontWeight: '700' }}>
            {cams.indexOf(curId) + 1}/{cams.length}
          </T>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  switch: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.three },
});
