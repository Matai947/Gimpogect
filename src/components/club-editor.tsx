import { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';

import { OwnerAccent } from '@/components/owner-header';
import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { allClubs, currentClubConfig, type ClubConfig } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

/** Owner: add a branch, edit one, switch one off. The network stays managed from one place. */
export function ClubEditor() {
  const { saveClubConfig } = useApp();
  const { t } = useI18n();
  const [form, setForm] = useState<ClubConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<'ok' | 'fail' | null>(null);

  const nextId = () => `c${Math.max(0, ...allClubs.map((c) => Number(c.id.slice(1)) || 0)) + 1}`;
  const set = (patch: Partial<ClubConfig>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!form || busy) return;
    setBusy(true);
    setMsg(null);
    const rest = currentClubConfig().filter((c) => c.id !== form.id);
    const list = [...rest, form].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    const ok = await saveClubConfig(list);
    setBusy(false);
    setMsg(ok ? 'ok' : 'fail');
    if (ok) setForm(null);
  };

  return (
    <View style={styles.card}>
      <T type="subheading">{t('ce_title')}</T>
      <T type="small" color={Colors.textSecondary}>
        {t('ce_hint')}
      </T>

      {allClubs.map((c) => (
        <Row key={c.id} gap={Spacing.two} style={styles.row}>
          <View style={{ flex: 1 }}>
            <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
              {c.name}
              {c.active === false ? ` • ${t('ce_off')}` : ''}
            </T>
            <T type="small" color={Colors.textMuted} numberOfLines={1}>
              {c.address}
            </T>
          </View>
          <T type="small" color={OwnerAccent} style={{ fontWeight: '700' }} onPress={() => { setMsg(null); setForm({ id: c.id, name: c.name, city: c.city, address: c.address, hours: c.hours, phone: c.phone, active: c.active !== false }); }}>
            {t('ce_edit')}
          </T>
        </Row>
      ))}

      {msg === 'ok' && !form ? (
        <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>
          {t('ce_saved')}
        </T>
      ) : null}

      {form ? (
        <View style={{ gap: Spacing.two }}>
          <TextInput value={form.name} onChangeText={(v) => set({ name: v })} placeholder={t('ce_name')} placeholderTextColor={Colors.textMuted} style={styles.input} />
          <TextInput value={form.city} onChangeText={(v) => set({ city: v })} placeholder={t('ce_city')} placeholderTextColor={Colors.textMuted} style={styles.input} />
          <TextInput value={form.address} onChangeText={(v) => set({ address: v })} placeholder={t('ce_address')} placeholderTextColor={Colors.textMuted} style={styles.input} />
          <TextInput value={form.hours} onChangeText={(v) => set({ hours: v })} placeholder={t('ce_hours')} placeholderTextColor={Colors.textMuted} style={styles.input} />
          <TextInput value={form.phone} onChangeText={(v) => set({ phone: v })} placeholder={t('ce_phone')} placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" style={styles.input} />
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T type="body">{t('ce_active')}</T>
            <Switch value={form.active} onValueChange={(v) => set({ active: v })} trackColor={{ true: OwnerAccent }} />
          </Row>
          {msg === 'fail' ? (
            <T type="small" color={Colors.danger}>
              {t('ce_failed')}
            </T>
          ) : null}
          <Row gap={Spacing.two}>
            <Button title={t('cancel')} variant="secondary" onPress={() => setForm(null)} style={{ flex: 1 }} />
            <Button title={t('ce_save')} icon="checkmark" onPress={() => void save()} disabled={busy || form.name.trim().length < 2} style={{ flex: 1, backgroundColor: OwnerAccent }} />
          </Row>
        </View>
      ) : (
        <Button title={t('ce_add')} icon="add-circle-outline" variant="secondary" onPress={() => { setMsg(null); setForm({ id: nextId(), name: 'Seven Gym ', city: 'Алматы', address: '', hours: '07:00 – 23:00', phone: '', active: true }); }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  row: { alignItems: 'center', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  input: { height: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.three, fontSize: 15, color: Colors.text },
});
