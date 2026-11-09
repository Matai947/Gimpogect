import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, clubs, formatPrice } from '@/data/mock';
import { hasCode, type Product } from '@/data/shop';
import { fetchRevisions, stockRevision, type Revision } from '@/lib/api';
import { makeXlsx } from '@/lib/xlsx';
import { clubStock, useApp, useCatalog, useI18n } from '@/store/app-context';

const ALMATY = 5 * 3600000;
// kept outside the component so the purity rule does not see the clock read in render
const today = () => Date.now();
const dmy = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10).split('-').reverse().join('.');

/** Downloads a real Excel table (.xlsx); a phone app without downloads gets the rows as text to share. */
function saveExcel(name: string, sheet: string, rows: Parameters<typeof makeXlsx>[1], widths: number[], header = 2) {
  if (Platform.OS !== 'web') return void Share.share({ message: rows.map((r) => r.map((c) => (c !== null && typeof c === 'object' ? c.v : c) ?? '').join(' | ')).join('\n') });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([makeXlsx(sheet, rows, { header, widths })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

type Filter = 'all' | 'low' | 'zero' | 'untracked';

/** The manager's stock: what each product has on this club's shelf, the export, and the month-end stocktake. */
export default function StaffStock() {
  const { t, td } = useI18n();
  const { staff, staffCode, refreshContent, content } = useApp();
  const { products } = useCatalog();
  const clubId = staff?.clubId ?? 'c1';
  const club = clubById(clubId)?.name ?? clubId;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // the stocktake: product id -> what was counted on the shelf (typed)
  const [count, setCount] = useState<Record<string, string> | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetchRevisions(staffCode).then((r) => live && r && setRevisions(r.filter((x) => x.clubId === clubId)));
    return () => {
      live = false;
    };
  }, [staffCode, clubId, tick]);

  const unit = (p: Product) => (p.byWeight ? 'г' : t('stock_short', { n: '' }).trim());
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (filter === 'low' ? p.stock !== undefined && p.stock > 0 && p.stock <= 3 : filter === 'zero' ? p.stock === 0 : filter === 'untracked' ? p.stock === undefined : true))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || hasCode(p, q) : true))
      .sort((a, b) => a.category.localeCompare(b.category, 'ru') || a.name.localeCompare(b.name, 'ru'));
  }, [products, filter, query]);

  const counted = products.filter((p) => count && count[p.id] !== undefined && count[p.id] !== '');
  const diffOf = (p: Product) => Number(count?.[p.id]) - (p.stock ?? 0);
  const total = list.reduce((a, p) => ({ q: a.q + (p.byWeight ? 0 : (p.stock ?? 0)), sum: a.sum + (p.byWeight ? Math.round(((p.stock ?? 0) * p.price) / 100) : (p.stock ?? 0) * p.price) }), { q: 0, sum: 0 });

  const revSums = (r: Revision) =>
    r.lines.reduce((a, l) => {
      const d = l.was == null ? 0 : (l.n - l.was) * l.price;
      return d < 0 ? { ...a, short: a.short - d } : { ...a, over: a.over + d };
    }, { short: 0, over: 0 });

  // laid out like an accounting «stock in warehouses» report: every club a column, then the total
  const exportNow = () => {
    const shelves = clubs.map((c) => ({ name: c.name.replace('Seven Gym ', ''), stock: clubStock(content.stock, c.id) ?? {} }));
    const rows = list.map((p) => {
      const per = shelves.map((c) => (p.id in c.stock ? Number(c.stock[p.id]) || 0 : null));
      const sum = per.some((n) => n !== null) ? per.reduce<number>((a, n) => a + (n ?? 0), 0) : null;
      return { p, per, sum };
    });
    const totals = shelves.map((_, k) => rows.reduce((a, r) => a + (r.p.byWeight ? 0 : (r.per[k] ?? 0)), 0));
    saveExcel(
      `Остатки товаров ${dmy(today())}.xlsx`,
      'Остатки',
      [
        [{ v: 'Остатки товаров на складах', s: 'title' }],
        [`Дата: ${dmy(today())}`],
        [`Склады: ${clubs.map((c) => c.name).join(', ')}`],
        [],
        [{ v: 'Штрихкод', s: 'head' }, { v: 'Наименование', s: 'head' }, { v: 'Ед. изм.', s: 'head' }, ...shelves.map((c) => ({ v: c.name, s: 'head' as const })), { v: 'Итого', s: 'head' }],
        ...rows.map(({ p, per, sum }) => [
          { v: p.barcode ?? '', s: 'cell' as const },
          { v: p.name, s: 'cell' as const },
          { v: p.byWeight ? 'г' : 'шт', s: 'cell' as const },
          ...per.map((n) => ({ v: n, s: 'num' as const })),
          { v: sum, s: 'num' as const },
        ]),
        [{ v: 'Итого', s: 'totalText' }, { v: '', s: 'totalText' }, { v: 'шт', s: 'totalText' }, ...totals.map((n) => ({ v: n, s: 'total' as const })), { v: totals.reduce((a, n) => a + n, 0), s: 'total' }],
      ],
      [16, 62, 8, ...shelves.map(() => 12), 12],
      5,
    );
  };

  const exportRevision = (r: Revision) => {
    const s = revSums(r);
    saveExcel(`Ревизия ${club} ${dmy(r.ts)}.xlsx`, 'Ревизия', [
      [`Ревизия • ${club} • ${dmy(r.ts)} • ${r.staff}`],
      ['Товар', 'Цена, ₸', 'По учёту', 'Факт', 'Разница', 'Сумма разницы, ₸'],
      ...r.lines.map((l) => [l.name, l.price, l.was ?? '', l.n, l.was == null ? '' : l.n - l.was, l.was == null ? '' : (l.n - l.was) * l.price]),
      ['Недостача', '', '', '', '', -s.short],
      ['Излишек', '', '', '', '', s.over],
    ], [60, 10, 10, 10, 10, 16]);
  };

  const save = async () => {
    if (!counted.length) return;
    setBusy(true);
    const ok = await stockRevision(staffCode, { clubId, staff: staff?.name ?? '', counts: counted.map((p) => ({ id: p.id, n: Number(count![p.id]), name: p.name, price: p.price })) });
    setBusy(false);
    if (!ok) return setMsg({ text: t('stk_fail'), bad: true });
    const diff = counted.reduce((n, p) => n + (p.stock === undefined || p.byWeight ? 0 : diffOf(p) * p.price), 0);
    setMsg({ text: t('stk_saved', { n: counted.length, sum: formatPrice(diff) }), bad: false });
    setCount(null);
    await refreshContent();
    setTick((n) => n + 1);
  };


  return (
    <View style={styles.root}>
      <StaffHeader title={t('stk_title')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder={t('stk_search')} placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
        </View>
        <ChipRow>
          {(['all', 'low', 'zero', 'untracked'] as const).map((f) => (
            <Chip key={f} label={t(f === 'all' ? 'stk_all' : f === 'low' ? 'stk_low' : f === 'zero' ? 'stk_zero' : 'stk_untracked')} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ChipRow>
        <T type="small" color={Colors.textSecondary}>
          {club} • {t('stk_sum', { n: list.length, q: total.q, sum: formatPrice(total.sum) })}
        </T>

        <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
          <Button title={t('stk_excel')} icon="download-outline" size="sm" variant="secondary" onPress={exportNow} style={{ flexGrow: 1 }} />
          {count ? (
            <>
              <Button title={t('stk_save', { n: counted.length })} icon="checkmark-done-outline" size="sm" onPress={() => void save()} disabled={busy || !counted.length} style={{ flexGrow: 1, backgroundColor: StaffAccent }} />
              <Button title={t('stk_cancel')} size="sm" variant="ghost" onPress={() => setCount(null)} />
            </>
          ) : (
            <Button title={t('stk_start')} icon="clipboard-outline" size="sm" onPress={() => (setCount({}), setMsg(null))} style={{ flexGrow: 1, backgroundColor: StaffAccent }} />
          )}
        </Row>
        {count ? (
          <T type="small" color={Colors.textMuted}>
            {t('stk_hint')}
          </T>
        ) : null}
        {msg ? (
          <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
            {msg.text}
          </T>
        ) : null}

        {list.map((p) => {
          const typed = count?.[p.id];
          const d = typed !== undefined && typed !== '' ? diffOf(p) : 0;
          return (
            <Row key={p.id} gap={Spacing.two} style={styles.line}>
              <View style={{ flex: 1 }}>
                <T type="small" style={{ fontWeight: '700' }} numberOfLines={2}>
                  {p.name}
                </T>
                <T type="small" color={Colors.textMuted} numberOfLines={1}>
                  {td(p.category)} • {formatPrice(p.price)}
                  {d ? <T type="small" color={d < 0 ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>{` • ${d < 0 ? t('stk_short') : t('stk_over')} ${Math.abs(d)} ${unit(p)}`}</T> : null}
                </T>
              </View>
              <T type="body" color={p.stock === 0 ? Colors.danger : p.stock === undefined ? Colors.textMuted : Colors.text} style={{ fontWeight: '800', minWidth: 52, textAlign: 'right' }}>
                {p.stock === undefined ? '—' : `${p.stock} ${unit(p)}`}
              </T>
              {count ? (
                <TextInput
                  value={typed ?? ''}
                  onChangeText={(v) => setCount((c) => ({ ...(c ?? {}), [p.id]: v.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder={t('stk_fact')}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.fact}
                />
              ) : null}
            </Row>
          );
        })}

        <T type="label" color={Colors.textSecondary} style={{ marginTop: Spacing.three }}>
          {t('stk_history')}
        </T>
        {revisions.length === 0 ? (
          <T type="small" color={Colors.textMuted}>
            {t('stk_none')}
          </T>
        ) : (
          revisions.map((r) => {
            const s = revSums(r);
            return (
              <Pressable key={r.ts} onPress={() => exportRevision(r)} style={styles.line}>
                <Row gap={Spacing.two} style={{ alignItems: 'center' }}>
                  <T type="small" style={{ flex: 1 }}>
                    {t('stk_rev_line', { date: dmy(r.ts), staff: r.staff, n: r.lines.length, short: formatPrice(s.short), over: formatPrice(s.over) })}
                  </T>
                  <Ionicons name="download-outline" size={18} color={Colors.textMuted} />
                </Row>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, height: 46, paddingHorizontal: Spacing.three, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  searchInput: { flex: 1, color: Colors.text, fontSize: 16 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  fact: { width: 72, height: 40, borderRadius: Radius.md, borderWidth: 1, borderColor: StaffAccent, paddingHorizontal: 8, color: Colors.text, fontSize: 16, textAlign: 'center', backgroundColor: Colors.surface },
});
