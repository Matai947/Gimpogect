import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { Button, Card, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { onefitRemote } from '@/lib/api';
import { useApp, useI18n } from '@/store/app-context';

/** Front desk: let in a 1Fit member without an account. Only a name (and a phone, if they give it) is needed. */
export function OneFitEntry() {
  const { staff, staffCode } = useApp();
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
    const r = await onefitRemote(staffCode, { name: name.trim(), phone, clubId: staff?.clubId ?? 'c1' });
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

  return (
    <Card style={{ gap: Spacing.two }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T type="subheading">{t('onefit_title')}</T>
        <Ionicons name="close" size={22} color={Colors.textSecondary} onPress={() => setOpen(false)} />
      </Row>
      <T type="small" color={Colors.textSecondary}>
        {t('onefit_hint')}
      </T>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.three, fontSize: 16, color: Colors.text },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(76,195,138,0.12)' },
});
