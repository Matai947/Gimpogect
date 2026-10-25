import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/data/mock';
import type { PayMethod, Sale } from '@/data/owner';
import { refundRemote } from '@/lib/api';
import { useApp, useCanManage, useI18n, useMembers, useNow, useRawSales } from '@/store/app-context';

const ALMATY = 5 * 3600000;
const dayOf = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10);
const hm = (ts: number) => new Date(ts + ALMATY).toISOString().slice(11, 16);
const shiftDay = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10);
const dmy = (iso: string) => iso.split('-').reverse().join('.');

type Check = { key: string; ts: number; staff: string; memberId?: string; name: string; method: PayMethod; rows: Sale[]; total: number; debt: number; refunded: number; byMethod: Partial<Record<PayMethod, number>> };

/** The checks of one day at this desk (today unless another day is picked), newest first: sent again to the client, or cancelled. */
export function ReceiptsToday({ accent }: { accent: string }) {
  const { t, td } = useI18n();
  const { staff, staffCode, refreshSales, refreshContent } = useApp();
  const sales = useRawSales();
  const { byId } = useMembers();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [sure, setSure] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; text: string; bad: boolean } | null>(null);
  const clubId = staff?.clubId ?? 'c1';
  const today = dayOf(now);
  const canManage = useCanManage();
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked && picked < today ? picked : today;

  // One checkout writes several rows in the same instant (a plan, the goods, a debt): they are one check.
  const checks = useMemo(() => {
    const refundedOf = new Map<string, number>();
    sales.filter((x) => x.kind === 'refund' && x.refundOf).forEach((x) => refundedOf.set(x.refundOf!, (refundedOf.get(x.refundOf!) ?? 0) + x.amount));
    const rows = sales.filter((x) => ['plan', 'shop', 'personal', 'debt'].includes(x.kind) && x.clubId === clubId && dayOf(x.ts) === day).sort((a, b) => a.ts - b.ts);
    const out: Check[] = [];
    for (const x of rows) {
      const last = out[out.length - 1];
      if (last && x.ts - last.rows[last.rows.length - 1].ts < 5000 && last.staff === x.staff && (last.memberId ?? '') === (x.memberId ?? '')) last.rows.push(x);
      else out.push({ key: x.id, ts: x.ts, staff: x.staff, memberId: x.memberId, name: x.name, method: x.method, rows: [x], total: 0, debt: 0, refunded: 0, byMethod: {} });
    }
    for (const c of out) {
      for (const r of c.rows) {
        if (r.kind === 'debt') c.debt += r.amount;
        else {
          c.total += r.amount;
          c.byMethod[r.method] = (c.byMethod[r.method] ?? 0) + r.amount;
          c.refunded += Math.max(r.refunded ?? 0, refundedOf.get(r.id) ?? 0);
        }
      }
    }
    return out.reverse();
  }, [sales, clubId, day]);

  const methodLabel: Record<PayMethod, string> = { kaspi: t('pay_kaspi'), card: t('pay_card'), cash: t('pay_cash'), transfer: t('pay_transfer'), split: t('pay_split'), desk: t('pay_desk') };
  const paidRows = (c: Check) => c.rows.filter((r) => r.kind !== 'debt');
  const payOf = (c: Check) => {
    const m = Object.entries(c.byMethod) as [PayMethod, number][];
    return m.length > 1 ? m.map(([k, v]) => `${methodLabel[k] ?? k} ${formatPrice(v)}`).join(' + ') : (methodLabel[c.method] ?? c.method);
  };

  const send = (c: Check) => {
    const text = [
      t('receipt_text_head', { n: c.key.slice(-6).toUpperCase() }),
      `${dmy(day)} ${hm(c.ts)} • ${payOf(c)}`,
      ...paidRows(c).map((r) => `${td(r.title)} — ${formatPrice(r.amount)}`),
      `${t('pos_total')}: ${formatPrice(c.total)}`,
      ...(c.debt ? [`${t('pos_debt_title')}: ${formatPrice(c.debt)}`] : []),
    ].join('\n');
    const phone = (c.memberId ? byId(c.memberId)?.phone : '')?.replace(/\D/g, '');
    if (phone && phone.length >= 10) Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`).catch(() => {});
    else Share.share({ message: text }).catch(() => {});
  };

  const cancel = async (c: Check) => {
    if (sure !== c.key) {
      setSure(c.key);
      setTimeout(() => setSure((k) => (k === c.key ? null : k)), 5000);
      return;
    }
    setSure(null);
    setBusy(c.key);
    let ok = true;
    for (const r of paidRows(c)) if (r.amount - (r.refunded ?? 0) > 0 && !(await refundRemote(staffCode, r.id, t('refund_r1')))) ok = false;
    await refreshSales();
    await refreshContent();
    setBusy(null);
    const hadPlan = c.rows.some((r) => r.kind === 'plan');
    setMsg({ key: c.key, text: ok ? t('pos_cancel_done') + (hadPlan ? ' ' + t('pos_cancel_plan_note') : '') : t('pos_cancel_fail'), bad: !ok });
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          setOpen((v) => !v);
          if (!open) void refreshSales();
        }}
        style={styles.head}>
        <Ionicons name="receipt-outline" size={20} color={accent} />
        <T type="subheading" style={{ flex: 1 }}>
          {day === today ? t('rt_title', { n: checks.length }) : t('rt_title_day', { day: dmy(day), n: checks.length })}
        </T>
        <T type="small" color={Colors.textSecondary}>
          {formatPrice(checks.reduce((n, c) => n + c.total - c.refunded, 0))}
        </T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => setPicked(shiftDay(day, -1))} hitSlop={10} style={styles.arrow}>
            <Ionicons name="chevron-back" size={20} color={accent} />
          </Pressable>
          <Pressable onPress={() => setPicked(null)} hitSlop={6}>
            <T type="small" style={{ fontWeight: '700' }}>
              {dmy(day)}
              {day === today ? ` • ${t('rt_today')}` : ''}
            </T>
          </Pressable>
          <Pressable onPress={() => setPicked(shiftDay(day, 1))} disabled={day >= today} hitSlop={10} style={[styles.arrow, day >= today && { opacity: 0.3 }]}>
            <Ionicons name="chevron-forward" size={20} color={accent} />
          </Pressable>
        </Row>
      ) : null}
      {open ? (
        checks.length === 0 ? (
          <T type="small" color={Colors.textMuted}>
            {t('rt_none')}
          </T>
        ) : (
          checks.slice(0, 40).map((c) => {
            const cancelled = c.total > 0 && c.refunded >= c.total;
            return (
              <View key={c.key} style={[styles.check, cancelled && { opacity: 0.55 }]}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                      {hm(c.ts)} • {c.name}
                    </T>
                    <T type="small" color={Colors.textMuted} numberOfLines={1}>
                      {payOf(c)} • {c.staff}
                    </T>
                  </View>
                  <T type="body" style={{ fontWeight: '800', textDecorationLine: cancelled ? 'line-through' : 'none' }}>
                    {formatPrice(c.total)}
                  </T>
                </Row>
                {paidRows(c).map((r) => (
                  <Row key={r.id} style={{ justifyContent: 'space-between' }}>
                    <T type="small" color={Colors.textSecondary} style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
                      {td(r.title)}
                    </T>
                    <T type="small" color={Colors.textSecondary}>
                      {formatPrice(r.amount)}
                    </T>
                  </Row>
                ))}
                {c.debt ? (
                  <T type="small" color={Colors.danger}>
                    {t('pos_debt_title')}: {formatPrice(c.debt)}
                  </T>
                ) : null}
                {cancelled ? (
                  <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                    {t('rt_cancelled')}
                  </T>
                ) : c.refunded ? (
                  <T type="small" color={Colors.danger}>
                    {t('refunded_label', { sum: formatPrice(c.refunded) })}
                  </T>
                ) : null}
                {msg && msg.key === c.key ? (
                  <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
                    {msg.text}
                  </T>
                ) : null}
                <Row gap={Spacing.two}>
                  <Button title={t('receipt_send')} icon="paper-plane-outline" size="sm" variant="secondary" onPress={() => send(c)} style={{ flex: 1, paddingHorizontal: 8 }} />
                  {!cancelled && (day === today || canManage) ? (
                    <Button title={sure === c.key ? t('rt_cancel_sure') : t('pos_cancel')} icon="arrow-undo-outline" size="sm" variant="danger" onPress={() => void cancel(c)} disabled={busy === c.key} style={{ flex: 1, paddingHorizontal: 8 }} />
                  ) : null}
                </Row>
              </View>
            );
          })
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  arrow: { padding: 6, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  check: { gap: 4, paddingTop: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
