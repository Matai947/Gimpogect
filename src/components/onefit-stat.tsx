import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs } from '@/data/mock';
import { useApp, useI18n, useNow } from '@/store/app-context';

/** Owner: how many 1Fit visits there were, by club. The club is paid by 1Fit for these, so they are counted apart from sales. */
export function OneFitStat({ accent }: { accent: string }) {
  const { remote } = useApp();
  const { t } = useI18n();
  const now = useNow();
  const [days, setDays] = useState<7 | 30>(30);

  const stat = useMemo(() => {
    const from = new Date(now + 5 * 3600000 - days * 86400000).toISOString().slice(0, 10);
    const visits = remote.flatMap((c) => c.onefit ?? []).filter((v) => v.d >= from);
    return { total: visits.length, byClub: clubs.map((c) => ({ id: c.id, name: c.name.replace('Seven Gym ', ''), n: visits.filter((v) => v.c === c.id).length })) };
  }, [remote, days, now]);

  return (
    <View style={styles.card}>
      <T type="subheading">{t('onefit_stat_title')}</T>
      <ChipRow>
        <Chip label={t('period_7')} active={days === 7} onPress={() => setDays(7)} />
        <Chip label={t('period_30')} active={days === 30} onPress={() => setDays(30)} />
      </ChipRow>
      <T type="display" color={accent} style={{ fontSize: 34, lineHeight: 40 }}>
        {stat.total}
      </T>
      <Row gap={16}>
        {stat.byClub.map((c) => (
          <T key={c.id} type="small" color={Colors.textSecondary}>
            {c.name}: <T type="small" style={{ fontWeight: '700' }}>{c.n}</T>
          </T>
        ))}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
});
