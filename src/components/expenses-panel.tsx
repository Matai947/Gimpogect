import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatPrice } from '@/data/mock';
import { deleteExpense, deleteExpenseTpl, fetchExpenses, payExpense, saveExpenseTpl, type Expense, type ExpenseTpl } from '@/lib/api';
import { useApp, useI18n, useNow, useSales } from '@/store/app-context';

const ALMATY = 5 * 3600000;
const monthOf = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 7);
const shiftMonth = (m: string, d: number) => {
  const [y, mo] = m.split('-').map(Number);
  const x = new Date(Date.UTC(y, mo - 1 + d, 1));
  return x.toISOString().slice(0, 7);
};
const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;

type Form = { kind: 'tpl'; id?: string; clubId?: string; title: string; amount: string; day: string } | { kind: 'pay'; tpl?: ExpenseTpl; title: string; amount: string; method: 'cash' | 'noncash'; note: string };

/**
 * The club's expenses by month: the must-pays (rent, utilities, salaries) with paid / not yet, and one-off expenses.
 * The manager keeps them; the owner sees every club and the month's profit (revenue minus what was paid).
 */
export function ExpensesPanel({ accent, owner }: { accent: string; owner?: boolean }) {
  const { t } = useI18n();
  const { staff, staffCode } = useApp();
  const sales = useSales();
  const now = useNow();
  const [month, setMonth] = useState(monthOf(now));
  const [club, setClub] = useState<string>(owner ? 'all' : (staff?.clubId ?? 'c1'));
  const [data, setData] = useState<{ templates: ExpenseTpl[]; payments: Expense[] } | null>(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState<string | null>(null);
  const reload = () => setTick((n) => n + 1);

  useEffect(() => {
    let live = true;
    fetchExpenses(staffCode).then((d) => live && (d ? setData(d) : setMsg({ text: t('cash_fail'), bad: true })));
    return () => {
      live = false;
    };
  }, [staffCode, tick, t]);

  const inClub = (id: string) => club === 'all' || id === club;
  const v = useMemo(() => {
    const tpls = (data?.templates ?? []).filter((x) => inClub(x.clubId) && (!x.at || monthOf(x.at) <= month)).sort((a, b) => a.day - b.day);
    const pays = (data?.payments ?? []).filter((x) => x.month === month && inClub(x.clubId)).sort((a, b) => b.ts - a.ts);
    const paidOf = (id: string) => pays.filter((p) => p.tplId === id);
    const planned = tpls.reduce((n, x) => n + x.amount, 0);
    const paid = pays.reduce((n, x) => n + x.amount, 0);
    const left = tpls.filter((x) => paidOf(x.id).length === 0).reduce((n, x) => n + x.amount, 0);
    const revenue = sales.filter((s) => monthOf(s.ts) === month && inClub(s.clubId)).reduce((n, s) => n + s.amount, 0);
    return { tpls, pays, paidOf, planned, paid, left, revenue };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, month, club, sales]);

  const save = async () => {
    if (!form) return;
    const clubId = form.kind === 'pay' && form.tpl ? form.tpl.clubId : form.kind === 'tpl' && form.clubId ? form.clubId : club === 'all' ? clubs[0].id : club;
    setBusy(true);
    const ok =
      form.kind === 'tpl'
        ? await saveExpenseTpl(staffCode, { id: form.id, clubId, title: form.title.trim(), amount: digits(form.amount), day: digits(form.day) || 1 })
        : await payExpense(staffCode, { clubId, month, tplId: form.tpl?.id, title: form.title.trim(), amount: digits(form.amount), method: form.method, note: form.note.trim() });
    setBusy(false);
    if (!ok) return setMsg({ text: t('cash_fail'), bad: true });
    setMsg({ text: form.kind === 'tpl' ? t('ex_tpl_saved') : t('ex_paid', { sum: formatPrice(digits(form.amount)) }), bad: false });
    setForm(null);
    reload();
  };

  // a delete needs a second tap
  const remove = async (key: string, job: () => Promise<unknown>) => {
    if (sure !== key) {
      setSure(key);
      setTimeout(() => setSure((k) => (k === key ? null : k)), 4000);
      return;
    }
    setSure(null);
    if (await job()) reload();
  };

  const monthName = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return `${t('ex_months').split('|')[mo - 1]} ${y}`;
  };
  const cur = monthOf(now);
  const canAdd = club !== 'all';

  return (
    <View style={styles.card}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T type="subheading">{t('ex_title')}</T>
        <Row gap={6}>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} hitSlop={8} style={styles.arrow}>
            <Ionicons name="chevron-back" size={18} color={accent} />
          </Pressable>
          <T type="small" style={{ fontWeight: '700', minWidth: 96, textAlign: 'center' }}>
            {monthName(month)}
          </T>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= cur} hitSlop={8} style={[styles.arrow, month >= cur && { opacity: 0.3 }]}>
            <Ionicons name="chevron-forward" size={18} color={accent} />
          </Pressable>
        </Row>
      </Row>

      <ChipRow>
        {owner ? <Chip label={t('all')} active={club === 'all'} onPress={() => setClub('all')} /> : null}
        {clubs.map((c) => (
          <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={club === c.id} onPress={() => setClub(c.id)} />
        ))}
      </ChipRow>

      {/* the month in three numbers */}
      <View style={styles.sumRow}>
        <Sum label={t('ex_planned')} value={formatPrice(v.planned)} />
        <Sum label={t('ex_paid_total')} value={formatPrice(v.paid)} color={Colors.text} />
        <Sum label={t('ex_left')} value={formatPrice(v.left)} color={v.left ? Colors.warning : Colors.success} />
      </View>
      {owner ? (
        <View style={styles.profit}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="small" color={Colors.textSecondary}>
              {t('ex_revenue')}
            </T>
            <T type="small" style={{ fontWeight: '700' }}>
              {formatPrice(v.revenue)}
            </T>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="small" color={Colors.textSecondary}>
              {t('ex_spent')}
            </T>
            <T type="small" style={{ fontWeight: '700' }}>
              {v.paid ? '−' : ''}
              {formatPrice(v.paid)}
            </T>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="body" style={{ fontWeight: '800' }}>
              {t('ex_profit')}
            </T>
            <T type="body" color={v.revenue - v.paid >= 0 ? Colors.success : Colors.danger} style={{ fontWeight: '800' }}>
              {formatPrice(v.revenue - v.paid)}
            </T>
          </Row>
        </View>
      ) : null}

      {/* the must-pays */}
      <T type="label" color={Colors.textSecondary}>
        {t('ex_must')}
      </T>
      {v.tpls.length === 0 ? (
        <T type="small" color={Colors.textMuted}>
          {t('ex_must_none')}
        </T>
      ) : (
        v.tpls.map((x) => {
          const paid = v.paidOf(x.id);
          const sumPaid = paid.reduce((n, p) => n + p.amount, 0);
          const late = !paid.length && month === cur && new Date(now + ALMATY).getUTCDate() > x.day;
          return (
            <View key={x.id} style={styles.line}>
              <Ionicons name={paid.length ? 'checkmark-circle' : late ? 'alert-circle' : 'ellipse-outline'} size={20} color={paid.length ? Colors.success : late ? Colors.danger : Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                  {x.title}
                  {club === 'all' ? ` • ${clubs.find((c) => c.id === x.clubId)?.name.replace('Seven Gym ', '')}` : ''}
                </T>
                <T type="small" color={late ? Colors.danger : Colors.textMuted} numberOfLines={1}>
                  {paid.length ? t('ex_paid_by', { sum: formatPrice(sumPaid), name: paid[0].staff === 'owner' ? t('role_owner') : paid[0].staff }) : t('ex_due', { day: x.day, sum: formatPrice(x.amount) })}
                </T>
              </View>
              {!paid.length ? <Button title={t('ex_pay')} size="sm" onPress={() => setForm({ kind: 'pay', tpl: x, title: x.title, amount: String(x.amount), method: 'noncash', note: '' })} style={{ backgroundColor: accent, paddingHorizontal: 12 }} /> : null}
              <Pressable onPress={() => setForm({ kind: 'tpl', id: x.id, clubId: x.clubId, title: x.title, amount: String(x.amount), day: String(x.day) })} hitSlop={8}>
                <Ionicons name="create-outline" size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
          );
        })
      )}

      {/* one-off expenses of the month */}
      {v.pays.length ? (
        <>
          <T type="label" color={Colors.textSecondary}>
            {t('ex_history')}
          </T>
          {v.pays.map((p) => (
            <Row key={p.id} gap={Spacing.two} style={styles.line}>
              <View style={{ flex: 1 }}>
                <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                  {p.title}
                  {p.note ? ` • ${p.note}` : ''}
                </T>
                <T type="small" color={Colors.textMuted} numberOfLines={1}>
                  {new Date(p.ts + ALMATY).toISOString().slice(5, 10).split('-').reverse().join('.')} • {p.method === 'cash' ? t('pay_cash') : t('ex_noncash')} • {p.staff === 'owner' ? t('role_owner') : p.staff}
                  {club === 'all' ? ` • ${clubs.find((c) => c.id === p.clubId)?.name.replace('Seven Gym ', '')}` : ''}
                </T>
              </View>
              <T type="small" style={{ fontWeight: '700' }}>
                −{formatPrice(p.amount)}
              </T>
              <Pressable onPress={() => void remove('p' + p.id, () => deleteExpense(staffCode, p.id))} hitSlop={8}>
                <Ionicons name={sure === 'p' + p.id ? 'trash' : 'trash-outline'} size={18} color={sure === 'p' + p.id ? Colors.danger : Colors.textMuted} />
              </Pressable>
            </Row>
          ))}
        </>
      ) : null}

      {form ? (
        <View style={styles.form}>
          <T type="small" style={{ fontWeight: '700' }}>
            {form.kind === 'tpl' ? (form.id ? t('ex_tpl_edit') : t('ex_tpl_new')) : form.tpl ? t('ex_pay_title', { name: form.tpl.title }) : t('ex_once_new')}
          </T>
          {form.kind === 'tpl' || !form.tpl ? <TextInput value={form.title} onChangeText={(x) => setForm({ ...form, title: x })} placeholder={t('ex_title_ph')} placeholderTextColor={Colors.textMuted} maxLength={60} style={styles.input} /> : null}
          <TextInput value={form.amount} onChangeText={(x) => setForm({ ...form, amount: x.replace(/\D/g, '') })} placeholder={t('cash_amount_ph')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={styles.input} />
          {form.kind === 'tpl' ? (
            <TextInput value={form.day} onChangeText={(x) => setForm({ ...form, day: x.replace(/\D/g, '').slice(0, 2) })} placeholder={t('ex_day_ph')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={styles.input} />
          ) : (
            <>
              <ChipRow>
                <Chip label={t('ex_noncash')} active={form.method === 'noncash'} onPress={() => setForm({ ...form, method: 'noncash' })} />
                <Chip label={t('pay_cash')} active={form.method === 'cash'} onPress={() => setForm({ ...form, method: 'cash' })} />
              </ChipRow>
              {form.method === 'cash' ? (
                <T type="small" color={Colors.textMuted}>
                  {t('ex_cash_hint')}
                </T>
              ) : null}
              <TextInput value={form.note} onChangeText={(x) => setForm({ ...form, note: x })} placeholder={t('ex_note_ph')} placeholderTextColor={Colors.textMuted} maxLength={80} style={styles.input} />
            </>
          )}
          <Row gap={Spacing.two}>
            <Button title={t('save')} onPress={() => void save()} disabled={busy || !digits(form.amount) || form.title.trim().length < 2} style={{ flex: 1, backgroundColor: accent }} />
            <Button title={t('cancel')} variant="secondary" onPress={() => setForm(null)} />
          </Row>
          {form.kind === 'tpl' && form.id ? (
            <T type="small" color={Colors.danger} onPress={() => void remove('t' + form.id, async () => (await deleteExpenseTpl(staffCode, form.id!)) && (setForm(null), true))}>
              {sure === 't' + form.id ? t('ex_tpl_del_sure') : t('ex_tpl_del')}
            </T>
          ) : null}
        </View>
      ) : canAdd ? (
        <Row gap={Spacing.two}>
          <Button title={t('ex_add_must')} icon="repeat-outline" size="sm" variant="secondary" onPress={() => setForm({ kind: 'tpl', title: '', amount: '', day: '' })} style={{ flex: 1, paddingHorizontal: 8 }} />
          <Button title={t('ex_add_once')} icon="add-outline" size="sm" variant="secondary" onPress={() => setForm({ kind: 'pay', title: '', amount: '', method: 'cash', note: '' })} style={{ flex: 1, paddingHorizontal: 8 }} />
        </Row>
      ) : (
        <T type="small" color={Colors.textMuted}>
          {t('ex_pick_club')}
        </T>
      )}
      {msg ? (
        <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
          {msg.text}
        </T>
      ) : null}
    </View>
  );
}

function Sum({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T type="small" color={Colors.textMuted} numberOfLines={1}>
        {label}
      </T>
      <T type="body" color={color ?? Colors.textSecondary} style={{ fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  arrow: { padding: 4, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  sumRow: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  profit: { gap: 4, padding: Spacing.two, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(184,149,43,0.35)' },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  form: { gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  input: { height: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.surface },
});
