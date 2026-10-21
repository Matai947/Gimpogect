import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
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

/** Full-screen camera that reads one product barcode, then closes. */
export function BarcodeSheet({ visible, onClose, onCode, accent }: { visible: boolean; onClose: () => void; onCode: (code: string) => void; accent: string }) {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const web = Platform.OS === 'web';

  const got = (raw: string) => {
    const code = cleanBarcode(raw);
    if (!code) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onCode(code);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.head}>
          <T type="subheading" color="#FFFFFF">
            {t('bc_title')}
          </T>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t('cancel')}>
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
        <T type="small" color="rgba(255,255,255,0.75)" style={{ textAlign: 'center', padding: Spacing.three }}>
          {t('bc_hint')}
        </T>
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
  window: { position: 'absolute', left: '8%', right: '8%', top: '38%', height: '24%', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', borderRadius: Radius.md },
});
