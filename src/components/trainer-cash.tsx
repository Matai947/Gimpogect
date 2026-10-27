import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice, trainerById } from '@/data/mock';
import { useApp, useI18n, useNow, useRawSales } from '@/store/app-context';

const ALMATY = 5 * 3600000;
const dayOf = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10);

/** The trainers' money of the day at this club, kept apart from the main drawer: cash and non-cash, and how much for each trainer. */
export function TrainerCash({ accent }: { accent: string }) {
  const { t } = useI18n();
  const { staff } = useApp();
  const sales = useRawSales();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const clubId = staff?.clubId ?? 'c1';
  const today = dayOf(now);

  const d = useMemo(() => {
    const per = new Map<string, { cash: number; nonCash: number; n: number }>();
    let cash = 0;
    let nonCash = 0;
    for (const x of sales) {
      if (!x.trainerId || x.clubId !== clubId || dayOf(x.ts) !== today || !['personal', 'refund'].includes(x.kind)) continue;
      const v = x.kind === 'refund' ? -x.amount : x.amount;
      const r = per.get(x.trainerId) ?? { cash: 0, nonCash: 0, n: 0 };
      if (x.method === 'cash') {
        r.cash += v;
        cash += v;
      } else {
        r.nonCash += v;
        nonCash += v;
      }
      if (x.kind === 'personal') r.n += 1;
      per.set(x.trainerId, r);
    }
    return { cash, nonCash, per: [...per.entries()].sort((a, b) => b[1].cash + b[1].nonCash - (a[1].cash + a[1].nonCash)) };
  }, [sales, clubId, today]);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.head}>
        <Ionicons name="barbell-outline" size={20} color={accent} />
        <T type="subheading" style={{ flex: 1 }}>
          {t('tc_title')}
        </T>
        <T type="small" color={Colors.textSecondary}>
          {t('rep_day_cash')} {formatPrice(d.cash)}
        </T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <>
          <T type="small" color={Colors.textMuted}>
            {t('tc_hint')}
          </T>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="small" color={Colors.textSecondary}>
              {t('tc_cash')}
            </T>
            <T type="small" style={{ fontWeight: '700' }}>
              {formatPrice(d.cash)}
            </T>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="small" color={Colors.textSecondary}>
              {t('rep_day_noncash')}
            </T>
            <T type="small" style={{ fontWeight: '700' }}>
              {formatPrice(d.nonCash)}
            </T>
          </Row>
          {d.per.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('tc_none')}
            </T>
          ) : (
            d.per.map(([id, r]) => (
              <Row key={id} style={styles.line}>
                <T type="small" style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
                  {trainerById(id)?.name ?? id} {r.n ? `• ${r.n}` : ''}
                </T>
                <T type="small" color={Colors.textSecondary}>
                  {t('rep_day_cash')} {formatPrice(r.cash)} • {t('rep_day_noncash')} {formatPrice(r.nonCash)}
                </T>
              </Row>
            ))
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  line: { gap: Spacing.two, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
