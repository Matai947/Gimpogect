import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebQrScanner } from '@/components/web-qr-scanner';
import { Button, T } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useI18n } from '@/store/app-context';

/** A product barcode (EAN-13, EAN-8, UPC, Code-128): digits and letters only, so a misread or a QR never becomes a code. */
export const cleanBarcode = (raw: string) => {
  const s = raw.trim();
  return /^[0-9A-Za-z-]{4,32}$/.test(s) ? s : '';
};

/** Full-screen camera that reads product barcodes one after another until closed; `onCode` answers what was added (or a reason it was not). */
export function BarcodeSheet({ visible, onClose, onCode, accent }: { visible: boolean; onClose: () => void; onCode: (code: string) => { ok: boolean; text: string } | void; accent: string }) {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const web = Platform.OS === 'web';

  // the camera reads the same label many times a second: one code counts once, and again only after 2.5 s or another code
  const last = useRef({ code: '', ts: 0 });
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [count, setCount] = useState(0);
  // closing clears the sheet, so the next opening starts fresh
  const close = () => {
    last.current = { code: '', ts: 0 };
    setNote(null);
    setCount(0);
    onClose();
  };
  const got = (raw: string) => {
    const code = cleanBarcode(raw);
    if (!code) return;
    const now = Date.now();
    if (code === last.current.code && now - last.current.ts < 2500) return;
    last.current = { code, ts: now };
    const r = onCode(code);
    Haptics.notificationAsync(r && !r.ok ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (r) setNote(r);
    if (!r || r.ok) setCount((n) => n + 1);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.root}>
        <View style={styles.head}>
          <T type="subheading" color="#FFFFFF">
            {t('bc_title')}
          </T>
          <Pressable onPress={close} hitSlop={10} style={styles.close} accessibilityLabel={t('cancel')}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.camera}>
          {visible ? (
            web ? (
              <WebQrScanner barcodes onScan={got} paused={false} permissionText={t('scan_permission')} allowText={t('scan_allow')} accent={accent} />
            ) : permission?.granted ? (
              <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14'] }} onBarcodeScanned={(r) => got(r.data)} />
            ) : (
              <View style={styles.center}>
                <T type="small" color="#FFFFFF" style={{ textAlign: 'center' }}>
                  {t('scan_permission')}
                </T>
                <Button title={t('scan_allow')} size="sm" onPress={() => void requestPermission()} style={{ backgroundColor: accent }} />
              </View>
            )
          ) : null}
          {/* a wide, low window: barcodes are long */}
          <View pointerEvents="none" style={styles.window} />
        </View>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          {note ? (
            <View style={[styles.note, { borderColor: note.ok ? accent : '#D63B47' }]}>
              <Ionicons name={note.ok ? 'checkmark-circle' : 'alert-circle'} size={20} color={note.ok ? accent : '#D63B47'} />
              <T type="body" color="#FFFFFF" style={{ flex: 1, fontWeight: '700' }} numberOfLines={2}>
                {note.text}
              </T>
            </View>
          ) : (
            <T type="small" color="rgba(255,255,255,0.75)" style={{ textAlign: 'center' }}>
              {t('bc_hint')}
            </T>
          )}
          <Button title={count ? t('bc_done', { n: count }) : t('cancel')} onPress={close} style={{ backgroundColor: accent }} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  camera: { flex: 1, overflow: 'hidden', backgroundColor: '#111111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.three },
  note: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.08)' },
  window: { position: 'absolute', left: '8%', right: '8%', top: '38%', height: '24%', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', borderRadius: Radius.md },
});
