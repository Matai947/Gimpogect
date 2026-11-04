import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatPrice } from '@/data/mock';
import { monthNames } from '@/i18n';
import { useApp, useCanManage, useI18n, useNow, useRawSales } from '@/store/app-context';

const ALMATY = 5 * 3600000;
const local = (ts: number) => new Date(ts + ALMATY).toISOString();

/** The administrators' premiums for sports nutrition in a month: per person, and every sale behind them.
 *  The manager sees everyone; an administrator sees their own. */
export default function StaffBonuses() {
  const { t } = useI18n();
  const { staff } = useApp();
  const canManage = useCanManage();
  const sales = useRawSales();
  const now = useNow();
  const thisMonth = local(now).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const shift = (d: number) => {
    const [y, m] = month.split('-').map(Number);
    const x = new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7);
    if (x <= thisMonth) setMonth(x);
  };
  const me = (staff?.name ?? '').toLowerCase();

  // a returned sale takes its premium back
  const list = useMemo(
    () => sales.filter((s) => s.bonusSum && !(s.refunded && s.refunded > 0) && local(s.ts).slice(0, 7) === month && (canManage || (s.bonusTo ?? '').toLowerCase() === me)),
    [sales, month, canManage, me],
  );
  const people = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    list.forEach((s) => {
      const k = s.bonusTo ?? '—';
      const v = m.get(k) ?? { sum: 0, n: 0 };
      m.set(k, { sum: v.sum + (s.bonusSum ?? 0), n: v.n + (s.bonusSum ?? 0) / 1000 });
    });
    return [...m.entries()].sort((a, b) => b[1].sum - a[1].sum);
  }, [list]);
  const total = list.reduce((n, s) => n + (s.bonusSum ?? 0), 0);
  const [y, m] = month.split('-').map(Number);

  return (
    <View style={styles.root}>
      <StaffHeader title={t('bonuses_title')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => shift(-1)} hitSlop={10} style={styles.arrow}>
            <Ionicons name="chevron-back" size={22} color={StaffAccent} />
          </Pressable>
          <T type="subheading">
            {monthNames()[m - 1]} {y}
          </T>
          <Pressable onPress={() => shift(1)} disabled={month >= thisMonth} hitSlop={10} style={[styles.arrow, month >= thisMonth && { opacity: 0.3 }]}>
            <Ionicons name="chevron-forward" size={22} color={StaffAccent} />
          </Pressable>
        </Row>
        <View style={styles.card}>
          <T type="small" color={Colors.textSecondary}>
            {t('bonuses_sum', { n: list.length })}
          </T>
          <T type="display" color={StaffAccent} style={{ fontSize: 28, lineHeight: 34, textTransform: 'none' }}>
            {formatPrice(total)}
          </T>
          {people.map(([name, v]) => (
            <Row key={name} style={styles.person}>
              <T type="body" style={{ flex: 1, fontWeight: '700' }}>
                {name}
              </T>
              <T type="small" color={Colors.textMuted}>
                {v.n} шт. •{' '}
              </T>
              <T type="body" style={{ fontWeight: '800' }}>
                {formatPrice(v.sum)}
              </T>
            </Row>
          ))}
        </View>
        {list.length === 0 ? (
          <T type="small" color={Colors.textMuted}>
            {t('bonuses_none')}
          </T>
        ) : (
          list.map((s) => (
            <View key={s.id} style={styles.card}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }} gap={Spacing.two}>
                <T type="body" style={{ flex: 1, fontWeight: '800' }}>
                  {s.bonusTo}
                </T>
                <T type="body" color={Colors.success} style={{ fontWeight: '800' }}>
                  +{formatPrice(s.bonusSum ?? 0)}
                </T>
              </Row>
              <T type="small" color={Colors.textSecondary}>
                {s.title}
              </T>
              <T type="small" color={Colors.textMuted}>
                {local(s.ts).slice(8, 10)}.{local(s.ts).slice(5, 7)} {local(s.ts).slice(11, 16)} • {clubs.find((c) => c.id === s.clubId)?.name.replace('Seven Gym ', '') ?? ''} • {t('bonuses_by', { name: s.staff })}
              </T>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { gap: 4, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  person: { alignItems: 'center', paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
