import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { Chip, ChipRow, ProgressBar, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, clubById, clubs, formatPrice, toISODate } from '@/data/mock';
import { useI18n, useMembers, useSales } from '@/store/app-context';

const sum = (a: { amount: number }[]) => a.reduce((s, x) => s + x.amount, 0);
const shortDate = (iso: string) => iso.slice(5).split('-').reverse().join('.');

export default function OwnerOverview() {
  const { t, td } = useI18n();
  const sales = useSales();
  const { list } = useMembers();
  const [period, setPeriod] = useState<7 | 30>(30);

  const d = useMemo(() => {
    const today = new Date();
    const startOf = (daysBack: number) => {
      const x = addDays(today, -daysBack);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    };
    const from = startOf(period - 1);
    const prevFrom = startOf(period * 2 - 1);
    const cur = sales.filter((s) => s.ts >= from);
    const prev = sales.filter((s) => s.ts >= prevFrom && s.ts < from);
    const days = Array.from({ length: period }, (_, i) => {
      const iso = toISODate(addDays(today, -(period - 1 - i)));
      return { iso, value: sum(cur.filter((s) => toISODate(new Date(s.ts)) === iso)) };
    });
    const group = (key: (s: (typeof cur)[number]) => string) => {
      const m = new Map<string, number>();
      cur.forEach((s) => m.set(key(s), (m.get(key(s)) ?? 0) + s.amount));
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return { cur, prev, days, byClub: group((s) => s.clubId), byItem: group((s) => s.title).slice(0, 5) };
  }, [sales, period]);

  const revenue = sum(d.cur);
  const prevRevenue = sum(d.prev);
  const delta = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;
  const maxDay = Math.max(1, ...d.days.map((x) => x.value));
  const active = list.filter((m) => m.active).length;
  const expiring = list.filter((m) => m.active && m.daysLeft <= 7).length;

  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_overview')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ChipRow>
          <Chip label={t('period_7')} active={period === 7} onPress={() => setPeriod(7)} />
          <Chip label={t('period_30')} active={period === 30} onPress={() => setPeriod(30)} />
        </ChipRow>

        <View style={styles.hero}>
          <T type="small" color={Colors.textSecondary}>
            {t('kpi_revenue')}
          </T>
          <T type="display" color={OwnerAccent} style={{ fontSize: 30, lineHeight: 36 }}>
            {formatPrice(revenue)}
          </T>
          <T type="small" color={delta >= 0 ? Colors.success : Colors.danger} style={{ fontWeight: '700' }}>
            {delta >= 0 ? '▲ ' : '▼ '}
            {t('vs_prev', { p: Math.abs(delta) })}
          </T>
        </View>

        <Row gap={Spacing.two}>
          <Kpi label={t('kpi_sales')} value={String(d.cur.length)} />
          <Kpi label={t('kpi_avg')} value={formatPrice(d.cur.length ? Math.round(revenue / d.cur.length) : 0)} />
        </Row>
        <Row gap={Spacing.two}>
          <Kpi label={t('kpi_active')} value={String(active)} />
          <Kpi label={t('kpi_expiring')} value={String(expiring)} warn={expiring > 0} />
        </Row>

        <View style={styles.card}>
          <T type="heading">{t('chart_revenue')}</T>
          <View style={styles.chart}>
            {d.days.map((x) => (
              <View key={x.iso} style={{ flex: 1, justifyContent: 'flex-end' }}>
                <View style={{ height: Math.max(3, (x.value / maxDay) * 110), backgroundColor: OwnerAccent, borderRadius: 3, opacity: 0.9 }} />
              </View>
            ))}
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="small" color={Colors.textMuted}>
              {shortDate(d.days[0].iso)}
            </T>
            <T type="small" color={Colors.textMuted}>
              max {formatPrice(maxDay)}
            </T>
            <T type="small" color={Colors.textMuted}>
              {shortDate(d.days[d.days.length - 1].iso)}
            </T>
          </Row>
        </View>

        <View style={styles.card}>
          <T type="heading">{t('by_club')}</T>
          {clubs.map((c) => (
            <Share key={c.id} label={clubById(c.id)?.name.replace('Gym Project ', '') ?? ''} value={d.byClub.find(([id]) => id === c.id)?.[1] ?? 0} total={revenue} />
          ))}
        </View>

        <View style={styles.card}>
          <T type="heading">{t('by_item')}</T>
          {d.byItem.map(([title, v]) => (
            <Share key={title} label={td(title)} value={v} total={revenue} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={[styles.kpi, warn && { borderColor: 'rgba(255,133,98,0.5)' }]}>
      <T type="small" color={Colors.textMuted} numberOfLines={1}>
        {label}
      </T>
      <T type="heading" color={warn ? Colors.warning : Colors.text} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

function Share({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T type="small" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </T>
        <T type="small" style={{ fontWeight: '700' }}>
          {formatPrice(value)}
        </T>
      </Row>
      <ProgressBar value={total ? value / total : 0} color={OwnerAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { paddingBottom: Spacing.six, gap: Spacing.two, paddingHorizontal: Spacing.three },
  hero: { gap: 2, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: 'rgba(255,199,54,0.4)' },
  kpi: { flex: 1, gap: 2, padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 116 },
});
