import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { AppointmentsEditor } from '@/components/admin/appointments-editor';
import { StaffHeader } from '@/components/staff-header';
import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, clubById, formatDateHuman, toISODate, trainerById, trainers } from '@/data/mock';
import { deleteLoad, fetchLoads, postLoad, type TrainerLoad } from '@/lib/api';
import { useCanManage, useApp, useI18n } from '@/store/app-context';

/** The trainers' schedule is not in the system, so the administrator records how many sessions each trainer worked. */
export default function StaffTrainerLoadScreen() {
  const { staff, staffCode } = useApp();
  const { t } = useI18n();
  const [trainerId, setTrainerId] = useState(trainers[0]?.id ?? '');
  const [back, setBack] = useState(0); // 0 = today, 1 = yesterday, ...
  const [sessions, setSessions] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<'ok' | 'fail' | null>(null);
  const [rows, setRows] = useState<TrainerLoad[]>([]);
  const canManage = useCanManage();

  const load = useCallback(async () => {
    if (!staffCode) return;
    const r = await fetchLoads(staffCode, 30);
    if (r) setRows(r);
  }, [staffCode]);

  useEffect(() => {
    let live = true;
    if (staffCode) fetchLoads(staffCode, 30).then((r) => live && r && setRows(r));
    return () => {
      live = false;
    };
  }, [staffCode]);

  const date = toISODate(addDays(new Date(), -back));

  const save = async () => {
    if (!staffCode || busy) return;
    setBusy(true);
    setMsg(null);
    const ok = await postLoad(staffCode, { trainerId, clubId: staff?.clubId ?? 'c1', date, sessions, note: note.trim(), staff: staff?.name ?? '' });
    setBusy(false);
    setMsg(ok ? 'ok' : 'fail');
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSessions(1);
      setNote('');
      void load();
    }
  };

  const remove = async (id: string) => {
    if (staffCode && (await deleteLoad(staffCode, id))) void load();
  };

  return (
    <View style={styles.root}>
      <StaffHeader title={t('staff_tab_trainers')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <T type="subheading">{t('tl_title')}</T>
        <T type="caption">{t('tl_hint')}</T>

        {!canManage ? (
          <T type="small" color={Colors.textMuted}>
            {t('manager_only')}
          </T>
        ) : null}
        {canManage ? <View style={styles.card}>
          <T type="label" color={Colors.textSecondary}>
            {t('tl_trainer')}
          </T>
          <ChipRow>
            {trainers.map((tr) => (
              <Chip key={tr.id} label={tr.name.split(' ').slice(0, 2).join(' ')} active={trainerId === tr.id} onPress={() => setTrainerId(tr.id)} />
            ))}
          </ChipRow>

          <T type="label" color={Colors.textSecondary}>
            {t('tl_date')}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map((d) => (
              <Chip key={d} label={formatDateHuman(toISODate(addDays(new Date(), -d)))} active={back === d} onPress={() => setBack(d)} />
            ))}
          </Row>

          <T type="label" color={Colors.textSecondary}>
            {t('tl_sessions')}
          </T>
          <Row gap={Spacing.three} style={{ alignItems: 'center' }}>
            <Pressable onPress={() => setSessions((n) => Math.max(1, n - 1))} style={styles.step} hitSlop={6}>
              <Ionicons name="remove" size={22} color={Colors.text} />
            </Pressable>
            <T type="display" style={{ fontSize: 34, lineHeight: 40, minWidth: 48, textAlign: 'center' }}>
              {sessions}
            </T>
            <Pressable onPress={() => setSessions((n) => Math.min(30, n + 1))} style={styles.step} hitSlop={6}>
              <Ionicons name="add" size={22} color={Colors.text} />
            </Pressable>
          </Row>

          <TextInput value={note} onChangeText={setNote} placeholder={t('tl_note_ph')} placeholderTextColor={Colors.textMuted} style={styles.input} />

          {msg === 'ok' ? (
            <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>
              {t('tl_saved')}
            </T>
          ) : null}
          {msg === 'fail' ? (
            <T type="small" color={Colors.danger}>
              {t('tl_failed')}
            </T>
          ) : null}
          <Button title={t('tl_save')} icon="checkmark-circle-outline" onPress={() => void save()} disabled={busy} style={{ backgroundColor: StaffAccent }} />
        </View> : null}

        {canManage ? <View style={styles.card}>
          <T type="subheading">{t('appt_title')}</T>
          <AppointmentsEditor accent={StaffAccent} />
        </View> : null}

        <T type="subheading">{t('tl_recent')}</T>
        {rows.length === 0 ? (
          <T type="small" color={Colors.textMuted}>
            {t('tl_none')}
          </T>
        ) : null}
        {rows.slice(0, 25).map((r) => (
          <Row key={r.id} gap={Spacing.two} style={styles.row}>
            <View style={{ flex: 1 }}>
              <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                {trainerById(r.trainerId)?.name ?? r.trainerId}
              </T>
              <T type="small" color={Colors.textMuted} numberOfLines={1}>
                {formatDateHuman(r.date)} • {clubById(r.clubId)?.name.replace('Seven Gym ', '')}
                {r.note ? ` • ${r.note}` : ''}
              </T>
            </View>
            <T type="subheading" color={StaffAccent}>
              {r.sessions}
            </T>
            <Ionicons name="trash-outline" size={20} color={Colors.textMuted} onPress={() => void remove(r.id)} />
          </Row>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  step: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt },
  input: { height: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.three, fontSize: 15, color: Colors.text },
  row: { alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
