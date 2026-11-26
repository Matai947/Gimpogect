import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, clubs, formatPrice } from '@/data/mock';
import { hasCode, type Product } from '@/data/shop';
import { fetchRevisions, fetchStockIns, stockReceive, stockRevision, type Revision } from '@/lib/api';
import { makeXlsx } from '@/lib/xlsx';
import { clubStock, useApp, useCanManage, useCatalog, useI18n } from '@/store/app-context';

const ALMATY = 5 * 3600000;
// kept outside the component so the purity rule does not see the clock read in render
const today = () => Date.now();
const dmy = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10).split('-').reverse().join('.');
const hm = (ts: number) => new Date(ts + ALMATY).toISOString().slice(11, 16);

/** Downloads a real Excel table (.xlsx); a phone app without downloads gets the rows as text to share. */
function saveExcel(name: string, sheet: string, rows: Parameters<typeof makeXlsx>[1], widths: number[], header = 2) {
  if (Platform.OS !== 'web') return void Share.share({ message: rows.map((r) => r.map((c) => (c !== null && typeof c === 'object' ? c.v : c) ?? '').join(' | ')).join('\n') });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([makeXlsx(sheet, rows, { header, widths })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const revSums = (r: Revision) =>
  r.lines.reduce(
    (a, l) => {
      const d = l.was == null ? 0 : (l.n - l.was) * l.price;
      return d < 0 ? { ...a, short: a.short - d } : { ...a, over: a.over + d };
    },
    { short: 0, over: 0 },
  );

type Filter = 'all' | 'low' | 'zero' | 'untracked';
type Mode = 'count' | 'in';

/**
 * The club's stock. Any administrator receives goods (added to the shelf) and counts the shelf after the shift: the
 * program works out the shortage and surplus and shows them as a table. The manager also exports and sees every club.
 */
export default function StaffStock() {
  const { t, td } = useI18n();
  const { staff, staffCode, refreshContent, content } = useApp();
  const canManage = useCanManage();
  const { products } = useCatalog();
  const clubId = staff?.clubId ?? 'c1';
  const club = clubById(clubId)?.name ?? clubId;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // a count or a delivery being typed: product id -> the number typed
  const [mode, setMode] = useState<Mode | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [ins, setIns] = useState<Revision[]>([]);
  const [openRev, setOpenRev] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetchRevisions(staffCode).then((r) => live && r && setRevisions(r.filter((x) => x.clubId === clubId)));
    fetchStockIns(staffCode).then((r) => live && r && setIns(r.filter((x) => x.clubId === clubId)));
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

  const filled = products.filter((p) => mode && typed[p.id] !== undefined && typed[p.id] !== '' && (mode === 'count' || Number(typed[p.id]) > (p.stock ?? 0)));
  const total = list.reduce((a, p) => ({ q: a.q + (p.byWeight ? 0 : (p.stock ?? 0)), sum: a.sum + (p.byWeight ? Math.round(((p.stock ?? 0) * p.price) / 100) : (p.stock ?? 0) * p.price) }), { q: 0, sum: 0 });

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
    saveExcel(`Пересчёт ${club} ${dmy(r.ts)} ${hm(r.ts).replace(':', '-')}.xlsx`, 'Пересчёт', [
      [`Пересчёт • ${club} • ${dmy(r.ts)} ${hm(r.ts)} • ${r.staff}`],
      ['Товар', 'Цена, ₸', 'По учёту', 'Факт', 'Разница', 'Сумма разницы, ₸'],
      ...r.lines.map((l) => [l.name, l.price, l.was ?? '', l.n, l.was == null ? '' : l.n - l.was, l.was == null ? '' : (l.n - l.was) * l.price]),
      ['Недостача', '', '', '', '', -s.short],
      ['Излишек', '', '', '', '', s.over],
    ], [60, 10, 10, 10, 10, 16]);
  };
  const exportIn = (r: Revision) =>
    saveExcel(`Приёмка ${club} ${dmy(r.ts)} ${hm(r.ts).replace(':', '-')}.xlsx`, 'Приёмка', [
      [`Приёмка • ${club} • ${dmy(r.ts)} ${hm(r.ts)} • ${r.staff}`],
      ['Товар', 'Цена, ₸', 'Было', 'Пришло', 'Стало', 'Сумма, ₸'],
      ...r.lines.map((l) => [l.name, l.price, l.was ?? 0, l.n, (l.was ?? 0) + l.n, l.n * l.price]),
      ['Итого', '', '', r.lines.reduce((a, l) => a + l.n, 0), '', r.lines.reduce((a, l) => a + l.n * l.price, 0)],
    ], [60, 10, 10, 10, 10, 14]);

  const save = async () => {
    if (!filled.length || !mode) return;
    setBusy(true);
    const b = { clubId, staff: staff?.name ?? '', counts: filled.map((p) => ({ id: p.id, n: Number(typed[p.id]), name: p.name, price: p.price })) };
    // a delivery: the desk types what is in the hall now, the server works out how many came
    const r = mode === 'count' ? await stockRevision(staffCode, b) : await stockReceive(staffCode, { ...b, counts: b.counts.map(({ n, ...l }) => ({ ...l, has: n })) });
    setBusy(false);
    if (!r) return setMsg({ text: t('stk_fail'), bad: true });
    setMsg({ text: mode === 'count' ? '' : t('stk_in_saved', { n: filled.length, q: filled.reduce((a, p) => a + Number(typed[p.id]) - (p.stock ?? 0), 0) }), bad: false });
    // the count's result opens at once as a table
    const rev = mode === 'count' ? (r as { revision?: Revision }).revision : undefined;
    if (rev) setOpenRev(rev.ts);
    setMode(null);
    setTyped({});
    await refreshContent();
    setTick((n) => n + 1);
  };

  const start = (m: Mode) => {
    setMode(m);
    setTyped({});
    setMsg(null);
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

        {mode ? (
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            <Button title={mode === 'count' ? t('stk_save', { n: filled.length }) : t('stk_in_save', { n: filled.length })} icon="checkmark-done-outline" size="sm" onPress={() => void save()} disabled={busy || !filled.length} style={{ flexGrow: 1, backgroundColor: StaffAccent }} />
            <Button title={t('cancel')} size="sm" variant="ghost" onPress={() => setMode(null)} />
          </Row>
        ) : (
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            <Button title={t('stk_in_start')} icon="download-outline" size="sm" onPress={() => start('in')} style={{ flexGrow: 1, backgroundColor: StaffAccent }} />
            <Button title={t('stk_start')} icon="clipboard-outline" size="sm" onPress={() => start('count')} style={{ flexGrow: 1, backgroundColor: StaffAccent }} />
            {canManage ? <Button title={t('stk_excel')} icon="document-outline" size="sm" variant="secondary" onPress={exportNow} style={{ flexGrow: 1 }} /> : null}
          </Row>
        )}
        {mode ? (
          <T type="small" color={Colors.textMuted}>
            {mode === 'count' ? t('stk_count_hint') : t('stk_in_hint')}
          </T>
        ) : null}
        {msg?.text ? (
          <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
            {msg.text}
          </T>
        ) : null}

        {!mode && openRev ? (() => {
          const r = revisions.find((x) => x.ts === openRev);
          return r ? <RevTable r={r} onExcel={() => exportRevision(r)} onClose={() => setOpenRev(null)} /> : null;
        })() : null}

        {list.map((p) => {
          const v = typed[p.id];
          const d = mode === 'count' && v !== undefined && v !== '' ? Number(v) - (p.stock ?? 0) : 0;
          return (
            <Row key={p.id} gap={Spacing.two} style={styles.line}>
              <View style={{ flex: 1 }}>
                <T type="small" style={{ fontWeight: '700' }} numberOfLines={2}>
                  {p.name}
                </T>
                <T type="small" color={Colors.textMuted} numberOfLines={1}>
                  {td(p.category)} • {formatPrice(p.price)}
                  {d ? <T type="small" color={d < 0 ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>{` • ${d < 0 ? t('stk_short') : t('stk_over')} ${Math.abs(d)} ${unit(p)}`}</T> : null}
                  {mode === 'in' && v ? (
                    Number(v) > (p.stock ?? 0) ? (
                      <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>{` • ${t('stk_in_came', { n: Number(v) - (p.stock ?? 0) })}`}</T>
                    ) : (
                      <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>{` • ${t('stk_in_less')}`}</T>
                    )
                  ) : null}
                </T>
              </View>
              <T type="body" color={p.stock === 0 ? Colors.danger : p.stock === undefined ? Colors.textMuted : Colors.text} style={{ fontWeight: '800', minWidth: 52, textAlign: 'right' }}>
                {p.stock === undefined ? '—' : `${p.stock} ${unit(p)}`}
              </T>
              {mode ? (
                <TextInput
                  value={v ?? ''}
                  onChangeText={(x) => setTyped((c) => ({ ...c, [p.id]: x.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder={mode === 'count' ? t('stk_fact') : t('stk_in_fact')}
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
              <Pressable key={r.ts} onPress={() => setOpenRev((x) => (x === r.ts ? null : r.ts))} style={styles.line}>
                <Row gap={Spacing.two} style={{ alignItems: 'center' }}>
                  <T type="small" style={{ flex: 1 }}>
                    {t('stk_rev_line', { date: `${dmy(r.ts)} ${hm(r.ts)}`, staff: r.staff, n: r.lines.length, short: formatPrice(s.short), over: formatPrice(s.over) })}
                  </T>
                  <Ionicons name={openRev === r.ts ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
                </Row>
              </Pressable>
            );
          })
        )}

        <T type="label" color={Colors.textSecondary} style={{ marginTop: Spacing.three }}>
          {t('stk_in_history')}
        </T>
        {ins.length === 0 ? (
          <T type="small" color={Colors.textMuted}>
            {t('stk_in_none')}
          </T>
        ) : (
          ins.map((r) => (
            <Pressable key={r.ts} onPress={() => exportIn(r)} style={styles.line}>
              <Row gap={Spacing.two} style={{ alignItems: 'center' }}>
                <T type="small" style={{ flex: 1 }}>
                  {t('stk_in_line', { date: `${dmy(r.ts)} ${hm(r.ts)}`, staff: r.staff, n: r.lines.length, q: r.lines.reduce((a, l) => a + l.n, 0), sum: formatPrice(r.lines.reduce((a, l) => a + l.n * l.price, 0)) })}
                </T>
                <Ionicons name="download-outline" size={18} color={Colors.textMuted} />
              </Row>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** A count's result as a table: every product that did not match, the difference in pieces and in tenge, the totals. */
function RevTable({ r, onExcel, onClose }: { r: Revision; onExcel: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const s = revSums(r);
  const off = r.lines.filter((l) => l.was != null && l.n !== l.was);
  return (
    <View style={styles.table}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <T type="subheading">
          {t('stk_table')} • {dmy(r.ts)} {hm(r.ts)}
        </T>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </Pressable>
      </Row>
      <T type="small" color={Colors.textMuted}>
        {r.staff} • {r.lines.length}
      </T>
      {off.length === 0 ? (
        <T type="body" color={Colors.success} style={{ fontWeight: '700' }}>
          {t('stk_all_ok')}
        </T>
      ) : (
        <>
          <Row gap={6} style={styles.th}>
            <T type="small" style={[styles.c1, styles.h]}>{t('stk_t_item')}</T>
            <T type="small" style={[styles.cn, styles.h]}>{t('stk_t_books')}</T>
            <T type="small" style={[styles.cn, styles.h]}>{t('stk_t_fact')}</T>
            <T type="small" style={[styles.cn, styles.h]}>{t('stk_t_diff')}</T>
            <T type="small" style={[styles.cs, styles.h]}>{t('stk_t_sum')}</T>
          </Row>
          {off.map((l) => {
            const d = l.n - (l.was ?? 0);
            const c = d < 0 ? Colors.danger : Colors.success;
            return (
              <Row key={l.id} gap={6} style={styles.tr}>
                <T type="small" style={styles.c1} numberOfLines={2}>{l.name}</T>
                <T type="small" style={styles.cn}>{l.was}</T>
                <T type="small" style={styles.cn}>{l.n}</T>
                <T type="small" color={c} style={[styles.cn, { fontWeight: '800' }]}>{d > 0 ? `+${d}` : d}</T>
                <T type="small" color={c} style={[styles.cs, { fontWeight: '800' }]}>{formatPrice(d * l.price)}</T>
              </Row>
            );
          })}
        </>
      )}
      <Row style={{ justifyContent: 'space-between' }}>
        <T type="body" color={Colors.danger} style={{ fontWeight: '800' }}>{t('stk_t_short')}: {formatPrice(s.short)}</T>
        <T type="body" color={Colors.success} style={{ fontWeight: '800' }}>{t('stk_t_over')}: {formatPrice(s.over)}</T>
      </Row>
      <Button title={t('stk_xlsx')} icon="download-outline" size="sm" variant="secondary" onPress={onExcel} />
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
  table: { gap: 6, padding: Spacing.three, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: StaffAccent, backgroundColor: Colors.surface },
  th: { paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tr: { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, alignItems: 'center' },
  h: { fontWeight: '800', color: Colors.textSecondary },
  c1: { flex: 1, minWidth: 0 },
  cn: { width: 40, textAlign: 'right' },
  cs: { width: 76, textAlign: 'right' },
});
