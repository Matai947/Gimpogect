import { Fragment, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, formatDateHuman, formatPrice, toISODate } from '@/data/mock';
import type { PayMethod } from '@/data/owner';
import { useI18n, useSales } from '@/store/app-context';

export default function OwnerSales() {
  const { t, td } = useI18n();
  const sales = useSales();
  const [method, setMethod] = useState<PayMethod | 'all'>('all');
  const [shown, setShown] = useState(60);

  const methodLabel: Record<PayMethod, string> = { kaspi: t('pay_kaspi'), card: t('pay_card'), cash: t('pay_cash'), split: t('pay_split'), desk: t('pay_desk') };
  const filtered = useMemo(() => sales.filter((s) => method === 'all' || s.method === method), [sales, method]);
  const total = filtered.reduce((s, x) => s + x.amount, 0);
  const rows = filtered.slice(0, shown);

  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_sales')} />
      <ChipRow>
        <Chip label={t('all')} active={method === 'all'} onPress={() => setMethod('all')} />
        {(Object.keys(methodLabel) as PayMethod[]).map((m) => (
          <Chip key={m} label={methodLabel[m]} active={method === m} onPress={() => setMethod(m)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T type="small" color={Colors.textMuted}>
            {t('sales_n', { n: filtered.length })}
          </T>
          <T type="small" color={OwnerAccent} style={{ fontWeight: '700' }}>
            {t('sales_total', { sum: formatPrice(total) })}
          </T>
        </Row>
        {rows.length === 0 ? <T type="caption">{t('no_sales')}</T> : null}
        {rows.map((s, i) => {
          const day = toISODate(new Date(s.ts));
          const newDay = i === 0 || toISODate(new Date(rows[i - 1].ts)) !== day;
          return (
            <Fragment key={s.id}>
              {newDay ? (
                <T type="label" color={Colors.textSecondary} style={{ marginTop: Spacing.two }}>
                  {formatDateHuman(day)}
                </T>
              ) : null}
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T type="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                    {s.name}
                  </T>
                  <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                    {td(s.title)} • {clubById(s.clubId)?.name.replace('Gym Project ', '')}
                  </T>
                  <T type="small" color={Colors.textMuted} numberOfLines={1}>
                    {new Date(s.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} • {methodLabel[s.method]}
                    {s.staff ? ` • ${t('sale_by', { name: s.staff })}` : ''}
                  </T>
                </View>
                <T type="subheading" color={s.kind === 'shop' ? Colors.text : OwnerAccent}>
                  {formatPrice(s.amount)}
                </T>
              </View>
            </Fragment>
          );
        })}
        {filtered.length > shown ? (
          <T type="label" color={OwnerAccent} style={{ textAlign: 'center', padding: Spacing.three }} onPress={() => setShown((n) => n + 60)}>
            +{Math.min(60, filtered.length - shown)}
          </T>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
});
