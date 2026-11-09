import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { clockTime } from '@/components/shift-bar';
import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatPrice } from '@/data/mock';
import { groupTotals } from '@/data/owner';
import { cashAccept, cashClose, cashIn, cashMove, cashOpen, cashOut, fetchCashMoves, fetchCashState, type CashDrawer, type CashMove } from '@/lib/api';
import { useApp, useCanManage, useI18n, useNow, useRawSales } from '@/store/app-context';

const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;

/** Cashier: open the drawer with a count, see the cash that should be in it, take money out, close with a count. */
export function CashDrawerCard() {
  const { t } = useI18n();
  const { staff, staffCode } = useApp();
  const now = useNow();
  const sales = useRawSales();
  const canManage = useCanManage();
  const clubId = staff?.clubId ?? 'c1';
  const who = staff?.name ?? '';
  const [drawer, setDrawer] = useState<CashDrawer | null | undefined>(undefined);
  const [last, setLast] = useState<(CashDrawer & { closedBy?: string }) | null>(null);
  const [mode, setMode] = useState<'in' | 'out' | 'close' | 'move' | null>(null);
  const [moveTo, setMoveTo] = useState(clubs.find((c) => c.id !== clubId)?.id ?? '');
  const [incoming, setIncoming] = useState<CashMove[]>([]);
  const clubName = (id?: string) => clubs.find((c) => c.id === id)?.name ?? id ?? '';
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [responsible, setResponsible] = useState('');
  const [ownerCode, setOwnerCode] = useState('');
  const reasons = [t('wd_r1'), t('wd_r2'), t('wd_r3'), t('wd_r4')];
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  // The balance is worked out by the server from the register's cash payments, so it follows every sale.
  useEffect(() => {
    if (!staffCode) return;
    let live = true;
    fetchCashState(staffCode, clubId).then((r) => live && r && (setDrawer(r.drawer), setLast(r.last ?? null)));
    fetchCashMoves(staffCode, 14).then((m) => live && m && setIncoming(m.filter((x) => x.to === clubId && x.status === 'pending')));
    return () => {
      live = false;
    };
  }, [staffCode, clubId, now, sales.length, tick]);

  if (drawer === undefined) return null;
  // a drawer left open from an earlier day keeps adding yesterday's money to today's
  const day = (ts: number) => new Date(ts + 5 * 3600000).toISOString().slice(0, 10);
  const openDay = drawer ? day(drawer.open) : '';
  const stale = !!drawer && openDay < day(now);

  // bar and plans taken in while a drawer was open, cash and non-cash
  const groups = (d: CashDrawer) => {
    const g = groupTotals(sales.filter((x) => x.clubId === clubId && x.ts >= d.open && x.ts <= (d.close ?? Infinity)), (id) => sales.find((x) => x.id === id));
    return (['bar', 'plans'] as const).map((k) => <Line key={k} label={`   ${t(k === 'bar' ? 'grp_bar' : 'grp_plans')}`} value={`${t('rep_day_cash')} ${formatPrice(g[k].cash)} • ${t('rep_day_noncash')} ${formatPrice(g[k].nonCash)}`} />);
  };

  const run = async (job: () => Promise<CashDrawer | null>, then?: (d: CashDrawer) => void) => {
    setBusy(true);
    const d = await job();
    setBusy(false);
    if (!d) return setMsg({ text: t('cash_fail'), bad: true });
    setMsg(null);
    setAmount('');
    setNote('');
    setReason('');
    setOwnerCode('');
    setMode(null);
    then?.(d);
  };

  // an empty amount opens with what the last shift counted at closing
  const open = () => run(() => cashOpen(staffCode, { clubId, staff: who, ...(amount ? { amount: digits(amount) } : {}) }), (d) => (setDrawer(d), setLast(null)));
  const put = () => run(() => cashIn(staffCode, { id: drawer!.id, amount: digits(amount), note, staff: who }), setDrawer);
  const send = () => run(() => cashMove(staffCode, { id: drawer!.id, to: moveTo, amount: digits(amount), responsible: responsible.trim(), note, staff: who }), (d) => (setDrawer(d), setMsg({ text: t('cm_sent', { sum: formatPrice(d.outs[d.outs.length - 1]?.amount ?? 0), club: clubName(moveTo) }), bad: false })));
  const accept = (m: CashMove) => run(() => cashAccept(staffCode, { id: drawer!.id, move: m.id, staff: who }), (d) => (setDrawer(d), setIncoming((l) => l.filter((x) => x.id !== m.id)), setMsg({ text: t('cm_accepted', { sum: formatPrice(m.amount) }), bad: false })));
  const take = async () => {
    setBusy(true);
    const r = await cashOut(staffCode, { id: drawer!.id, amount: digits(amount), reason, note, staff: who, responsible: responsible.trim(), ownerCode });
    setBusy(false);
    if (!r.drawer) return setMsg({ text: r.wrongCode ? t('wd_wrong_code') : digits(amount) > (drawer?.expected ?? 0) ? t('wd_too_much') : t('cash_fail'), bad: true });
    setMsg({ text: t('wd_done', { sum: formatPrice(digits(amount)) }), bad: false });
    setAmount('');
    setNote('');
    setReason('');
    setOwnerCode('');
    setMode(null);
    setDrawer(r.drawer);
  };
  const close = () =>
    run(
      () => cashClose(staffCode, { id: drawer!.id, counted: digits(amount), staff: who }),
      (d) => {
        const diff = (d.counted ?? 0) - d.expected;
        setDrawer(null);
        setLast(d);
        setMsg({ text: `${t('cash_result', { exp: formatPrice(d.expected), got: formatPrice(d.counted ?? 0) })}. ${diff === 0 ? t('cash_diff_ok') : diff < 0 ? t('cash_diff_short', { sum: formatPrice(-diff) }) : t('cash_diff_over', { sum: formatPrice(diff) })}`, bad: diff !== 0 });
      },
    );

  const input = (placeholder: string) => (
    <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={styles.input} />
  );

  return (
    <View style={styles.card}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T type="subheading">{t('cash_title')}</T>
        <T type="small" color={Colors.textMuted} onPress={() => setTick((n) => n + 1)}>
          {t('cash_refresh')}
        </T>
      </Row>

      {incoming.map((m) => (
        <View key={m.id} style={styles.incoming}>
          <T type="small" style={{ fontWeight: '700' }}>
            {t('cm_incoming', { sum: formatPrice(m.amount), club: clubName(m.from) })}
          </T>
          <T type="small" color={Colors.textSecondary}>
            {clockTime(m.ts)} • {m.staff} → {m.responsible}
            {m.note ? ` • ${m.note}` : ''}
          </T>
          {drawer ? <Button title={t('cm_accept')} icon="checkmark-circle-outline" size="sm" onPress={() => void accept(m)} disabled={busy} /> : <T type="small" color={Colors.textMuted}>{t('cm_open_first')}</T>}
        </View>
      ))}
      {drawer ? (
        <>
          <T type="display" color={Colors.success} style={{ fontSize: 30, lineHeight: 36 }}>
            {formatPrice(drawer.expected)}
          </T>
          <T type="small" color={Colors.textSecondary}>
            {t('cash_now')} • {t('cash_opened', { when: `${stale ? `${openDay.split('-').reverse().join('.')} ` : ''}${clockTime(drawer.open)}`, name: drawer.staff })}
          </T>
          {stale ? (
            <View style={styles.stale}>
              <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                {t('cash_stale', { day: openDay.split('-').reverse().join('.') })}
              </T>
            </View>
          ) : null}
          <View style={{ gap: 2 }}>
            <Line label={t('cash_start')} value={formatPrice(drawer.openCash)} />
            {drawer.added ? <Line label={t('cash_added')} value={`+${formatPrice(drawer.added)}`} /> : null}
            <Line label={t('cash_in')} value={`+${formatPrice(drawer.cashIn)}`} />
            {groups(drawer)}
            {(() => {
              // the till counts from its opening; when it was opened later in the day, the whole day is shown too
              const today = sales.filter((x) => x.clubId === clubId && day(x.ts) === day(now));
              if (!today.some((x) => x.ts < drawer.open)) return null;
              const g = groupTotals(today, (id) => sales.find((x) => x.id === id));
              const cash = g.bar.cash + g.plans.cash + g.trainers.cash;
              const non = g.bar.nonCash + g.plans.nonCash + g.trainers.nonCash;
              return <Line label={t('cash_day_total')} value={`${t('rep_day_cash')} ${formatPrice(cash)} • ${t('rep_day_noncash')} ${formatPrice(non)}`} />;
            })()}
            {drawer.refunds ? <Line label={t('cash_refunds')} value={`−${formatPrice(drawer.refunds)}`} /> : null}
            {drawer.taken ? <Line label={t('cash_taken')} value={`−${formatPrice(drawer.taken)}`} /> : null}
          </View>
          {drawer.outs.map((o, i) => (
            <Row key={i} style={styles.out}>
              <View style={{ flex: 1 }}>
                <T type="small" numberOfLines={1}>
                  {clockTime(o.ts)} • {o.move ? t('cm_to', { club: clubName(o.toClubId) }) : o.reason}
                  {o.note ? ` • ${o.note}` : ''}
                </T>
                <T type="small" color={Colors.textMuted} numberOfLines={1}>
                  {o.staff} → {o.responsible} • {o.move && !o.confirmed ? t('cm_in_way') : o.move ? t('cm_accepted_by', { name: o.confirmedBy ?? '' }) : o.confirmed ? t('wd_confirmed_by', { name: o.confirmedBy === 'owner' ? t('role_owner') : o.confirmedBy ?? '' }) : t('wd_unconfirmed')}
                </T>
              </View>
              <T type="small" style={{ fontWeight: '700' }}>
                −{formatPrice(o.amount)}
              </T>
            </Row>
          ))}
          {mode ? (
            <View style={{ gap: Spacing.two }}>
              {input(mode === 'close' ? t('cash_counted') : t('cash_amount_ph'))}
              {mode === 'move' ? (
                <>
                  <ChipRow>
                    {clubs.filter((c) => c.id !== clubId).map((c) => (
                      <Chip key={c.id} label={c.name} active={moveTo === c.id} onPress={() => setMoveTo(c.id)} />
                    ))}
                  </ChipRow>
                  <TextInput value={responsible} onChangeText={setResponsible} placeholder={t('cm_carrier')} placeholderTextColor={Colors.textMuted} maxLength={40} style={styles.input} />
                  <TextInput value={note} onChangeText={setNote} placeholder={t('cash_take_note')} placeholderTextColor={Colors.textMuted} maxLength={80} style={styles.input} />
                </>
              ) : null}
              {mode === 'in' ? <TextInput value={note} onChangeText={setNote} placeholder={t('cash_in_note')} placeholderTextColor={Colors.textMuted} maxLength={80} style={styles.input} /> : null}
              {mode === 'out' ? (
                <>
                  <ChipRow>
                    {reasons.map((r) => (
                      <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />
                    ))}
                  </ChipRow>
                  <TextInput value={note} onChangeText={setNote} placeholder={t('cash_take_note')} placeholderTextColor={Colors.textMuted} maxLength={80} style={styles.input} />
                  <TextInput value={responsible} onChangeText={setResponsible} placeholder={t('wd_responsible')} placeholderTextColor={Colors.textMuted} maxLength={40} style={styles.input} />
                  {canManage ? null : (
                    <>
                      <TextInput value={ownerCode} onChangeText={(v) => setOwnerCode(v.replace(/\D/g, ''))} placeholder={t('wd_owner_code')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" secureTextEntry maxLength={8} style={styles.input} />
                      <T type="small" color={Colors.textMuted}>
                        {t('wd_owner_code_hint')}
                      </T>
                    </>
                  )}
                </>
              ) : null}
              <Row gap={Spacing.two}>
                <Button title={mode === 'in' ? t('cash_in_ok') : mode === 'out' ? t('cash_take_ok') : mode === 'move' ? t('cm_send') : t('cash_close_ok')} onPress={mode === 'in' ? put : mode === 'out' ? take : mode === 'move' ? send : close} disabled={busy || (mode === 'out' ? !digits(amount) || !reason || responsible.trim().length < 2 : mode === 'move' ? !digits(amount) || !moveTo || responsible.trim().length < 2 : mode === 'in' ? !digits(amount) : !amount)} style={{ flex: 1 }} />
                <Button title={t('cancel')} variant="secondary" onPress={() => setMode(null)} />
              </Row>
            </View>
          ) : (
            <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
              <Button title={t('cash_in_short')} size="sm" variant="secondary" onPress={() => setMode('in')} style={{ flexGrow: 1, flexBasis: 90, paddingHorizontal: 6 }} />
              <Button title={t('cash_take_short')} size="sm" variant="secondary" onPress={() => setMode('out')} style={{ flexGrow: 1, flexBasis: 90, paddingHorizontal: 6 }} />
              {clubs.length > 1 ? <Button title={t('cm_short')} size="sm" variant="secondary" onPress={() => setMode('move')} style={{ flexGrow: 1, flexBasis: 90, paddingHorizontal: 6 }} /> : null}
              <Button title={t('cash_close_short')} size="sm" variant="danger" onPress={() => setMode('close')} style={{ flexGrow: 1, flexBasis: 90, paddingHorizontal: 6 }} />
            </Row>
          )}
        </>
      ) : (
        <>
          {last ? (
            <View style={styles.report}>
              <T type="body" style={{ fontWeight: '800' }}>
                {t('cash_report', { from: clockTime(last.open), to: clockTime(last.close ?? last.open), day: day(last.open).slice(5).split('-').reverse().join('.') })}
              </T>
              <T type="small" color={Colors.textMuted}>
                {last.staff}
                {last.closedBy && last.closedBy !== last.staff ? ` → ${last.closedBy}` : ''}
              </T>
              <Line label={t('cash_start')} value={formatPrice(last.openCash)} />
              {last.added ? <Line label={t('cash_added')} value={`+${formatPrice(last.added)}`} /> : null}
              <Line label={t('cash_in')} value={`+${formatPrice(last.cashIn)}`} />
              {groups(last)}
              {last.refunds ? <Line label={t('cash_refunds')} value={`−${formatPrice(last.refunds)}`} /> : null}
              {last.taken ? <Line label={t('cash_taken')} value={`−${formatPrice(last.taken)}`} /> : null}
              <Line label={t('cash_expected')} value={formatPrice(last.expected)} />
              <Line label={t('cash_counted_l')} value={formatPrice(last.counted ?? 0)} />
              {(last.counted ?? 0) !== last.expected ? (
                <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                  {(last.counted ?? 0) < last.expected ? t('cash_diff_short', { sum: formatPrice(last.expected - (last.counted ?? 0)) }) : t('cash_diff_over', { sum: formatPrice((last.counted ?? 0) - last.expected) })}
                </T>
              ) : null}
            </View>
          ) : null}
          <T type="small" color={Colors.textSecondary}>
            {drawer === null && !msg && !last ? t('cash_open_hint') : t('cash_closed')}
          </T>
          {input(last ? t('cash_open_keep', { sum: formatPrice(last.counted ?? 0) }) : t('cash_amount_ph'))}
          <Button title={t('cash_open_btn')} icon="lock-open-outline" onPress={open} disabled={busy || (!amount && !last)} />
        </>
      )}
      {msg ? (
        <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
          {msg.text}
        </T>
      ) : null}
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T type="small" color={Colors.textSecondary}>
        {label}
      </T>
      <T type="small" style={{ fontWeight: '700' }}>
        {value}
      </T>
    </Row>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  report: { gap: 2, padding: Spacing.two, borderRadius: Radius.md, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  stale: { padding: Spacing.two, borderRadius: Radius.md, backgroundColor: 'rgba(214,59,71,0.08)', borderWidth: 1, borderColor: 'rgba(214,59,71,0.4)' },
  incoming: { gap: 4, padding: Spacing.two, borderRadius: Radius.md, backgroundColor: 'rgba(31,138,76,0.1)', borderWidth: 1, borderColor: Colors.success },
  out: { gap: Spacing.two, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  input: { height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.background },
});
