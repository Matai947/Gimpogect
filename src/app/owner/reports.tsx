import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatDateHuman, formatPrice, toISODate, trainers, weekdayShort } from '@/data/mock';
import { clockTime, useDuration } from '@/components/shift-bar';
import { fetchCashes, fetchLoads, fetchShifts, fetchVisits, fetchWithdrawals, type CashDrawer, type Withdrawal, type Shift, type TrainerLoad, type VisitRow } from '@/lib/api';
import { useApp, useI18n, useNow, useRawSales } from '@/store/app-context';

const ALMATY = 5 * 3600000; // the clubs' clock: UTC+5
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06..23
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first

/** Owner reports: attendance by day and hour, trainer load, personal-training income, debts and refunds. */
export default function OwnerReports() {
  const { t } = useI18n();
  const { staffCode, refreshSales } = useApp();
  const sales = useRawSales();
  const now = useNow();
  const [days, setDays] = useState<7 | 30>(30);
  const [club, setClub] = useState<string>('all');
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [loads, setLoads] = useState<TrainerLoad[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [cashes, setCashes] = useState<CashDrawer[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const dur = useDuration();

  useEffect(() => {
    if (!staffCode) return;
    let live = true;
    fetchVisits(staffCode, 60).then((v) => live && v && setVisits(v));
    fetchLoads(staffCode, 60).then((l) => live && l && setLoads(l));
    fetchShifts(staffCode, 60).then((l) => live && l && setShifts(l));
    fetchCashes(staffCode, 60).then((l) => live && l && setCashes(l));
    fetchWithdrawals(staffCode, 60).then((l) => live && l && setWithdrawals(l));
    void refreshSales();
    return () => {
      live = false;
    };
  }, [staffCode, refreshSales]);

  const from = now - days * 86400000;
  const fromDay = new Date(from + ALMATY).toISOString().slice(0, 10); // trainer sessions are entered by calendar day
  const inClub = (c: string) => club === 'all' || c === club;

  const attendance = useMemo(() => {
    const mine = (visits ?? []).filter((v) => v.ts >= from && inClub(v.club));
    const byDay = WEEK.map((d) => mine.filter((v) => new Date(v.ts + ALMATY).getUTCDay() === d).length);
    const byHour = HOURS.map((h) => mine.filter((v) => new Date(v.ts + ALMATY).getUTCHours() === h).length);
    return { total: mine.length, byDay, byHour };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, from, club]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wdRows = useMemo(() => withdrawals.filter((w) => w.ts >= from && inClub(w.clubId ?? '')), [withdrawals, from, club]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cashRows = useMemo(() => cashes.filter((c) => c.open >= from && inClub(c.clubId)), [cashes, from, club]);

  const shiftRows = useMemo(() => {
    const list = shifts.filter((s) => s.start >= from && inClub(s.clubId));
    return { list, worked: list.reduce((n, s) => n + (s.end ? s.end - s.start : 0), 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, from, club]);

  /** One line per day with any money movement: income, cash and non-cash, refunds, withdrawals, and the drawer count. */
  const dayRows = useMemo(() => {
    const dayOf = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10);
    const map = new Map<string, { income: number; cash: number; nonCash: number; refunds: number; taken: number; diff: number | null }>();
    const at = (d: string) => map.get(d) ?? (map.set(d, { income: 0, cash: 0, nonCash: 0, refunds: 0, taken: 0, diff: null }), map.get(d)!);
    sales.filter((x) => x.ts >= from && inClub(x.clubId)).forEach((x) => {
      const r = at(dayOf(x.ts));
      const v = x.kind === 'refund' || x.kind === 'debt' ? -x.amount : x.amount;
      if (x.kind === 'refund') r.refunds += x.amount;
      else if (x.kind !== 'debt') r.income += x.amount;
      if (x.method === 'cash') r.cash += v;
      else if (x.method !== 'desk') r.nonCash += v;
    });
    wdRows.forEach((w) => (at(dayOf(w.ts)).taken += w.amount));
    cashRows.filter((c) => c.close).forEach((c) => {
      const r = at(dayOf(c.close!));
      r.diff = (r.diff ?? 0) + (c.counted ?? 0) - c.expected;
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([d, r]) => ({ d, ...r }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, wdRows, cashRows, from, club]);

  const personal = useMemo(() => {
    const rows = sales.filter((x) => x.ts >= from && inClub(x.clubId) && x.trainerId);
    const perTrainer = trainers.map((tr) => {
      const mine = rows.filter((x) => x.trainerId === tr.id);
      const bought = mine.filter((x) => x.kind === 'personal');
      const refunded = mine.filter((x) => x.kind === 'refund').reduce((s, x) => s + x.amount, 0);
      const worked = loads.filter((l) => l.trainerId === tr.id && l.date >= fromDay && inClub(l.clubId));
      return { id: tr.id, name: tr.name, sessions: worked.reduce((s, l) => s + l.sessions, 0), clients: new Set(bought.map((x) => x.memberId)).size, packs: bought.length, income: bought.reduce((s, x) => s + x.amount, 0) - refunded };
    });
    const byClub = clubs.map((c) => ({ id: c.id, name: c.name.replace('Seven Gym ', ''), income: rows.filter((x) => x.clubId === c.id).reduce((s, x) => s + (x.kind === 'refund' ? -x.amount : x.kind === 'personal' ? x.amount : 0), 0) }));
    return { perTrainer, byClub, total: perTrainer.reduce((s, x) => s + x.income, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, loads, from, fromDay, club]);

  const debts = useMemo(() => sales.filter((x) => x.kind === 'debt' && (x.remaining ?? 0) > 0 && inClub(x.clubId)).sort((a, b) => a.ts - b.ts), [sales, club]); // eslint-disable-line react-hooks/exhaustive-deps
  const refunds = useMemo(() => sales.filter((x) => x.kind === 'refund' && x.ts >= from && inClub(x.clubId)), [sales, from, club]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxTrainer = Math.max(1, ...personal.perTrainer.map((x) => Math.max(x.sessions, x.clients, x.packs)));
  const date = (ts: number) => formatDateHuman(toISODate(new Date(ts)));

  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_reports')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ChipRow>
          <Chip label={t('period_7')} active={days === 7} onPress={() => setDays(7)} />
          <Chip label={t('period_30')} active={days === 30} onPress={() => setDays(30)} />
        </ChipRow>
        <ChipRow>
          <Chip label={t('all')} active={club === 'all'} onPress={() => setClub('all')} />
          {clubs.map((c) => (
            <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={club === c.id} onPress={() => setClub(c.id)} />
          ))}
        </ChipRow>

        {/* attendance */}
        <View style={styles.card}>
          <T type="subheading">{t('rep_attendance')}</T>
          <T type="small" color={Colors.textSecondary}>
            {t('rep_visits_total', { n: attendance.total })}
          </T>
          <T type="label" color={Colors.textSecondary}>
            {t('rep_by_day')}
          </T>
          <Columns values={attendance.byDay} labels={WEEK.map((d) => weekdayShort.get(d))} />
          <T type="label" color={Colors.textSecondary} style={{ marginTop: Spacing.two }}>
            {t('rep_by_hour')}
          </T>
          <Columns values={attendance.byHour} labels={HOURS.map((h) => String(h))} small />
        </View>

        {/* the day: what the owner asks the cashier about */}
        <View style={styles.card}>
          <T type="subheading">{t('rep_days')}</T>
          {dayRows.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('rep_days_none')}
            </T>
          ) : (
            dayRows.map((r) => (
              <View key={r.d} style={[styles.line, { gap: 2 }]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="small" style={{ fontWeight: '700' }}>
                    {formatDateHuman(r.d)}
                  </T>
                  <T type="small" color={OwnerAccent} style={{ fontWeight: '700' }}>
                    {formatPrice(r.income - r.refunds)}
                  </T>
                </Row>
                <T type="small" color={Colors.textSecondary}>
                  {t('rep_day_cash')}: {formatPrice(r.cash)} • {t('rep_day_noncash')}: {formatPrice(r.nonCash)}
                  {r.refunds ? ` • ${t('rep_refunds')}: ${formatPrice(r.refunds)}` : ''}
                  {r.taken ? ` • ${t('cash_taken')}: ${formatPrice(r.taken)}` : ''}
                </T>
                {r.diff !== null ? (
                  <T type="small" color={r.diff === 0 ? Colors.success : Colors.danger}>
                    {t('rep_day_count')}: {r.diff === 0 ? t('cash_diff_ok') : r.diff < 0 ? t('cash_diff_short', { sum: formatPrice(-r.diff) }) : t('cash_diff_over', { sum: formatPrice(r.diff) })}
                  </T>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* trainers */}
        <View style={styles.card}>
          <T type="subheading">{t('rep_trainers')}</T>
          <Row gap={14}>
            <Legend color={Colors.success} label={t('rep_tr_sessions')} />
            <Legend color={Colors.textMuted} label={t('rep_tr_clients')} />
            <Legend color={OwnerAccent} label={t('rep_tr_packs')} />
          </Row>
          {personal.perTrainer.map((tr) => (
            <View key={tr.id} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T type="small" style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {tr.name}
                </T>
                <T type="small" color={OwnerAccent} style={{ fontWeight: '700' }}>
                  {formatPrice(tr.income)}
                </T>
              </Row>
              <Bar value={tr.sessions} max={maxTrainer} color={Colors.success} />
              <Bar value={tr.clients} max={maxTrainer} color={Colors.textMuted} />
              <Bar value={tr.packs} max={maxTrainer} color={OwnerAccent} />
            </View>
          ))}
        </View>

        {/* personal training income */}
        <View style={styles.card}>
          <T type="subheading">{t('rep_personal')}</T>
          <T type="display" color={OwnerAccent} style={{ fontSize: 30, lineHeight: 36 }}>
            {formatPrice(personal.total)}
          </T>
          <Row gap={16} style={{ flexWrap: 'wrap' }}>
            {personal.byClub.map((c) => (
              <T key={c.id} type="small" color={Colors.textSecondary}>
                {c.name}: <T type="small" style={{ fontWeight: '700' }}>{formatPrice(c.income)}</T>
              </T>
            ))}
          </Row>
        </View>

        {/* administrators' shifts */}
        <View style={styles.card}>
          <T type="subheading">{t('rep_shifts')}</T>
          {shiftRows.list.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('rep_shifts_none')}
            </T>
          ) : (
            <>
              <T type="small" color={Colors.textSecondary}>
                {t('rep_shifts_total', { dur: dur(shiftRows.worked) })}
              </T>
              {shiftRows.list.map((s) => (
                <Row key={s.id} style={styles.line}>
                  <View style={{ flex: 1 }}>
                    <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                      {s.staff}
                    </T>
                    <T type="small" color={Colors.textMuted} numberOfLines={1}>
                      {date(s.start)} • {clubs.find((c) => c.id === s.clubId)?.name.replace('Seven Gym ', '')} • {clockTime(s.start)}
                      {s.end ? `–${clockTime(s.end)}` : ''}
                    </T>
                  </View>
                  <T type="small" color={s.end ? Colors.text : s.auto ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
                    {s.end ? dur(s.end - s.start) : s.auto ? t('rep_shift_forgot') : t('rep_shift_now')}
                  </T>
                </Row>
              ))}
            </>
          )}
        </View>

        {/* cash drawer: counted against what should be there */}
        <View style={styles.card}>
          <T type="subheading">{t('rep_cash')}</T>
          {cashRows.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('rep_cash_none')}
            </T>
          ) : (
            cashRows.map((c) => {
              const diff = c.close ? (c.counted ?? 0) - c.expected : 0;
              return (
                <Row key={c.id} style={styles.line}>
                  <View style={{ flex: 1 }}>
                    <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                      {c.staff} • {clubs.find((x) => x.id === c.clubId)?.name.replace('Seven Gym ', '')}
                    </T>
                    <T type="small" color={Colors.textMuted} numberOfLines={1}>
                      {date(c.open)} • {clockTime(c.open)}
                      {c.close ? `–${clockTime(c.close)}` : ''} • {t('cash_start')}: {formatPrice(c.openCash)}
                    </T>
                    {c.close ? (
                      <T type="small" color={Colors.textMuted} numberOfLines={1}>
                        {t('cash_result', { exp: formatPrice(c.expected), got: formatPrice(c.counted ?? 0) })}
                      </T>
                    ) : null}
                  </View>
                  <T type="small" color={!c.close ? Colors.success : diff === 0 ? Colors.text : Colors.danger} style={{ fontWeight: '700' }}>
                    {!c.close ? t('rep_shift_now') : diff === 0 ? t('cash_diff_ok') : diff < 0 ? t('cash_diff_short', { sum: formatPrice(-diff) }) : t('cash_diff_over', { sum: formatPrice(diff) })}
                  </T>
                </Row>
              );
            })
          )}
        </View>

        {/* withdrawals */}
        <View style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="subheading">{t('rep_withdrawals')}</T>
            <T type="subheading">{formatPrice(wdRows.reduce((n, w) => n + w.amount, 0))}</T>
          </Row>
          {wdRows.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('rep_withdrawals_none')}
            </T>
          ) : (
            wdRows.map((w, i) => (
              <Row key={i} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {w.reason}
                    {w.note ? ` • ${w.note}` : ''}
                  </T>
                  <T type="small" color={Colors.textMuted} numberOfLines={1}>
                    {date(w.ts)} {clockTime(w.ts)} • {clubs.find((c) => c.id === w.clubId)?.name.replace('Seven Gym ', '')} • {w.staff} → {w.responsible}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T type="small" style={{ fontWeight: '700' }}>
                    {formatPrice(w.amount)}
                  </T>
                  <T type="small" color={w.confirmed ? Colors.success : Colors.textMuted}>
                    {w.confirmed ? t('wd_confirmed') : t('wd_unconfirmed')}
                  </T>
                </View>
              </Row>
            ))
          )}
        </View>

        {/* debts */}
        <View style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="subheading">{t('rep_debts')}</T>
            <T type="subheading" color={debts.length ? Colors.danger : Colors.textMuted}>
              {formatPrice(debts.reduce((s, x) => s + (x.remaining ?? 0), 0))}
            </T>
          </Row>
          {debts.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('rep_debts_none')}
            </T>
          ) : (
            debts.map((d) => (
              <Row key={d.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {d.name}
                  </T>
                  <T type="small" color={Colors.textMuted}>
                    {t('rep_since', { date: date(d.ts) })} • {clubs.find((c) => c.id === d.clubId)?.name.replace('Seven Gym ', '')}
                  </T>
                </View>
                <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                  {formatPrice(d.remaining ?? 0)}
                </T>
              </Row>
            ))
          )}
        </View>

        {/* refunds */}
        <View style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="subheading">{t('rep_refunds')}</T>
            <T type="subheading">{formatPrice(refunds.reduce((s, x) => s + x.amount, 0))}</T>
          </Row>
          {refunds.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('rep_refunds_none')}
            </T>
          ) : (
            refunds.map((r) => (
              <Row key={r.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {r.name}
                  </T>
                  <T type="small" color={Colors.textMuted} numberOfLines={1}>
                    {r.title} • {date(r.ts)}
                  </T>
                </View>
                <T type="small" style={{ fontWeight: '700' }}>
                  {formatPrice(r.amount)}
                </T>
              </Row>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <T type="small" color={Colors.textSecondary}>
        {label}
      </T>
    </Row>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <Row gap={8}>
      <View style={styles.track}>
        <View style={{ width: `${(value / max) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
      </View>
      <T type="small" style={{ width: 24, textAlign: 'right', fontWeight: '700' }}>
        {value}
      </T>
    </Row>
  );
}

/** Vertical bars with a label under each; the busiest column is highlighted. */
function Columns({ values, labels, small }: { values: number[]; labels: string[]; small?: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.cols}>
      {values.map((v, i) => (
        <View key={i} style={styles.col}>
          <T type="small" color={Colors.textMuted} style={{ fontSize: 9, height: 12 }}>
            {v || ''}
          </T>
          <View style={styles.colTrack}>
            <View style={{ height: `${(v / max) * 100}%`, backgroundColor: v === max && v > 0 ? OwnerAccent : '#E3D7A8', borderRadius: 3, minHeight: v ? 3 : 0 }} />
          </View>
          <T type="small" color={Colors.textSecondary} style={{ fontSize: small ? 9 : 11 }}>
            {labels[i]}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.surfaceAlt, overflow: 'hidden' },
  cols: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 120 },
  col: { flex: 1, alignItems: 'center', gap: 2, height: '100%' },
  colTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  line: { gap: Spacing.two, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
