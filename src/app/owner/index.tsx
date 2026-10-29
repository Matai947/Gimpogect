import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { OneFitStat } from '@/components/onefit-stat';
import { StaffToday } from '@/components/staff-today';
import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatPrice } from '@/data/mock';
import { saleGroup } from '@/data/owner';
import { useI18n, useMembers, useNow, usePresence, useRawSales, useSales } from '@/store/app-context';

const GOLD = '#D4AF37';
const ONYX = '#0B0B0B';
const ALMATY = 5 * 3600000;
const dayOf = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10);
const sum = (a: { amount: number }[]) => a.reduce((s, x) => s + x.amount, 0);
const CHART_H = 120;

/** The owner's front page: the day's money first, then the pulse of the clubs, what sells, and who is at work. */
export default function OwnerOverview() {
  const { t, td } = useI18n();
  const sales = useSales();
  const raw = useRawSales();
  const { list } = useMembers();
  const present = usePresence();
  const now = useNow();
  const [period, setPeriod] = useState<7 | 30>(30);
  const [sel, setSel] = useState<number | null>(null); // null = today
  const [chartW, setChartW] = useState(0);

  const today = dayOf(now);
  const d = useMemo(() => {
    const iso = (back: number) => dayOf(now - back * 86400000);
    const from = iso(period - 1);
    const prevFrom = iso(period * 2 - 1);
    const cur = sales.filter((s) => dayOf(s.ts) >= from);
    const prev = sales.filter((s) => dayOf(s.ts) >= prevFrom && dayOf(s.ts) < from);
    const days = Array.from({ length: period }, (_, i) => {
      const day = iso(period - 1 - i);
      return { iso: day, value: sum(cur.filter((s) => dayOf(s.ts) === day)) };
    });
    const byItem = new Map<string, number>();
    cur.filter((s) => s.kind !== 'refund' && s.kind !== 'debt').forEach((s) => byItem.set(s.title, (byItem.get(s.title) ?? 0) + s.amount));
    const rawCur = raw.filter((s) => dayOf(s.ts) >= from);
    const byId = (id: string) => raw.find((x) => x.id === id);
    return {
      cur,
      prev,
      days,
      top: [...byItem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      // every sale counts here, also the old ones rung up before the way of paying was recorded
      mix: rawCur.reduce((m, s) => {
        const g = saleGroup(s, byId);
        if (g) m[g] += s.kind === 'refund' ? -s.amount : s.amount;
        return m;
      }, { bar: 0, plans: 0, trainers: 0 }),
      clubs: clubs.map((c) => ({ id: c.id, name: c.name.replace('Seven Gym ', ''), revenue: sum(cur.filter((s) => s.clubId === c.id)), today: sum(cur.filter((s) => s.clubId === c.id && dayOf(s.ts) === today)) })),
      checksToday: new Set(cur.filter((s) => dayOf(s.ts) === today && ['plan', 'shop', 'personal'].includes(s.kind)).map((s) => `${s.staff}|${s.memberId ?? ''}|${Math.round(s.ts / 10000)}`)).size,
    };
  }, [sales, raw, period, now, today]);

  const revenue = sum(d.cur);
  const prevRevenue = sum(d.prev);
  const delta = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;
  const idx = sel === null ? d.days.length - 1 : Math.min(sel, d.days.length - 1);
  const picked = d.days[idx];
  const maxDay = Math.max(1, ...d.days.map((x) => x.value));
  const best = d.days.reduce((a, b) => (b.value > a.value ? b : a), d.days[0]);
  const active = list.filter((m) => m.active).length;
  const expiring = list.filter((m) => m.active && m.daysLeft <= 7).length;
  const payments = new Set(d.cur.filter((s) => ['plan', 'shop', 'personal'].includes(s.kind)).map((s) => `${s.staff}|${s.memberId ?? ''}|${Math.round(s.ts / 10000)}`)).size;

  // the clock of the clubs, not the phone's
  const local = new Date(now + ALMATY);
  const hour = local.getUTCHours();
  const greet = hour < 5 ? t('dash_night') : hour < 12 ? t('dash_morning') : hour < 18 ? t('dash_day') : t('dash_evening');
  const human = (iso: string) => {
    const x = new Date(iso + 'T00:00:00Z');
    return `${x.getUTCDate()} ${t('dash_months').split('|')[x.getUTCMonth()]}`;
  };
  const weekday = t('dash_weekdays').split('|')[local.getUTCDay()];

  // gold area under the daily revenue line
  // inset so the marker at either end is not cut off
  const pts = d.days.map((x, i) => [chartW ? 8 + (i / Math.max(1, d.days.length - 1)) * (chartW - 16) : 0, CHART_H - 8 - (x.value / maxDay) * (CHART_H - 20)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = chartW ? `${line} L${chartW - 8},${CHART_H} L8,${CHART_H} Z` : '';
  const pick = (x: number) => chartW && setSel(Math.round(Math.min(1, Math.max(0, (x - 8) / (chartW - 16))) * (d.days.length - 1)));

  const mixTotal = d.mix.bar + d.mix.plans + d.mix.trainers;
  const mix = [
    { key: 'plans', label: t('grp_plans'), value: d.mix.plans, color: GOLD },
    { key: 'bar', label: t('grp_bar'), value: d.mix.bar, color: '#7A5C12' },
    { key: 'trainers', label: t('grp_trainers'), value: d.mix.trainers, color: '#2B2B2B' },
  ];
  const clubMax = Math.max(1, ...d.clubs.map((c) => c.revenue));

  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_overview')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* the black card: today's money in gold */}
        <LinearGradient colors={['#141414', '#0B0B0B', '#1E180A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <T type="small" color={GOLD} style={{ fontWeight: '700', letterSpacing: 0.5 }}>
                {greet}
              </T>
              <T type="small" color="rgba(255,255,255,0.55)">
                {weekday}, {human(today)}
              </T>
            </View>
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <T type="small" color="#FFFFFF" style={{ fontWeight: '700' }}>
                {t('dash_inside', { n: present.length })}
              </T>
            </View>
          </Row>

          <View style={{ marginTop: Spacing.three }}>
            <T type="small" color="rgba(255,255,255,0.55)" style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {sel === null || idx === d.days.length - 1 ? t('dash_today') : human(picked.iso)}
            </T>
            <T type="display" color={GOLD} style={{ fontSize: 44, lineHeight: 52, letterSpacing: -1, textTransform: 'none' }}>
              {formatPrice(picked.value)}
            </T>
            <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
              <T type="small" color="rgba(255,255,255,0.75)">
                {t('dash_period_total', { n: period, sum: formatPrice(revenue) })}
              </T>
              {prevRevenue ? (
                <View style={[styles.delta, { backgroundColor: delta >= 0 ? 'rgba(52,199,89,0.18)' : 'rgba(214,59,71,0.22)' }]}>
                  <T type="small" color={delta >= 0 ? '#5BE08A' : '#FF8A93'} style={{ fontWeight: '800' }}>
                    {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
                  </T>
                </View>
              ) : null}
            </Row>
          </View>

          <View
            style={{ height: CHART_H, marginTop: Spacing.three }}
            onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
            onResponderMove={(e) => pick(e.nativeEvent.locationX)}>
            {chartW ? (
              <Svg width={chartW} height={CHART_H} style={{ pointerEvents: 'none' }}>
                <Defs>
                  <SvgGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={GOLD} stopOpacity={0.45} />
                    <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
                  </SvgGradient>
                </Defs>
                <Path d={area} fill="url(#g)" />
                <Path d={line} stroke={GOLD} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <Line x1={pts[idx][0]} y1={0} x2={pts[idx][0]} y2={CHART_H} stroke="rgba(255,255,255,0.25)" strokeDasharray="3,4" />
                <Circle cx={pts[idx][0]} cy={pts[idx][1]} r={6} fill={ONYX} stroke={GOLD} strokeWidth={3} />
              </Svg>
            ) : null}
          </View>
          <T type="small" color="rgba(255,255,255,0.55)" style={{ marginTop: 6 }}>
            {t('dash_best', { day: human(best.iso), sum: formatPrice(best.value) })}
          </T>

          <Row gap={6} style={{ marginTop: Spacing.three }}>
            {([7, 30] as const).map((p) => (
              <Pressable key={p} onPress={() => (setPeriod(p), setSel(null))} style={[styles.periodChip, period === p && styles.periodOn]}>
                <T type="small" color={period === p ? ONYX : 'rgba(255,255,255,0.75)'} style={{ fontWeight: '700' }}>
                  {t(p === 7 ? 'period_7' : 'period_30')}
                </T>
              </Pressable>
            ))}
          </Row>
        </LinearGradient>

        {/* the pulse */}
        <View style={styles.grid}>
          <Pulse icon="people" label={t('kpi_inside')} value={String(present.length)} live />
          <Pulse icon="receipt" label={t('dash_checks_today')} value={String(d.checksToday)} />
          <Pulse icon="ribbon" label={t('kpi_active')} value={String(active)} />
          <Pulse icon="hourglass" label={t('kpi_expiring')} value={String(expiring)} warn={expiring > 0} />
          <Pulse icon="cash" label={t('kpi_avg')} value={payments ? formatPrice(Math.round(revenue / payments)) : '—'} />
          <Pulse icon="trending-up" label={t('kpi_sales')} value={String(payments)} />
        </View>

        {/* where the money comes from */}
        <View style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="subheading">{t('dash_mix')}</T>
            <T type="small" color={Colors.textMuted}>
              {formatPrice(mixTotal)}
            </T>
          </Row>
          <View style={styles.mixBar}>
            {mix.map((m) => (m.value > 0 ? <View key={m.key} style={{ flex: m.value, backgroundColor: m.color }} /> : null))}
            {mixTotal === 0 ? <View style={{ flex: 1, backgroundColor: Colors.surfaceAlt }} /> : null}
          </View>
          {mix.map((m) => (
            <Row key={m.key} style={{ justifyContent: 'space-between' }}>
              <Row gap={8}>
                <View style={[styles.swatch, { backgroundColor: m.color }]} />
                <T type="small">{m.label}</T>
              </Row>
              <T type="small" style={{ fontWeight: '700' }}>
                {formatPrice(m.value)}{' '}
                <T type="small" color={Colors.textMuted}>
                  {mixTotal ? Math.round((m.value / mixTotal) * 100) : 0}%
                </T>
              </T>
            </Row>
          ))}
        </View>

        {/* the clubs side by side */}
        <Row gap={Spacing.two} style={{ alignItems: 'stretch' }}>
          {d.clubs.map((c) => (
            <View key={c.id} style={[styles.card, styles.club]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T type="subheading">{c.name}</T>
                <Row gap={4}>
                  <Ionicons name="person" size={12} color={Colors.success} />
                  <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>
                    {present.filter((p) => p.clubId === c.id).length}
                  </T>
                </Row>
              </Row>
              <T type="title" color={OwnerAccent} style={{ fontSize: 22, lineHeight: 28, textTransform: 'none' }} numberOfLines={1} adjustsFontSizeToFit>
                {formatPrice(c.revenue)}
              </T>
              <View style={styles.clubTrack}>
                <View style={{ width: `${(c.revenue / clubMax) * 100}%`, height: '100%', backgroundColor: GOLD, borderRadius: 3 }} />
              </View>
              <T type="small" color={Colors.textSecondary}>
                {t('dash_club_today', { sum: formatPrice(c.today) })}
              </T>
            </View>
          ))}
        </Row>

        {/* best sellers */}
        <View style={styles.card}>
          <T type="subheading">{t('by_item')}</T>
          {d.top.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              —
            </T>
          ) : (
            d.top.map(([title, v], i) => (
              <Row key={title} gap={Spacing.two} style={styles.topRow}>
                <T type="display" color={i === 0 ? GOLD : Colors.textMuted} style={{ fontSize: 26, lineHeight: 30, width: 30 }}>
                  {i + 1}
                </T>
                <View style={{ flex: 1, gap: 4 }}>
                  <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {td(title)}
                  </T>
                  <View style={styles.clubTrack}>
                    <View style={{ width: `${(v / d.top[0][1]) * 100}%`, height: '100%', backgroundColor: i === 0 ? GOLD : '#CDBF94', borderRadius: 3 }} />
                  </View>
                </View>
                <T type="small" style={{ fontWeight: '700' }}>
                  {formatPrice(v)}
                </T>
              </Row>
            ))
          )}
        </View>

        <StaffToday accent={OwnerAccent} />
        <OneFitStat accent={OwnerAccent} />
      </ScrollView>
    </View>
  );
}

function Pulse({ icon, label, value, warn, live }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; warn?: boolean; live?: boolean }) {
  return (
    <View style={[styles.pulse, warn && { borderColor: 'rgba(217,100,58,0.5)' }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={[styles.well, warn && { backgroundColor: 'rgba(217,100,58,0.12)' }]}>
          <Ionicons name={icon} size={16} color={warn ? Colors.warning : OwnerAccent} />
        </View>
        {live ? <View style={[styles.liveDot, { backgroundColor: Colors.success }]} /> : null}
      </Row>
      <T type="heading" color={warn ? Colors.warning : Colors.text} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      <T type="small" color={Colors.textMuted} numberOfLines={2}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { paddingBottom: Spacing.six, gap: Spacing.three, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, width: '100%', maxWidth: 900, alignSelf: 'center' },
  hero: { padding: Spacing.four, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5BE08A' },
  delta: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  periodChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
  periodOn: { backgroundColor: GOLD, borderColor: GOLD },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pulse: { flexGrow: 1, flexBasis: '30%', minWidth: 100, gap: 6, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  well: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,175,55,0.14)' },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  club: { flex: 1, minWidth: 0 },
  clubTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceAlt, overflow: 'hidden' },
  mixBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  topRow: { alignItems: 'center', paddingVertical: 4 },
});
