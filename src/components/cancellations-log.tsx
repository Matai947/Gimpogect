import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs, formatPrice } from '@/data/mock';
import { useApp, useI18n, useNow, useRawSales } from '@/store/app-context';

const ALMATY = 5 * 3600000;
const when = (ts: number) => {
  const d = new Date(ts + ALMATY).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)} ${d.slice(11, 16)}`;
};

/** Manager and owner: every cancellation and refund — who did it, when, what, how much, why, and who rang the sale up. */
export function CancellationsLog({ accent, startOpen = false }: { accent: string; startOpen?: boolean }) {
  const { t, td } = useI18n();
  const { refreshSales } = useApp();
  const sales = useRawSales();
  const now = useNow();
  const [open, setOpen] = useState(startOpen);
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [who, setWho] = useState<string>('all');

  const rows = useMemo(() => {
    const byId = new Map(sales.map((x) => [x.id, x]));
    return sales
      .filter((x) => x.kind === 'refund' && x.ts >= now - days * 86400000)
      .map((r) => ({ r, sale: r.refundOf ? byId.get(r.refundOf) : undefined }))
      .sort((a, b) => b.r.ts - a.r.ts);
  }, [sales, now, days]);
  const people = useMemo(() => [...new Set(rows.map((x) => x.r.staff).filter(Boolean))], [rows]);
  const shown = rows.filter((x) => who === 'all' || x.r.staff === who);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          setOpen((v) => !v);
          if (!open) void refreshSales();
        }}
        style={styles.head}>
        <Ionicons name="arrow-undo-outline" size={20} color={Colors.danger} />
        <T type="subheading" style={{ flex: 1 }}>
          {t('cl_title', { n: rows.length })}
        </T>
        <T type="small" color={Colors.danger}>
          {formatPrice(rows.reduce((n, x) => n + x.r.amount, 0))}
        </T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <>
          <ChipRow>
            <Chip label={t('cl_today')} active={days === 1} onPress={() => setDays(1)} />
            <Chip label={t('period_7')} active={days === 7} onPress={() => setDays(7)} />
            <Chip label={t('period_30')} active={days === 30} onPress={() => setDays(30)} />
          </ChipRow>
          {people.length > 1 ? (
            <ChipRow>
              <Chip label={t('all')} active={who === 'all'} onPress={() => setWho('all')} />
              {people.map((p) => (
                <Chip key={p} label={p} active={who === p} onPress={() => setWho(p)} />
              ))}
            </ChipRow>
          ) : null}
          {shown.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('cl_none')}
            </T>
          ) : (
            shown.slice(0, 60).map(({ r, sale }) => (
              <View key={r.id} style={styles.row}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                      {when(r.ts)} • {t('cl_by', { name: r.staff || '—' })}
                    </T>
                    <T type="small" color={Colors.textSecondary} numberOfLines={2}>
                      {td(sale?.title ?? r.title.replace(/^Возврат: /, ''))} • {r.name}
                    </T>
                  </View>
                  <T type="body" color={Colors.danger} style={{ fontWeight: '800' }}>
                    −{formatPrice(r.amount)}
                  </T>
                </Row>
                <T type="small" color={Colors.textMuted} numberOfLines={2}>
                  {t('cl_reason', { reason: r.reason || '—' })}
                  {sale ? ` • ${t('cl_sold', { name: sale.staff || '—', time: when(sale.ts) })}` : ''}
                  {` • ${clubs.find((c) => c.id === r.clubId)?.name.replace('Seven Gym ', '') ?? ''}`}
                </T>
              </View>
            ))
          )}
        </>
      ) : null}
      <View style={{ height: 0, borderColor: accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  row: { gap: 2, paddingTop: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
