import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { clockTime } from '@/components/shift-bar';
import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/data/mock';
import { cashClose, cashIn, cashOpen, cashOut, fetchCash, type CashDrawer } from '@/lib/api';
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
  const [mode, setMode] = useState<'in' | 'out' | 'close' | null>(null);
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
    fetchCash(staffCode, clubId).then((d) => live && d !== undefined && setDrawer(d));
    return () => {
      live = false;
    };
  }, [staffCode, clubId, now, sales.length, tick]);

  if (drawer === undefined) return null;

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

  const open = () => run(() => cashOpen(staffCode, { clubId, staff: who, amount: digits(amount) }), setDrawer);
  const put = () => run(() => cashIn(staffCode, { id: drawer!.id, amount: digits(amount), note, staff: who }), setDrawer);
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

      {drawer ? (
        <>
          <T type="display" color={Colors.success} style={{ fontSize: 30, lineHeight: 36 }}>
            {formatPrice(drawer.expected)}
          </T>
          <T type="small" color={Colors.textSecondary}>
            {t('cash_now')} • {clockTime(drawer.open)} {drawer.staff}
          </T>
          <View style={{ gap: 2 }}>
            <Line label={t('cash_start')} value={formatPrice(drawer.openCash)} />
            {drawer.added ? <Line label={t('cash_added')} value={`+${formatPrice(drawer.added)}`} /> : null}
            <Line label={t('cash_in')} value={`+${formatPrice(drawer.cashIn)}`} />
            {drawer.refunds ? <Line label={t('cash_refunds')} value={`−${formatPrice(drawer.refunds)}`} /> : null}
            {drawer.taken ? <Line label={t('cash_taken')} value={`−${formatPrice(drawer.taken)}`} /> : null}
          </View>
          {drawer.outs.map((o, i) => (
            <Row key={i} style={styles.out}>
              <View style={{ flex: 1 }}>
                <T type="small" numberOfLines={1}>
                  {clockTime(o.ts)} • {o.reason}
                  {o.note ? ` • ${o.note}` : ''}
                </T>
                <T type="small" color={Colors.textMuted} numberOfLines={1}>
                  {o.staff} → {o.responsible} • {o.confirmed ? t('wd_confirmed_by', { name: o.confirmedBy === 'owner' ? t('role_owner') : o.confirmedBy ?? '' }) : t('wd_unconfirmed')}
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
                <Button title={mode === 'in' ? t('cash_in_ok') : mode === 'out' ? t('cash_take_ok') : t('cash_close_ok')} onPress={mode === 'in' ? put : mode === 'out' ? take : close} disabled={busy || (mode === 'out' ? !digits(amount) || !reason || responsible.trim().length < 2 : mode === 'in' ? !digits(amount) : !amount)} style={{ flex: 1 }} />
                <Button title={t('cancel')} variant="secondary" onPress={() => setMode(null)} />
              </Row>
            </View>
          ) : (
            <Row gap={Spacing.two}>
              <Button title={t('cash_in_btn')} variant="secondary" onPress={() => setMode('in')} style={{ flex: 1 }} />
              <Button title={t('cash_take_btn')} variant="secondary" onPress={() => setMode('out')} style={{ flex: 1 }} />
              <Button title={t('cash_close_btn')} variant="danger" onPress={() => setMode('close')} style={{ flex: 1 }} />
            </Row>
          )}
        </>
      ) : (
        <>
          <T type="small" color={Colors.textSecondary}>
            {drawer === null && !msg ? t('cash_open_hint') : t('cash_closed')}
          </T>
          {input(t('cash_amount_ph'))}
          <Button title={t('cash_open_btn')} icon="lock-open-outline" onPress={open} disabled={busy || !amount} />
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
  out: { gap: Spacing.two, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  input: { height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.background },
});
