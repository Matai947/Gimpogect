import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Avatar, Badge, Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice, plans } from '@/data/mock';
import type { PayMethod } from '@/data/owner';
import { MEMBER_DISCOUNT } from '@/data/shop';
import { useApp, useCatalog, useI18n, useMembers, type MemberInfo } from '@/store/app-context';

type Line = { key: string; title: string; price: number; qty: number; planId?: string; productId?: string };
type Receipt = { id: string; ts: number; lines: Line[]; subtotal: number; discount: number; total: number; method: PayMethod; client?: MemberInfo };

const PLANS_TAB = '__plans';
// Kept outside the component so the compiler's purity rule does not see Date.now() in render.
const newTs = () => Date.now();

export default function StaffPosScreen() {
  const { t, td } = useI18n();
  const { staff, recordSale, grantPlan } = useApp();
  const { products } = useCatalog();
  const { list: members } = useMembers();

  const [query, setQuery] = useState('');
  const [client, setClient] = useState<MemberInfo | null>(null);
  const [cat, setCat] = useState<string>('all');
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PayMethod>('kaspi');
  const [cash, setCash] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const goods = lines.filter((l) => !l.planId).reduce((s, l) => s + l.price * l.qty, 0);
  const discount = client?.active ? Math.round(goods * MEMBER_DISCOUNT) : 0;
  const total = subtotal - discount;
  const received = Number(cash.replace(/\D/g, '')) || 0;
  const change = method === 'cash' && received > total ? received - total : 0;

  const add = (l: Omit<Line, 'qty'>) => {
    setError(null);
    setLines((ls) => (ls.some((x) => x.key === l.key) ? ls.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)) : [...ls, { ...l, qty: 1 }]));
  };
  const bump = (key: string, d: number) => setLines((ls) => ls.map((x) => (x.key === key ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const pay = () => {
    if (lines.length === 0) return;
    const planLines = lines.filter((l) => l.planId);
    if (planLines.length && !client) {
      setError(t('pos_need_client'));
      return;
    }
    // Plans go through grantPlan so the client gets access and the owner sees the sale; goods are one receipt.
    planLines.forEach((l) => {
      for (let i = 0; i < l.qty; i++) grantPlan(client!.id, l.planId!);
    });
    const goodLines = lines.filter((l) => !l.planId);
    if (goodLines.length) {
      recordSale({ memberId: client?.id, name: client?.name ?? t('pos_walkin'), title: goodLines.map((l) => `${l.title} ×${l.qty}`).join(', '), kind: 'shop', amount: goods - discount, method });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const ts = newTs();
    setReceipt({ id: ts.toString(36).toUpperCase(), ts, lines, subtotal, discount, total, method, client: client ?? undefined });
  };

  const reset = () => {
    setReceipt(null);
    setLines([]);
    setClient(null);
    setQuery('');
    setCash('');
    setError(null);
  };

  const methodLabel: Record<PayMethod, string> = { kaspi: t('pay_kaspi'), card: t('pay_card'), cash: t('pay_cash'), split: t('pay_split'), desk: t('pay_desk') };

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
            {receipt.method === 'cash' && received > receipt.total ? (
              <>
                <Sum label={t('pos_received')} value={formatPrice(received)} />
                <Sum label={t('pos_change')} value={formatPrice(received - receipt.total)} />
              </>
            ) : null}
          </View>
          <Button title={t('pos_new')} icon="add" onPress={reset} style={{ backgroundColor: StaffAccent }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StaffHeader title={t('staff_tab_pos')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
        )}

        {/* catalogue */}
        <ChipRow>
          <Chip label={t('all')} active={cat === 'all'} onPress={() => setCat('all')} />
          <Chip label={t('pos_plans')} icon="card-outline" active={cat === PLANS_TAB} onPress={() => setCat(PLANS_TAB)} />
          {categories.map((c) => (
            <Chip key={c} label={td(c)} active={cat === c} onPress={() => setCat(c)} />
          ))}
        </ChipRow>
        <View style={styles.grid}>
          {cat === PLANS_TAB
            ? plans
                .filter((p) => !p.staffOnly && p.price > 0)
                .map((p) => (
                  <Pressable key={p.id} onPress={() => add({ key: `plan:${p.id}`, title: t('pos_plan_line', { name: td(p.name) }), price: p.price, planId: p.id })} style={styles.item}>
                    <Ionicons name="card-outline" size={20} color={StaffAccent} />
                    <T type="small" style={{ fontWeight: '600', marginTop: 6 }} numberOfLines={2}>
                      {td(p.name)}
                    </T>
                    <T type="small" color={Colors.textSecondary}>
                      {p.months} {t('months_short')}
                    </T>
                    <T type="subheading" color={StaffAccent}>
                      {formatPrice(p.price)}
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
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {(['kaspi', 'card', 'cash'] as PayMethod[]).map((m) => (
                <Chip key={m} label={methodLabel[m]} active={method === m} onPress={() => setMethod(m)} />
              ))}
            </Row>
            {method === 'cash' ? (
              <Row gap={Spacing.two}>
                <TextInput value={cash} onChangeText={setCash} placeholder={t('pos_received')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={[styles.searchInput, styles.cashInput]} />
                {change ? (
                  <T type="small" style={{ fontWeight: '700' }}>
                    {t('pos_change')}: {formatPrice(change)}
                  </T>
                ) : null}
              </Row>
            ) : null}
            {error ? (
              <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                {error}
              </T>
            ) : null}
            <Button title={t('pos_pay', { sum: formatPrice(total) })} icon="checkmark-circle-outline" size="lg" onPress={pay} style={{ backgroundColor: StaffAccent }} />
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
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: 320 },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 46 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },
  cashInput: { height: 42, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, paddingHorizontal: 12, flex: 0, width: 140 },
  match: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 8, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginTop: 6 },
  clientRow: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: StaffAccent, borderRadius: Radius.md, padding: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  item: { width: '48%', flexGrow: 1, minHeight: 96, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  cart: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.three, gap: Spacing.two, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  dash: { height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, marginVertical: 4 },
  receipt: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.three, gap: 8, borderWidth: 1, borderColor: Colors.border },
});
