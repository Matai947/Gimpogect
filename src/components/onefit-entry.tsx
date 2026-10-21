import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { StaffAccent } from '@/components/member-result';
import { WebQrScanner } from '@/components/web-qr-scanner';
import { Button, Card, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { onefitRemote } from '@/lib/api';
import { useApp, useCanManage, useI18n } from '@/store/app-context';

/** Front desk: let in a 1Fit member without an account. Only a name (and a phone, if they give it) is needed. */
export function OneFitEntry() {
  const { staff, staffCode, content, saveContent } = useApp();
  const canManage = useCanManage();
  const { width } = useWindowDimensions();
  const clubId = staff?.clubId ?? 'c1';
  const qr = content.onefit?.[clubId];
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  // The manager scans the 1Fit stand of this club once; every desk of the club then shows the same code.
  const setQr = (raw: string) => {
    const v = raw.trim();
    if (!v || v.length > 300 || /[<>"'`\s]/.test(v)) return;
    setScanning(false);
    saveContent('onefit', { ...(content.onefit ?? {}), [clubId]: v });
  };
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; duplicate: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

  const phoneDigits = phone.replace(/\D/g, '');
  const ready = name.trim().length >= 2 || phoneDigits.length >= 10;

  const submit = async () => {
    if (!staffCode || busy) return;
    setBusy(true);
    setFailed(false);
    const r = await onefitRemote(staffCode, { name: name.trim(), phone, clubId });
    setBusy(false);
    if (!r) {
      setFailed(true);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDone({ name: r.name, duplicate: !!r.duplicate });
    setName('');
    setPhone('');
  };

  if (!open) {
    return (
      <Button title={t('onefit_open')} icon="barbell-outline" variant="secondary" onPress={() => { setOpen(true); setDone(null); }} />
    );
  }

  const wide = width >= 640;
  const form = (
    <View style={{ flex: 1, gap: Spacing.two }}>
      <TextInput value={name} onChangeText={setName} placeholder={t('onefit_name')} placeholderTextColor={Colors.textMuted} autoCapitalize="words" style={styles.input} />
      <TextInput value={phone} onChangeText={setPhone} placeholder="+7 7__ ___ __ __" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" style={styles.input} />
      {failed ? (
        <T type="small" color={Colors.danger}>
          {t('onefit_failed')}
        </T>
      ) : null}
      {done ? (
        <View style={[styles.done, done.duplicate && { backgroundColor: 'rgba(240,160,60,0.14)' }]}>
          <Ionicons name={done.duplicate ? 'alert-circle' : 'checkmark-done'} size={18} color={done.duplicate ? Colors.warning : Colors.success} />
          <T type="small" style={{ flex: 1, fontWeight: '700' }} color={done.duplicate ? Colors.warning : Colors.success}>
            {t(done.duplicate ? 'onefit_dup' : 'onefit_ok', { name: done.name })}
          </T>
        </View>
      ) : null}
      <Button title={t('onefit_go')} icon="log-in-outline" onPress={() => void submit()} disabled={!ready || busy} style={{ backgroundColor: StaffAccent }} />
    </View>
  );
  const qrBox = qr ? (
    <View style={styles.qrBox}>
      <QRCode value={qr} size={wide ? 170 : 200} quietZone={8} backgroundColor="#FFFFFF" color="#000000" />
      <T type="small" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 200 }}>
        {t('onefit_qr_hint')}
      </T>
      {canManage ? (
        <T type="small" color={StaffAccent} style={{ fontWeight: '700' }} onPress={() => setScanning(true)}>
          {t('onefit_qr_change')}
        </T>
      ) : null}
    </View>
  ) : canManage ? (
    <View style={[styles.qrBox, { justifyContent: 'center' }]}>
      <Ionicons name="qr-code-outline" size={40} color={Colors.textMuted} />
      <T type="small" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 200 }}>
        {t('onefit_qr_none')}
      </T>
      <Button title={t('onefit_qr_scan')} icon="scan-outline" size="sm" onPress={() => setScanning(true)} style={{ backgroundColor: StaffAccent }} />
    </View>
  ) : null;

  return (
    <Card style={{ gap: Spacing.two }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T type="subheading">{t('onefit_title')}</T>
        <Ionicons name="close" size={22} color={Colors.textSecondary} onPress={() => setOpen(false)} />
      </Row>
      <T type="small" color={Colors.textSecondary}>
        {t('onefit_hint')}
      </T>
      {wide ? (
        <Row gap={Spacing.three} style={{ alignItems: 'flex-start' }}>
          {form}
          {qrBox}
        </Row>
      ) : (
        <>
          {qrBox}
          {form}
        </>
      )}
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scanRoot}>
          <Row style={{ justifyContent: 'space-between', padding: Spacing.three }}>
            <T type="subheading" color="#FFFFFF">
              {t('onefit_qr_scan_title')}
            </T>
            <Ionicons name="close" size={26} color="#FFFFFF" onPress={() => setScanning(false)} />
          </Row>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            {scanning ? (
              Platform.OS === 'web' ? (
                <WebQrScanner onScan={setQr} paused={false} permissionText={t('scan_permission')} allowText={t('scan_allow')} accent={StaffAccent} />
              ) : permission?.granted ? (
                <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(r) => setQr(r.data)} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Button title={t('scan_allow')} size="sm" onPress={() => void requestPermission()} style={{ backgroundColor: StaffAccent }} />
                </View>
              )
            ) : null}
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.three, fontSize: 16, color: Colors.text },
  qrBox: { alignItems: 'center', gap: 6, padding: Spacing.two, borderRadius: Radius.md, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, minWidth: 200 },
  scanRoot: { flex: 1, backgroundColor: '#000000' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(76,195,138,0.12)' },
});
