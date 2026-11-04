import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatPrice } from '@/data/mock';
import { groupTotals, saleGroup, saleValue, type Sale } from '@/data/owner';
import { fetchExpenses, fetchSales, type Expense } from '@/lib/api';
import { useApp, useI18n, useNow, useRawSales } from '@/store/app-context';

const ALMATY = 5 * 3600000;
const dayOf = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10);
const show = (iso: string) => iso.split('-').reverse().join('.');
/** "1.10.2026", "01.10.26" → "2026-10-01"; anything else → '' */
function parse(s: string): string {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!m) return '';
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // half-typed "41.11" or "01.13" is not a date: checked without toISOString, which throws on it
  const d = new Date(iso + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : '';
}

/** Owner: pick any two dates and get the whole sum of that period — money in, how it came, what it was for, what went out, and the profit. */
/** `club` given = the owner's reports pick it; `pick` = the manager chooses a club here; neither = the administrator's own club. `money` = expenses and profit (owner, manager, accountant). */
export function PeriodSummary({ club: given, accent, pick, money = true }: { club?: string; accent: string; pick?: boolean; money?: boolean }) {
  const { t } = useI18n();
  const { staffCode, staff } = useApp();
  const [picked, setPicked] = useState<string>(staff?.clubId ?? 'all');
  const club = given ?? (pick ? picked : (staff?.clubId ?? 'c1'));
  const loaded = useRawSales();
  const now = useNow();
  const today = dayOf(now);
  const monthStart = today.slice(0, 8) + '01';
  const [fromText, setFromText] = useState(show(monthStart));
  const [toText, setToText] = useState(show(today));
  const [older, setOlder] = useState<Sale[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const from = parse(fromText);
  const to = parse(toText);
  const ok = !!from && !!to && from <= to;

  // the register's books are loaded for 120 days; an older period is fetched for itself
  const daysBack = from ? Math.ceil((now - Date.parse(from + 'T00:00:00Z')) / 86400000) + 2 : 0;
  useEffect(() => {
    if (!staffCode || daysBack <= 115) return;
    let live = true;
    fetchSales(staffCode, Math.min(400, daysBack)).then((l) => live && l && setOlder(l));
    return () => {
      live = false;
    };
  }, [staffCode, daysBack]);
  useEffect(() => {
    if (!staffCode || !money) return;
    let live = true;
    fetchExpenses(staffCode).then((d) => live && d && setExpenses(d.payments));
    return () => {
      live = false;
    };
  }, [staffCode, money]);

  const r = useMemo(() => {
    if (!ok) return null;
    const all = daysBack > 115 && older ? older : loaded;
    const byId = (id: string) => all.find((x) => x.id === id);
    const rows = all.filter((x) => (club === 'all' || x.clubId === club) && dayOf(x.ts) >= from && dayOf(x.ts) <= to);
    const g = groupTotals(rows, byId);
    // what it was for counts every sale, also the old ones rung up before the way of paying was recorded
    const kinds = { bar: 0, plans: 0, trainers: 0 };
    rows.forEach((x) => {
      const k = saleGroup(x, byId);
      if (k) kinds[k] += x.kind === 'refund' ? -x.amount : x.amount;
    });
    const revenue = rows.reduce((n, x) => n + saleValue(x), 0);
    const refunds = rows.filter((x) => x.kind === 'refund').reduce((n, x) => n + x.amount, 0);
    const checks = new Set(rows.filter((x) => ['plan', 'shop', 'personal'].includes(x.kind)).map((x) => `${x.staff}|${x.memberId ?? ''}|${Math.round(x.ts / 10000)}`)).size;
    const cash = g.bar.cash + g.plans.cash + g.trainers.cash;
    const nonCash = g.bar.nonCash + g.plans.nonCash + g.trainers.nonCash;
    const discRows = rows.filter((x) => x.disc && x.kind !== 'refund');
    const given = discRows.reduce((n, x) => n + (x.off ?? 0), 0);
    const exRows = expenses.filter((e) => (club === 'all' || e.clubId === club) && dayOf(e.ts) >= from && dayOf(e.ts) <= to);
    const spent = exRows.reduce((n, e) => n + e.amount, 0);
    // what the money went on in the period, biggest first
    const byTitle = [...exRows.reduce((m, e) => m.set(e.title, (m.get(e.title) ?? 0) + e.amount), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
    const spentCash = exRows.filter((e) => e.method === 'cash').reduce((n, e) => n + e.amount, 0);
    return { revenue, refunds, checks, cash, nonCash, other: revenue - cash - nonCash, kinds, spent, byTitle, spentCash, given, givenN: discRows.length, days: Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 };
  }, [ok, daysBack, older, loaded, club, from, to, expenses]);

  const set = (a: string, b: string) => {
    setFromText(show(a));
    setToText(show(b));
  };
  const shiftDay = (iso: string, d: number) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 86400000).toISOString().slice(0, 10);
  const prevMonthEnd = shiftDay(monthStart, -1);

  return (
    <View style={styles.card}>
      <T type="subheading">{t('ps_title')}</T>
      {pick ? (
        <ChipRow>
          <Chip label={t('all')} active={club === 'all'} onPress={() => setPicked('all')} />
          {clubs.map((c) => (
            <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={club === c.id} onPress={() => setPicked(c.id)} />
          ))}
        </ChipRow>
      ) : !given ? (
        <T type="small" color={Colors.textMuted}>
          {clubs.find((c) => c.id === club)?.name}
        </T>
      ) : null}
      <Row gap={Spacing.two} style={{ alignItems: 'center' }}>
        <T type="small" color={Colors.textSecondary}>
          {t('ps_from')}
        </T>
        <TextInput value={fromText} onChangeText={setFromText} placeholder="01.10.2026" placeholderTextColor={Colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={10} style={[styles.input, !from && fromText ? styles.bad : null]} />
        <T type="small" color={Colors.textSecondary}>
          {t('ps_to')}
        </T>
        <TextInput value={toText} onChangeText={setToText} placeholder="31.10.2026" placeholderTextColor={Colors.textMuted} keyboardType="numbers-and-punctuation" maxLength={10} style={[styles.input, !to && toText ? styles.bad : null]} />
      </Row>
      <ChipRow>
        <Chip label={t('ps_today')} onPress={() => set(today, today)} />
        <Chip label={t('ps_yesterday')} onPress={() => set(shiftDay(today, -1), shiftDay(today, -1))} />
        <Chip label={t('ps_this_month')} onPress={() => set(monthStart, today)} />
        <Chip label={t('ps_last_month')} onPress={() => set(prevMonthEnd.slice(0, 8) + '01', prevMonthEnd)} />
      </ChipRow>

      {!r ? (
        <T type="small" color={Colors.danger}>
          {t('ps_bad')}
        </T>
      ) : (
        <>
          <View style={[styles.total, { borderColor: accent }]}>
            <T type="small" color={Colors.textSecondary}>
              {t('ps_total', { from: show(from), to: show(to), n: r.days })}
            </T>
            <T type="display" color={accent} style={{ fontSize: 30, lineHeight: 36, textTransform: 'none' }}>
              {formatPrice(r.revenue)}
            </T>
            <T type="small" color={Colors.textMuted}>
              {t('ps_checks', { n: r.checks })}
              {r.refunds ? ` • ${t('rep_refunds')}: ${formatPrice(r.refunds)}` : ''}
            </T>
          </View>
          <Line label={t('rep_day_cash')} value={r.cash} />
          <Line label={t('rep_day_noncash')} value={r.nonCash} />
          {r.other ? <Line label={t('ps_other')} value={r.other} muted /> : null}
          <View style={styles.sep} />
          <Line label={t('grp_plans')} value={r.kinds.plans} />
          <Line label={t('grp_bar')} value={r.kinds.bar} />
          <Line label={t('grp_trainers')} value={r.kinds.trainers} />
          {r.given ? <Line label={t('ps_discounts', { n: r.givenN })} value={r.given} muted /> : null}
          {money ? (
            <>
              <View style={styles.sep} />
              <Line label={t('ex_spent_period')} value={-r.spent} />
              {r.byTitle.map(([title, sum]) => (
                <Line key={title} label={`   ${title}`} value={-sum} muted />
              ))}
              {r.spent ? <Line label={`   ${t('ps_spent_cash', { cash: formatPrice(r.spentCash), noncash: formatPrice(r.spent - r.spentCash) })}`} value={0} muted hideValue /> : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <T type="body" style={{ fontWeight: '800' }}>
                  {t('ex_profit')}
                </T>
                <T type="body" color={r.revenue - r.spent >= 0 ? Colors.success : Colors.danger} style={{ fontWeight: '800' }}>
                  {formatPrice(r.revenue - r.spent)}
                </T>
              </Row>
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

function Line({ label, value, muted, hideValue }: { label: string; value: number; muted?: boolean; hideValue?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T type="small" color={muted ? Colors.textMuted : Colors.textSecondary}>
        {label}
      </T>
      {hideValue ? null : (
        <T type="small" style={{ fontWeight: '700' }}>
          {value < 0 ? '−' : ''}
          {formatPrice(Math.abs(value))}
        </T>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: 'rgba(184,149,43,0.4)' },
  input: { flex: 1, minWidth: 0, height: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, color: Colors.text, fontSize: 16, backgroundColor: Colors.background, textAlign: 'center' },
  bad: { borderColor: Colors.danger },
  total: { gap: 2, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1.5, backgroundColor: 'rgba(212,175,55,0.06)' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: 2 },
});
