import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { BarcodeSheet, cleanBarcode } from '@/components/barcode-sheet';
import { CashDrawerCard } from '@/components/cash-drawer';
import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Avatar, Badge, Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice, planLength, toISODate, trainers } from '@/data/mock';
import { settleRemote } from '@/lib/api';
import { promoByCode, promoDiscount } from '@/data/content';
import type { PayMethod } from '@/data/owner';
import { MEMBER_DISCOUNT } from '@/data/shop';
import { useApp, useCatalog, useI18n, useMembers, usePlans, useRawSales, type MemberInfo } from '@/store/app-context';

type Line = { key: string; title: string; price: number; qty: number; planId?: string; productId?: string; trainerId?: string };
type Receipt = { id: string; ts: number; lines: Line[]; subtotal: number; discount: number; total: number; debt?: number; method: PayMethod; client?: MemberInfo };

const PLANS_TAB = '__plans';
const TRAINERS_TAB = '__trainers';
// Kept outside the component so the compiler's purity rule does not see Date.now() in render.
const newTs = () => Date.now();

export default function StaffPosScreen() {
  const { t, td } = useI18n();
  const plans = usePlans();
  const { staff, staffCode, recordSale, grantPlan, refreshSales } = useApp();
  const rawSales = useRawSales();
  const { products } = useCatalog();
  const { list: members } = useMembers();

  const [query, setQuery] = useState('');
  const [client, setClient] = useState<MemberInfo | null>(null);
  const [cat, setCat] = useState<string>('all');
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [custom, setCustom] = useState('');
  const [cash, setCash] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [settle, setSettle] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const digits = q.replace(/\D/g, '');
    return members.filter((m) => m.name.toLowerCase().includes(q) || (digits.length >= 3 && m.phone.replace(/\D/g, '').includes(digits))).slice(0, 5);
  }, [members, query]);

  const categories = useMemo(() => Array.from(new Set(products.filter((p) => p.inStock).map((p) => p.category))), [products]);
  const shown = useMemo(() => products.filter((p) => p.inStock && (cat === 'all' || p.category === cat)), [products, cat]);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  // Member discount applies to goods only; plans are already priced for members.
  const goods = lines.filter((l) => !l.planId && !l.trainerId).reduce((s, l) => s + l.price * l.qty, 0);
  const memberDisc = client?.active ? Math.round(goods * MEMBER_DISCOUNT) : 0;
  // A promo code takes money off the whole check; it applies when it is better than the member discount.
  const promo = promoCode.trim() ? promoByCode(promoCode, toISODate(new Date()), staff?.clubId) : undefined;
  const promoDisc = promo ? promoDiscount(promo, subtotal) : 0;
  const usePromo = promoDisc > memberDisc;
  const discount = usePromo ? promoDisc : memberDisc;
  // With a promo every sale row carries its share of the discount; with the member discount only goods do.
  const share = usePromo && subtotal > 0 ? (subtotal - discount) / subtotal : 1;
  const total = subtotal - discount;
  const received = Number(cash.replace(/\D/g, '')) || 0;
  const change = received - total; // negative = not enough cash
  // Part payment: the client pays some now and the rest stays a debt on their card.
  const partialMode = partial && !!client && lines.length > 0;
  const debtAmt = partialMode ? Math.max(0, total - received) : 0;
  const cashShort = !partialMode && method === 'cash' && lines.length > 0 && received < total;
  const debts = client ? rawSales.filter((x) => x.kind === 'debt' && x.memberId === client.id && (x.remaining ?? 0) > 0).sort((a, b) => a.ts - b.ts) : [];
  const debtTotal = debts.reduce((sum, d) => sum + (d.remaining ?? 0), 0);
  const settleValue = Number(settle.replace(/\D/g, '')) || 0;

  const add = (l: Omit<Line, 'qty'>) => {
    setError(null);
    setLines((ls) => (ls.some((x) => x.key === l.key) ? ls.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)) : [...ls, { ...l, qty: 1 }]));
  };
  /** A scanned or typed barcode puts its product into the check. */
  const addByCode = (raw: string) => {
    const c = cleanBarcode(raw);
    setCode('');
    if (!c) return;
    const p = products.find((x) => x.barcode === c);
    if (!p) return setCodeMsg(t('bc_unknown', { code: c }));
    if (!p.inStock) return setCodeMsg(t('bc_out', { name: p.name }));
    setCodeMsg('');
    add({ key: `p:${p.id}`, title: p.name, price: p.price, productId: p.id });
  };
  const bump = (key: string, d: number) => setLines((ls) => ls.map((x) => (x.key === key ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const pay = () => {
    if (lines.length === 0 || cashShort) return;
    const planLines = lines.filter((l) => l.planId);
    const trainerLines = lines.filter((l) => l.trainerId);
    if ((planLines.length || trainerLines.length || debtAmt > 0) && !client) {
      setError(t('pos_need_client'));
      return;
    }
    // Plans go through grantPlan so the client gets access and the owner sees the sale; goods are one receipt.
    planLines.forEach((l) => {
      for (let i = 0; i < l.qty; i++) grantPlan(client!.id, l.planId!, usePromo ? Math.round(l.price * share) : undefined);
    });
    // Personal training: one sale per package, tied to the trainer for the owner's reports.
    trainerLines.forEach((l) => {
      for (let i = 0; i < l.qty; i++) recordSale({ memberId: client!.id, name: client!.name, title: l.title, kind: 'personal', amount: usePromo ? Math.round(l.price * share) : l.price, method, trainerId: l.trainerId });
    });
    const goodLines = lines.filter((l) => !l.planId && !l.trainerId);
    if (goodLines.length) {
      recordSale({ memberId: client?.id, name: client?.name ?? t('pos_walkin'), title: goodLines.map((l) => `${l.title} ×${l.qty}`).join(', '), kind: 'shop', amount: usePromo ? Math.round(goodLines.reduce((sum, l) => sum + l.price * l.qty, 0) * share) : goods - memberDisc, method });
    }
    if (debtAmt > 0) recordSale({ memberId: client!.id, name: client!.name, title: t('pos_debt_title'), kind: 'debt', amount: debtAmt, remaining: debtAmt, method });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const ts = newTs();
    setReceipt({ id: ts.toString(36).toUpperCase(), ts, lines, subtotal, discount, total, debt: debtAmt || undefined, method, client: client ?? undefined });
  };

  /** The client brings money for an old debt: oldest debts first. */
  const settleDebts = async () => {
    let left = Math.min(settleValue, debtTotal);
    if (!staffCode || left <= 0) return;
    for (const d of debts) {
      const part = Math.min(left, d.remaining ?? 0);
      if (part > 0 && (await settleRemote(staffCode, d.id, part, 'cash', staff?.name ?? ''))) left -= part;
    }
    await refreshSales();
    setSettle('');
    setError(null);
  };

  const reset = () => {
    setReceipt(null);
    setLines([]);
    setClient(null);
    setQuery('');
    setCash('');
    setError(null);
    setPartial(false);
    setPromoCode('');
  };

  const clientSearch = (
    <View>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('pos_client_ph')} placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
      </View>
      {matches.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => {
            setClient(m);
            setQuery('');
            setError(null);
          }}
          style={styles.match}>
          <Avatar name={m.name} size={30} />
          <T type="small" style={{ flex: 1 }} numberOfLines={1}>
            {m.name} • {m.phone}
          </T>
          {m.active ? <Badge label={`−${MEMBER_DISCOUNT * 100}%`} color={Colors.success} /> : null}
        </Pressable>
      ))}
    </View>
  );
  const needsClient = !client && lines.some((l) => l.planId || l.trainerId);

  const methodLabel: Record<PayMethod, string> = { kaspi: t('pay_kaspi'), card: t('pay_card'), cash: t('pay_cash'), transfer: t('pay_transfer'), split: t('pay_split'), desk: t('pay_desk') };

  /** The receipt as plain text: to the client's WhatsApp when the card has a phone, else the phone's share sheet. */
  const sendReceipt = () => {
    if (!receipt) return;
    const when = new Date(receipt.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const text = [
      t('receipt_text_head', { n: receipt.id }),
      `${when} • ${methodLabel[receipt.method]}`,
      ...receipt.lines.map((l) => `${l.title}${l.qty > 1 ? ` x${l.qty}` : ''} — ${formatPrice(l.price * l.qty)}`),
      ...(receipt.discount ? [`${t('pos_discount')}: −${formatPrice(receipt.discount)}`] : []),
      `${t('pos_total')}: ${formatPrice(receipt.total)}`,
      ...(receipt.debt ? [`${t('pos_debt_title')}: ${formatPrice(receipt.debt)}`] : []),
    ].join('\n');
    const phone = receipt.client?.phone.replace(/\D/g, '');
    if (phone && phone.length >= 10) Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`).catch(() => {});
    else Share.share({ message: text }).catch(() => {});
  };

  if (receipt) {
    return (
      <View style={styles.root}>
        <StaffHeader title={t('staff_tab_pos')} />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.receipt}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T type="heading">{t('pos_receipt', { n: receipt.id })}</T>
              <Badge label={t('pos_paid')} color={Colors.success} />
            </Row>
            <T type="small" color={Colors.textSecondary}>
              {new Date(receipt.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • {methodLabel[receipt.method]} • {t('pos_cashier', { name: staff?.name ?? '' })}
            </T>
            {receipt.client ? (
              <Row gap={Spacing.two} style={{ marginTop: 4 }}>
                <Avatar name={receipt.client.name} size={28} />
                <T type="small">{receipt.client.name}</T>
              </Row>
            ) : null}
            <View style={styles.dash} />
            {receipt.lines.map((l) => (
              <Row key={l.key} style={{ justifyContent: 'space-between' }}>
                <T type="small" style={{ flex: 1 }} numberOfLines={1}>
                  {l.title} {l.qty > 1 ? t('pos_qty', { n: l.qty }) : ''}
                </T>
                <T type="small" style={{ fontWeight: '700' }}>
                  {formatPrice(l.price * l.qty)}
                </T>
              </Row>
            ))}
            <View style={styles.dash} />
            {receipt.discount ? <Sum label={t('pos_discount')} value={`−${formatPrice(receipt.discount)}`} /> : null}
            <Sum label={t('pos_total')} value={formatPrice(receipt.total)} big />
            {receipt.debt ? <Sum label={t('pos_debt_title')} value={formatPrice(receipt.debt)} /> : null}
            {receipt.method === 'cash' && received >= receipt.total ? (
              <>
                <Sum label={t('pos_received')} value={formatPrice(received)} />
                <Sum label={t('pos_change')} value={formatPrice(received - receipt.total)} />
              </>
            ) : null}
          </View>
          <Row gap={Spacing.two}>
            <Button title={t('receipt_send')} icon="paper-plane-outline" variant="secondary" onPress={sendReceipt} style={{ flex: 1 }} />
            {Platform.OS === 'web' ? <Button title={t('receipt_print')} icon="print-outline" variant="secondary" onPress={() => window.print()} /> : null}
          </Row>
          <Button title={t('pos_new')} icon="add" onPress={reset} style={{ backgroundColor: StaffAccent }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StaffHeader title={t('staff_tab_pos')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CashDrawerCard />

        {/* client */}
        <T type="label" color={Colors.textSecondary}>
          {t('pos_client')}
        </T>
        {client ? (
          <Row gap={Spacing.two} style={styles.clientRow}>
            <Avatar name={client.name} size={36} />
            <View style={{ flex: 1 }}>
              <T type="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                {client.name}
              </T>
              <T type="small" color={Colors.textSecondary}>
                {client.phone}
                {client.active ? ` • ${t('pos_member_disc', { p: MEMBER_DISCOUNT * 100 })}` : ''}
              </T>
            </View>
            <Pressable onPress={() => setClient(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
            </Pressable>
          </Row>
        ) : (
          clientSearch
        )}
        {debts.length > 0 ? (
          <View style={styles.debtBox}>
            <T type="label" color={Colors.danger}>
              {t('pos_client_debt', { sum: formatPrice(debtTotal) })}
            </T>
            <Row gap={Spacing.two}>
              <TextInput value={settle} onChangeText={setSettle} placeholder={t('pos_settle_ph')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={[styles.searchInput, { height: 44, flex: 1 }]} />
              <Button title={t('pos_settle')} size="sm" onPress={() => void settleDebts()} disabled={settleValue <= 0} style={{ backgroundColor: StaffAccent }} />
            </Row>
          </View>
        ) : null}

        {/* barcode: the camera, or a USB scanner that types the code and presses Enter */}
        <Row gap={Spacing.two} style={styles.customRow}>
          <Ionicons name="barcode-outline" size={18} color={StaffAccent} />
          <TextInput value={code} onChangeText={setCode} onSubmitEditing={() => addByCode(code)} placeholder={t('bc_pos_ph')} placeholderTextColor={Colors.textMuted} returnKeyType="done" style={[styles.searchInput, { height: 40 }]} />
          <Button title={t('bc_scan')} icon="scan-outline" size="sm" onPress={() => setScanOpen(true)} style={{ backgroundColor: StaffAccent }} />
        </Row>
        {codeMsg ? (
          <T type="small" color={Colors.danger}>
            {codeMsg}
          </T>
        ) : null}
        <BarcodeSheet visible={scanOpen} onClose={() => setScanOpen(false)} onCode={addByCode} accent={StaffAccent} />

        {/* catalogue */}
        <ChipRow>
          <Chip label={t('all')} active={cat === 'all'} onPress={() => setCat('all')} />
          <Chip label={t('pos_plans')} icon="card-outline" active={cat === PLANS_TAB} onPress={() => setCat(PLANS_TAB)} />
          <Chip label={t('pos_trainers')} icon="person-outline" active={cat === TRAINERS_TAB} onPress={() => setCat(TRAINERS_TAB)} />
          {categories.map((c) => (
            <Chip key={c} label={td(c)} active={cat === c} onPress={() => setCat(c)} />
          ))}
        </ChipRow>
        {cat !== PLANS_TAB && cat !== TRAINERS_TAB ? (
          <Row gap={Spacing.two} style={styles.customRow}>
            <Ionicons name="pricetag-outline" size={18} color={StaffAccent} />
            <TextInput value={custom} onChangeText={setCustom} placeholder={t('pos_custom_ph')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={[styles.searchInput, { height: 40 }]} />
            <Button
              title={t('pos_custom_add')}
              size="sm"
              variant="secondary"
              onPress={() => {
                const v = Number(custom.replace(/\D/g, '')) || 0;
                if (v > 0) add({ key: `custom:${newTs()}`, title: t('pos_custom_line', { n: formatPrice(v) }), price: v });
                setCustom('');
              }}
            />
          </Row>
        ) : null}
        <View style={styles.grid}>
          {cat === TRAINERS_TAB
            ? trainers
                .filter((tr) => tr.pricePerSession > 0)
                .map((tr) => (
                  <Pressable key={tr.id} onPress={() => add({ key: `tr:${tr.id}`, title: t('pos_personal_line', { name: tr.name }), price: tr.pricePerSession, trainerId: tr.id })} style={styles.item}>
                    <Ionicons name="person-outline" size={20} color={StaffAccent} />
                    <T type="small" style={{ fontWeight: '600', marginTop: 6 }} numberOfLines={3}>
                      {tr.name}
                    </T>
                    <T type="small" color={Colors.textSecondary}>
                      {t('pos_per_month')}
                    </T>
                    <T type="subheading" color={StaffAccent}>
                      {formatPrice(tr.pricePerSession)}
                    </T>
                  </Pressable>
                ))
            : cat === PLANS_TAB
            ? plans
                .filter((p) => !p.staffOnly && (p.price > 0 || p.partner))
                .map((p) => (
                  <Pressable key={p.id} onPress={() => add({ key: `plan:${p.id}`, title: t('pos_plan_line', { name: td(p.name) }), price: p.price, planId: p.id })} style={styles.item}>
                    <Ionicons name="card-outline" size={20} color={StaffAccent} />
                    <T type="small" style={{ fontWeight: '600', marginTop: 6 }} numberOfLines={2}>
                      {td(p.name)}
                    </T>
                    <T type="small" color={Colors.textSecondary}>
                      {planLength(p)}
                    </T>
                    <T type="subheading" color={StaffAccent}>
                      {p.partner ? '1Fit' : formatPrice(p.price)}
                    </T>
                  </Pressable>
                ))
            : shown.map((p) => (
                <Pressable key={p.id} onPress={() => add({ key: `p:${p.id}`, title: p.name, price: p.price, productId: p.id })} style={styles.item}>
                  <T type="small" color={Colors.textMuted} numberOfLines={1}>
                    {td(p.category)}
                  </T>
                  <T type="small" style={{ fontWeight: '600', marginTop: 2 }} numberOfLines={2}>
                    {p.name}
                  </T>
                  <T type="subheading" style={{ marginTop: 'auto' }}>
                    {formatPrice(p.price)}
                  </T>
                </Pressable>
              ))}
        </View>
      </ScrollView>

      {/* cart */}
      <View style={styles.cart}>
        {lines.length === 0 ? (
          <T type="small" color={Colors.textMuted} style={{ textAlign: 'center', paddingVertical: 6 }}>
            {t('pos_cart_empty')}
          </T>
        ) : (
          <>
            <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
              {lines.map((l) => (
                <Row key={l.key} gap={Spacing.two} style={{ paddingVertical: 4 }}>
                  <T type="small" style={{ flex: 1 }} numberOfLines={1}>
                    {l.title}
                  </T>
                  <Pressable onPress={() => bump(l.key, -1)} style={styles.qtyBtn} hitSlop={6}>
                    <Ionicons name="remove" size={16} color={Colors.text} />
                  </Pressable>
                  <T type="small" style={{ fontWeight: '700', minWidth: 18, textAlign: 'center' }}>
                    {l.qty}
                  </T>
                  <Pressable onPress={() => bump(l.key, 1)} style={styles.qtyBtn} hitSlop={6}>
                    <Ionicons name="add" size={16} color={Colors.text} />
                  </Pressable>
                  <T type="small" style={{ fontWeight: '700', minWidth: 78, textAlign: 'right' }}>
                    {formatPrice(l.price * l.qty)}
                  </T>
                </Row>
              ))}
            </ScrollView>
            <View style={styles.dash} />
            {discount ? <Sum label={t('pos_discount')} value={`−${formatPrice(discount)}`} /> : null}
            <Sum label={t('pos_total')} value={formatPrice(total)} big />
            <Row gap={Spacing.two} style={{ alignItems: 'center' }}>
              <Ionicons name="pricetag-outline" size={16} color={StaffAccent} />
              <TextInput value={promoCode} onChangeText={setPromoCode} placeholder={t('pos_promo_ph')} placeholderTextColor={Colors.textMuted} autoCapitalize="characters" style={[styles.searchInput, { height: 38, flex: 1 }]} />
              {promoCode.trim() ? (
                <T type="small" color={promo ? Colors.success : Colors.danger} style={{ fontWeight: '700' }}>
                  {promo ? promo.title : t('pos_promo_bad')}
                </T>
              ) : null}
            </Row>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {(['cash', 'kaspi', 'card'] as PayMethod[]).map((m) => (
                <Chip key={m} label={methodLabel[m]} active={method === m} onPress={() => setMethod(m)} />
              ))}
              {client ? <Chip label={t('pos_partial')} icon="time-outline" active={partial} onPress={() => setPartial((v) => !v)} /> : null}
            </Row>
            {method === 'cash' || partialMode ? (
              <View style={styles.cashBox}>
                <T type="label" color={Colors.textSecondary}>
                  {partialMode ? t('pos_paid_now') : t('pos_given')}
                </T>
                <Row gap={Spacing.two}>
                  <TextInput value={cash} onChangeText={setCash} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={styles.cashInput} />
                  <T type="heading" color={Colors.textMuted}>
                    ₸
                  </T>
                </Row>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {[total, 5000, 10000, 20000].map((v, i) => (
                    <Chip key={i} label={i === 0 ? t('pos_exact') : formatPrice(v)} onPress={() => setCash(String(v))} />
                  ))}
                </Row>
                {received > 0 && !partialMode ? (
                  <Row style={[styles.changeRow, { backgroundColor: cashShort ? 'rgba(214,59,71,0.1)' : 'rgba(31,138,76,0.12)' }]}>
                    <T type="subheading" color={cashShort ? Colors.danger : Colors.success}>
                      {cashShort ? t('pos_short') : t('pos_change')}
                    </T>
                    <T type="display" color={cashShort ? Colors.danger : Colors.success} style={{ fontSize: 28, lineHeight: 34 }}>
                      {formatPrice(Math.abs(change))}
                    </T>
                  </Row>
                ) : null}
                {partialMode && debtAmt > 0 ? (
                  <Row style={[styles.changeRow, { backgroundColor: 'rgba(214,59,71,0.1)' }]}>
                    <T type="subheading" color={Colors.danger}>
                      {t('pos_debt_title')}
                    </T>
                    <T type="display" color={Colors.danger} style={{ fontSize: 28, lineHeight: 34 }}>
                      {formatPrice(debtAmt)}
                    </T>
                  </Row>
                ) : null}
              </View>
            ) : null}
            {needsClient ? (
              <View style={styles.cashBox}>
                <T type="label" color={Colors.danger}>
                  {t('pos_need_client')}
                </T>
                {clientSearch}
              </View>
            ) : null}
            {error ? (
              <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                {error}
              </T>
            ) : null}
            <Button title={t('pos_pay', { sum: formatPrice(partialMode && debtAmt > 0 ? received : total) })} icon="checkmark-circle-outline" size="lg" onPress={pay} disabled={cashShort || needsClient} style={{ backgroundColor: StaffAccent }} />
          </>
        )}
      </View>
    </View>
  );
}

function Sum({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T type={big ? 'subheading' : 'small'} color={big ? Colors.text : Colors.textSecondary}>
        {label}
      </T>
      <T type={big ? 'heading' : 'small'} style={{ fontWeight: '700' }}>
        {value}
      </T>
    </Row>
  );
}

const styles = StyleSheet.create({
  debtBox: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(214,59,71,0.4)', backgroundColor: 'rgba(214,59,71,0.06)' },
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: 320 },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 46 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },
  cashInput: { flex: 1, height: 52, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingHorizontal: 14, color: Colors.text, fontSize: 26, fontWeight: '800', borderWidth: 1, borderColor: Colors.border },
  cashBox: { gap: 8, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  changeRow: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm },
  customRow: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  match: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 8, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginTop: 6 },
  clientRow: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: StaffAccent, borderRadius: Radius.md, padding: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  item: { width: '48%', flexGrow: 1, minHeight: 96, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  cart: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.three, gap: Spacing.two, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  dash: { height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, marginVertical: 4 },
  receipt: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.three, gap: 8, borderWidth: 1, borderColor: Colors.border },
});
