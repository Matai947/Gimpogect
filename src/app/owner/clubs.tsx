import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { Fact, hm } from '@/components/member-result';
import { ProgressBar, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, clubById, clubs, formatPrice, occupancyLabel } from '@/data/mock';
import { SESSION_MS, useApp, useI18n, useMembers, useNow, usePresence, useSales } from '@/store/app-context';

export default function OwnerClubs() {
  const { t } = useI18n();
  const { staffLog } = useApp();
  const now = useNow();
  const present = usePresence();
  const { list } = useMembers();
  const sales = useSales();

  const revenue = useMemo(() => {
    const from = addDays(new Date(), -29);
    from.setHours(0, 0, 0, 0);
    const m = new Map<string, number>();
    sales.filter((s) => s.ts >= from.getTime()).forEach((s) => m.set(s.clubId, (m.get(s.clubId) ?? 0) + s.amount));
    return m;
  }, [sales]);

  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_clubs_o')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {clubs.map((c) => {
          const mine = list.filter((m) => m.homeClubId === c.id);
          const occ = occupancyLabel(c.occupancy);
          return (
            <View key={c.id} style={styles.card}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T type="heading" style={{ flex: 1 }}>
                  {c.name.replace('Gym Project ', '')}
                </T>
                <T type="small" color={Colors.textSecondary}>
                  {c.city}
                </T>
              </Row>
              <View style={styles.grid}>
                <Fact label={t('clubs_revenue')} value={formatPrice(revenue.get(c.id) ?? 0)} accent />
                <Fact label={t('present_title')} value={String(present.filter((p) => p.clubId === c.id).length)} accent />
                <Fact label={t('clubs_clients')} value={String(mine.length)} />
                <Fact label={t('clubs_visits')} value={String(mine.reduce((s, m) => s + m.visitsThisMonth, 0))} />
                <Fact label={t('clubs_occ')} value={`${c.occupancy}% • ${occ.label}`} />
              </View>
              <ProgressBar value={c.occupancy / 100} color={occ.color} />
            </View>
          );
        })}

        <T type="heading" style={{ marginTop: Spacing.two }}>
          {t('entry_log')}
        </T>
        {staffLog.length === 0 ? (
          <T type="caption">{t('log_empty')}</T>
        ) : (
          staffLog.slice(0, 20).map((e) => (
            <View key={`${e.ts}-${e.memberId}`} style={styles.logRow}>
              <Ionicons name={e.ok ? 'checkmark-circle' : 'close-circle'} size={20} color={e.ok ? Colors.success : Colors.danger} />
              <View style={{ flex: 1 }}>
                <T type="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                  {e.name}
                </T>
                <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                  {e.ok ? (!e.leftTs && now < e.ts + SESSION_MS ? t('inside_until', { time: hm(e.ts + SESSION_MS) }) : t('left_at', { time: hm(e.leftTs ?? e.ts + SESSION_MS) })) : `${t('entry_denied')}${e.reason ? `: ${e.reason}` : ''}`} • {clubById(e.clubId)?.name.replace('Gym Project ', '')}
                </T>
              </View>
              <T type="small" color={OwnerAccent}>
                {new Date(e.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </T>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
});
