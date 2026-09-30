import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MemberResult, StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { mockOrders } from '@/data/members';
import { useApp, useI18n, useMembers, type MemberInfo } from '@/store/app-context';

type Result = { kind: 'member'; member: MemberInfo } | { kind: 'order'; id: string } | { kind: 'unknown' } | { kind: 'notfound'; q: string };

export default function StaffScanScreen() {
  const { t } = useI18n();
  const { user, orders } = useApp();
  const { byId, list } = useMembers();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState('');
  const [paused, setPaused] = useState(false);
  const canCamera = Platform.OS !== 'web';

  const resolve = useCallback(
    (raw: string): Result => {
      const text = raw.trim();
      // 1) Our own QR payloads
      try {
        const obj = JSON.parse(text) as { t?: string; uid?: string; id?: string };
        if (obj.t === 'order' && obj.id) return orders.some((o) => o.id === obj.id) || mockOrders.some((o) => o.id === obj.id) ? { kind: 'order', id: obj.id } : { kind: 'notfound', q: obj.id };
        if (obj.uid) {
          const m = byId(obj.uid);
          return m ? { kind: 'member', member: m } : { kind: 'notfound', q: obj.uid };
        }
      } catch {
        // not JSON: fall through to manual formats
      }
      // 2) Order number typed by hand
      if (/^GP-\d+$/i.test(text)) {
        const id = text.toUpperCase();
        return orders.some((o) => o.id === id) || mockOrders.some((o) => o.id === id) ? { kind: 'order', id } : { kind: 'notfound', q: id };
      }
      // 3) Member id or phone digits
      const digits = text.replace(/\D/g, '');
      const byUid = byId(text) ?? (digits.length >= 9 ? list.find((m) => m.id.endsWith(digits.slice(-9)) || m.phone.replace(/\D/g, '').endsWith(digits.slice(-9))) : undefined);
      if (byUid) return { kind: 'member', member: byUid };
      // 4) Name search
      const byName = text.length >= 3 ? list.find((m) => m.name.toLowerCase().includes(text.toLowerCase())) : undefined;
      if (byName) return { kind: 'member', member: byName };
      return text ? { kind: 'notfound', q: text } : { kind: 'unknown' };
    },
    [orders, byId, list]
  );

  const handle = (raw: string) => {
    const r = resolve(raw);
    setResult(r);
    setPaused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (r.kind === 'order') router.push({ pathname: '/staff/orders', params: { focus: r.id } });
  };

  const onScan = (res: BarcodeScanningResult) => {
    if (paused) return;
    handle(res.data);
  };

  const reset = () => {
    setResult(null);
    setPaused(false);
    setManual('');
  };

  return (
    <View style={styles.root}>
      <StaffHeader title={t('staff_tab_scan')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Camera */}
        <View style={styles.cameraWrap}>
          {canCamera && permission?.granted ? (
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={paused ? undefined : onScan} />
          ) : (
            <View style={styles.noCamera}>
              <Ionicons name={canCamera ? 'camera-outline' : 'desktop-outline'} size={34} color={Colors.textMuted} />
              <T type="small" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 260 }}>
                {canCamera ? t('scan_permission') : t('scan_no_camera')}
              </T>
              {canCamera ? <Button title={t('scan_allow')} size="sm" onPress={() => void requestPermission()} style={{ backgroundColor: StaffAccent }} /> : null}
            </View>
          )}
          {/* Viewfinder corners */}
          <View pointerEvents="none" style={styles.frame}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c]]} />
            ))}
          </View>
          {paused ? (
            <Pressable onPress={reset} style={styles.resume}>
              <Ionicons name="refresh" size={16} color={Colors.onAccent} />
              <T type="small" color={Colors.onAccent} style={{ fontWeight: '800' }}>
                {t('scan_again')}
              </T>
            </Pressable>
          ) : null}
        </View>
        <T type="small" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
          {t('scan_hint')}
        </T>

        {/* Manual entry */}
        <View style={styles.manual}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput value={manual} onChangeText={setManual} placeholder={t('scan_manual_ph')} placeholderTextColor={Colors.textMuted} style={styles.manualInput} onSubmitEditing={() => handle(manual)} returnKeyType="search" />
          <Pressable onPress={() => handle(manual)} disabled={!manual.trim()} style={[styles.findBtn, !manual.trim() && { opacity: 0.4 }]}>
            <T type="small" color={Colors.onAccent} style={{ fontWeight: '800' }}>
              {t('scan_find')}
            </T>
          </Pressable>
        </View>
        {user ? (
          <Pressable onPress={() => handle(JSON.stringify({ v: 1, t: 'member', uid: user.id }))} hitSlop={8} style={{ alignSelf: 'center' }}>
            <Row gap={6}>
              <Ionicons name="qr-code-outline" size={14} color={StaffAccent} />
              <T type="small" color={StaffAccent} style={{ fontWeight: '700' }}>
                {t('scan_demo_self')}
              </T>
            </Row>
          </Pressable>
        ) : null}

        {/* Result */}
        {result?.kind === 'member' ? <MemberResult member={result.member} onDone={reset} /> : null}
        {result?.kind === 'notfound' ? (
          <View style={styles.notice}>
            <Ionicons name="person-remove-outline" size={22} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <T type="subheading">{t('scan_not_found')}</T>
              <T type="small" color={Colors.textSecondary}>
                {result.q}
              </T>
            </View>
          </View>
        ) : null}
        {result?.kind === 'unknown' ? (
          <View style={styles.notice}>
            <Ionicons name="help-circle-outline" size={22} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <T type="subheading">{t('scan_unknown')}</T>
              <T type="small" color={Colors.textSecondary}>
                {t('scan_unknown_sub')}
              </T>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  cameraWrap: { height: 280, borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#05090C', borderWidth: 1, borderColor: 'rgba(51,201,220,0.35)' },
  noCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.three },
  frame: { position: 'absolute', left: 40, right: 40, top: 40, bottom: 40 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: StaffAccent },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  resume: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: Radius.pill, backgroundColor: StaffAccent },
  manual: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingLeft: Spacing.three, paddingRight: 6, height: 52 },
  manualInput: { flex: 1, color: Colors.text, fontSize: 15 },
  findBtn: { paddingHorizontal: 14, height: 38, borderRadius: Radius.sm, backgroundColor: StaffAccent, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(255,179,71,0.4)' },
});
