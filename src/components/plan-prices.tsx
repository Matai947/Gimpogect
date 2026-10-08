import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useApp, useI18n, usePlans } from '@/store/app-context';

/** Front desk: edit membership prices in place. Saved as you type, applied everywhere through usePlans(). */
export function PlanPrices({ accent }: { accent: string }) {
  const { t, td } = useI18n();
  const plans = usePlans();
  const { setPlanPrice } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T type="subheading">{t('plan_prices_title')}</T>
          <T type="small" color={Colors.textSecondary}>
            {t('plan_prices_sub')}
          </T>
        </View>
        <T type="label" color={accent} onPress={() => setOpen((v) => !v)} style={{ paddingVertical: 6 }}>
          {open ? t('done') : t('edit')}
        </T>
      </Row>
      {open
        ? plans
            .filter((p) => !p.trial && !p.staffOnly)
            .map((p) => (
              <Row key={p.id} gap={Spacing.two} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <T type="body" style={{ fontWeight: '600' }}>
                    {td(p.name)}
                  </T>
                  <T type="small" color={Colors.textMuted}>
                    {p.months} {t('months_short')}
                  </T>
                </View>
                <View style={styles.field}>
                  <T type="small" color={Colors.textMuted}>
                    {t('plan_price')}
                  </T>
                  <TextInput value={String(p.price)} onChangeText={(v) => setPlanPrice(p.id, Number(v.replace(/\D/g, '')) || 0, p.oldPrice)} keyboardType="number-pad" style={styles.input} />
                </View>
                <View style={styles.field}>
                  <T type="small" color={Colors.textMuted}>
                    {t('plan_old_price')}
                  </T>
                  <TextInput value={p.oldPrice ? String(p.oldPrice) : ''} onChangeText={(v) => setPlanPrice(p.id, p.price, Number(v.replace(/\D/g, '')) || undefined)} keyboardType="number-pad" placeholder="—" placeholderTextColor={Colors.textMuted} style={styles.input} />
                </View>
              </Row>
            ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5 },
  row: { paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-end' },
  field: { width: 96, gap: 2 },
  input: { height: 40, borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, color: Colors.text, fontSize: 15, fontWeight: '700' },
});
