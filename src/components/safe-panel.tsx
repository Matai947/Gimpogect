import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { clockTime } from '@/components/shift-bar';
import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatDateHuman, formatPrice, toISODate } from '@/data/mock';
import { fetchSafe, fetchWithdrawals, safeOp, type SafeEntry } from '@/lib/api';
import { useApp, useI18n } from '@/store/app-context';

// A withdrawal "to the safe" is stored with the label in the cashier's language.
export const TO_SAFE = ['В сейф', 'Сейфке', 'To the safe'];

export type SafeLine = { ts: number; clubId: string; amount: number; title: string; who: string; out: boolean };

/** Everything that went into and out of the safes: the desks' withdrawals "to the safe" and the owner's entries. */
export function useSafeLines(tick = 0) {
  const { t } = useI18n();
  const { staffCode } = useApp();
  const [lines, setLines] = useState<SafeLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([fetchWithdrawals(staffCode, 400), fetchSafe(staffCode)]).then(([wd, safe]) => {
      if (!live) return;
      if (!wd || !safe) return setFailed(true);
      const fromDesks: SafeLine[] = wd.filter((w) => TO_SAFE.includes(w.reason)).map((w) => ({ ts: w.ts, clubId: w.clubId ?? 'c1', amount: w.amount, title: t('safe_from_desk'), who: `${w.staff} → ${w.responsible}`, out: false }));
      const own: SafeLine[] = safe.map((e: SafeEntry) => ({ ts: e.ts, clubId: e.clubId, amount: e.amount, title: e.note, who: e.staff, out: e.kind === 'out' }));
      setLines([...fromDesks, ...own].sort((x, y) => y.ts - x.ts));
    });
    return () => {
      live = false;
    };
  }, [staffCode, t, tick]);
  return { lines, failed };
}

/** The manager's safe of a club: what is in it, what was put in and taken out, every movement; taking out and putting in by hand. */
export function SafePanel({ accent }: { accent: string }) {
  const { t } = useI18n();
  const { staff, staffCode } = useApp();
  const [mode, setMode] = useState<'in' | 'out' | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [club, setClub] = useState(staff?.clubId ?? 'c1');
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const { lines, failed } = useSafeLines(tick);

  const s = useMemo(() => {
    const mine = (lines ?? []).filter((l) => l.clubId === club);
    const put = mine.filter((l) => !l.out).reduce((n, l) => n + l.amount, 0);
    const took = mine.filter((l) => l.out).reduce((n, l) => n + l.amount, 0);
    return { mine, put, took, balance: put - took };
  }, [lines, club]);

  const purposes = [t('safe_p1'), t('safe_p2'), t('safe_p3'), t('safe_p4')];
  const sum = Number(amount.replace(/\D/g, '')) || 0;
  const save = async () => {
    if (!mode) return;
    if (mode === 'out' && sum > s.balance) return setMsg({ text: t('safe_too_much'), bad: true });
    setBusy(true);
    const ok = await safeOp(staffCode, { clubId: club, kind: mode, amount: sum, note: note.trim() });
    setBusy(false);
    if (!ok) return setMsg({ text: t('cash_fail'), bad: true });
    setMsg({ text: mode === 'in' ? t('safe_in_done', { sum: formatPrice(sum) }) : t('safe_out_done', { sum: formatPrice(sum) }), bad: false });
    setMode(null);
    setAmount('');
    setNote('');
    setTick((n) => n + 1);
  };

  return (
    <View style={styles.card}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Row gap={8} style={{ alignItems: 'center' }}>
          <Ionicons name="lock-closed-outline" size={20} color={accent} />
          <T type="subheading">{t('tab_safe')}</T>
        </Row>
        <T type="small" color={Colors.textMuted} onPress={() => setTick((n) => n + 1)}>
          {t('cash_refresh')}
        </T>
      </Row>
      <ChipRow>
        {clubs.map((c) => (
          <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={club === c.id} onPress={() => setClub(c.id)} />
        ))}
      </ChipRow>
      {failed ? (
        <T type="small" color={Colors.danger}>
          {t('cash_fail')}
        </T>
      ) : (
        <>
          <T type="small" color={Colors.textSecondary}>
            {t('safe_balance')}
          </T>
          <T type="display" color={accent} style={{ fontSize: 32, lineHeight: 38, textTransform: 'none' }}>
            {lines ? formatPrice(s.balance) : '…'}
          </T>
          <View style={styles.sums}>
            <View style={{ flex: 1, gap: 2 }}>
              <T type="small" color={Colors.textMuted}>
                {t('safe_put_total')}
              </T>
              <T type="body" color={Colors.success} style={{ fontWeight: '800' }}>
                +{formatPrice(s.put)}
              </T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T type="small" color={Colors.textMuted}>
                {t('safe_took_total')}
              </T>
              <T type="body" color={Colors.danger} style={{ fontWeight: '800' }}>
                −{formatPrice(s.took)}
              </T>
            </View>
          </View>
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
                <Button title={mode === 'in' ? t('safe_in') : t('safe_out')} onPress={() => void save()} disabled={busy || !sum || note.trim().length < 2} style={{ flex: 1, backgroundColor: accent }} />
                <Button title={t('cancel')} variant="secondary" onPress={() => setMode(null)} />
              </Row>
            </View>
          ) : (
            <Row gap={Spacing.two}>
              <Button title={t('safe_out')} icon="arrow-up-circle-outline" size="sm" onPress={() => (setMode('out'), setNote(''), setMsg(null))} style={{ flex: 1, backgroundColor: accent }} />
              <Button title={t('safe_in')} icon="arrow-down-circle-outline" size="sm" variant="secondary" onPress={() => (setMode('in'), setNote(''), setMsg(null))} style={{ flex: 1 }} />
            </Row>
          )}
          {msg ? (
            <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
              {msg.text}
            </T>
          ) : null}
          {s.mine.length ? (
            <Pressable onPress={() => setOpen((v) => !v)} style={styles.toggle}>
              <T type="small" color={accent} style={{ fontWeight: '700' }}>
                {open ? t('dv_hide') : t('safe_show', { n: s.mine.length })}
              </T>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={accent} />
            </Pressable>
          ) : (
            <T type="small" color={Colors.textMuted}>
              {lines ? t('safe_none') : ''}
            </T>
          )}
          {open
            ? s.mine.slice(0, 100).map((l, i) => (
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
            : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  sums: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  input: { height: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.background },
  line: { gap: Spacing.two, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, alignItems: 'center' },
});
