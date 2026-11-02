import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { clockTime } from '@/components/shift-bar';
import { Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatDateHuman, formatPrice, toISODate } from '@/data/mock';
import { fetchSafe, fetchWithdrawals, type SafeEntry } from '@/lib/api';
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

/** The manager's view of a club's safe: what is in it, what was put in and taken out, and every movement. Read only. */
export function SafePanel({ accent }: { accent: string }) {
  const { t } = useI18n();
  const { staff } = useApp();
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
  line: { gap: Spacing.two, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, alignItems: 'center' },
});
