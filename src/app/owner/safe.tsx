import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { clockTime } from '@/components/shift-bar';
import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatDateHuman, formatPrice, toISODate } from '@/data/mock';
import { fetchSafe, fetchWithdrawals, safeOp, type SafeEntry } from '@/lib/api';
import { useApp, useI18n } from '@/store/app-context';

// A withdrawal "to the safe" is stored with the label in the cashier's language.
const TO_SAFE = ['В сейф', 'Сейфке', 'To the safe'];
const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;

type Line = { ts: number; clubId: string; amount: number; title: string; who: string; out: boolean };

/** The owner's safe: what the desks put in (withdrawals "to the safe") and what the owner took out or added, per club. */
export default function OwnerSafe() {
  const { t } = useI18n();
  const { staffCode, accountant } = useApp();
  const [club, setClub] = useState(clubs[0]?.id ?? 'c1');
  const [lines, setLines] = useState<Line[] | null>(null);
  const [mode, setMode] = useState<'in' | 'out' | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const purposes = [t('safe_p1'), t('safe_p2'), t('safe_p3'), t('safe_p4')];

  const [tick, setTick] = useState(0);
  const load = () => setTick((n) => n + 1);
  useEffect(() => {
    let live = true;
    Promise.all([fetchWithdrawals(staffCode, 400), fetchSafe(staffCode)]).then(([wd, safe]) => {
      if (!live) return;
      if (!wd || !safe) return setMsg({ text: t('cash_fail'), bad: true });
      const fromDesks: Line[] = wd.filter((w) => TO_SAFE.includes(w.reason)).map((w) => ({ ts: w.ts, clubId: w.clubId ?? 'c1', amount: w.amount, title: t('safe_from_desk'), who: `${w.staff} → ${w.responsible}`, out: false }));
      const own: Line[] = safe.map((e: SafeEntry) => ({ ts: e.ts, clubId: e.clubId, amount: e.amount, title: e.note, who: e.staff, out: e.kind === 'out' }));
      setLines([...fromDesks, ...own].sort((x, y) => y.ts - x.ts));
    });
    return () => {
      live = false;
    };
  }, [staffCode, t, tick]);

  const mine = useMemo(() => (lines ?? []).filter((l) => l.clubId === club), [lines, club]);
  const balance = mine.reduce((n, l) => n + (l.out ? -l.amount : l.amount), 0);

  const save = async () => {
    if (!mode) return;
    if (mode === 'out' && digits(amount) > balance) return setMsg({ text: t('safe_too_much'), bad: true });
    setBusy(true);
    const ok = await safeOp(staffCode, { clubId: club, kind: mode, amount: digits(amount), note: note.trim() });
    setBusy(false);
    if (!ok) return setMsg({ text: t('cash_fail'), bad: true });
    setMsg({ text: mode === 'in' ? t('safe_in_done', { sum: formatPrice(digits(amount)) }) : t('safe_out_done', { sum: formatPrice(digits(amount)) }), bad: false });
    setMode(null);
    setAmount('');
    setNote('');
    load();
  };

  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_safe')} />
      <ChipRow>
        {clubs.map((c) => (
          <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={club === c.id} onPress={() => setClub(c.id)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="subheading">{t('safe_balance')}</T>
            <T type="small" color={Colors.textMuted} onPress={load}>
              {t('cash_refresh')}
            </T>
          </Row>
          <T type="display" color={OwnerAccent} style={{ fontSize: 34, lineHeight: 40 }}>
            {lines ? formatPrice(balance) : '…'}
          </T>
          <T type="small" color={Colors.textSecondary}>
            {t('safe_hint')}
          </T>
          {mode ? (
            <View style={{ gap: Spacing.two }}>
              <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} placeholder={t('cash_amount_ph')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={styles.input} />
              {mode === 'out' ? (
                <ChipRow>
                  {purposes.map((p) => (
                    <Chip key={p} label={p} active={note === p} onPress={() => setNote(p)} />
                  ))}
                </ChipRow>
              ) : null}
              <TextInput value={note} onChangeText={setNote} placeholder={mode === 'in' ? t('safe_in_ph') : t('safe_out_ph')} placeholderTextColor={Colors.textMuted} maxLength={80} style={styles.input} />
              <Row gap={Spacing.two}>
                <Button title={mode === 'in' ? t('safe_in') : t('safe_out')} onPress={() => void save()} disabled={busy || !digits(amount) || note.trim().length < 2} style={{ flex: 1 }} />
                <Button title={t('cancel')} variant="secondary" onPress={() => setMode(null)} />
              </Row>
            </View>
          ) : accountant ? null : (
            <Row gap={Spacing.two}>
              <Button title={t('safe_out')} icon="arrow-up-circle-outline" onPress={() => (setMode('out'), setNote(''), setMsg(null))} style={{ flex: 1, backgroundColor: OwnerAccent }} />
              <Button title={t('safe_in')} icon="arrow-down-circle-outline" variant="secondary" onPress={() => (setMode('in'), setNote(''), setMsg(null))} style={{ flex: 1 }} />
            </Row>
          )}
          {msg ? (
            <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
              {msg.text}
            </T>
          ) : null}
        </View>

        <View style={styles.card}>
          <T type="subheading">{t('safe_history')}</T>
          {mine.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('safe_none')}
            </T>
          ) : (
            mine.slice(0, 200).map((l, i) => (
              <Row key={i} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {l.title}
                  </T>
                  <T type="small" color={Colors.textMuted} numberOfLines={1}>
                    {formatDateHuman(toISODate(new Date(l.ts)))} {clockTime(l.ts)} • {l.who === 'owner' ? t('role_owner') : l.who}
                  </T>
                </View>
                <T type="small" color={l.out ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
                  {l.out ? '−' : '+'}
                  {formatPrice(l.amount)}
                </T>
              </Row>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  line: { gap: Spacing.two, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, alignItems: 'center' },
  input: { height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.background },
});
