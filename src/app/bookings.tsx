import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Badge, Card, EmptyState, Row, Screen, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, formatDateHuman, sessionById, sessionStart, trainerById } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

export default function BookingsScreen() {
  const { bookings, cancelBooking } = useApp();
  const { t, td } = useI18n();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const all = bookings.map(sessionById).filter((s): s is NonNullable<typeof s> => !!s);
    return {
      upcoming: all.filter((s) => sessionStart(s) >= now).sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime()),
      past: all.filter((s) => sessionStart(s) < now).sort((a, b) => sessionStart(b).getTime() - sessionStart(a).getTime()),
    };
  }, [bookings]);

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <Screen edges={[]}>
      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map((tb) => (
          <Pressable key={tb} onPress={() => setTab(tb)} style={[styles.tab, tab === tb && styles.tabActive]}>
            <T type="label" color={tab === tb ? Colors.onAccent : Colors.textSecondary}>
              {tb === 'upcoming' ? t('upcoming_n', { n: upcoming.length }) : t('past_n', { n: past.length })}
            </T>
          </Pressable>
        ))}
      </View>

      <View style={{ padding: Spacing.three, gap: Spacing.two }}>
        {list.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={tab === 'upcoming' ? t('no_upcoming') : t('history_empty')}
            subtitle={tab === 'upcoming' ? t('no_upcoming_sub') : t('history_sub')}
            action={tab === 'upcoming' ? t('to_schedule') : undefined}
            onAction={() => router.push('/(tabs)/schedule')}
          />
        ) : (
          list.map((s) => {
            const trainer = trainerById(s.trainerId);
            const club = clubById(s.clubId);
            return (
              <Card key={s.sessionId} onPress={() => router.push(`/class/${s.sessionId}`)} style={{ gap: Spacing.two }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={8}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                    <T type="subheading">{td(s.title)}</T>
                  </Row>
                  <Badge label={td(s.category)} color={s.color} />
                </Row>
                <Row gap={6}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <T type="small" color={Colors.textSecondary}>
                    {formatDateHuman(s.date)} • {s.time} • {s.durationMin} {t('min')}
                  </T>
                </Row>
                <Row gap={6}>
                  <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                  <T type="small" color={Colors.textSecondary}>
                    {club?.name} • {td(s.room)}
                  </T>
                </Row>
                <Row gap={6}>
                  <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                  <T type="small" color={Colors.textSecondary}>
                    {trainer?.name}
                  </T>
                </Row>
                {tab === 'upcoming' ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert(t('cancel_q'), `${td(s.title)}, ${formatDateHuman(s.date).toLowerCase()} ${s.time}`, [
                        { text: t('keep'), style: 'cancel' },
                        { text: t('cancel_booking'), style: 'destructive', onPress: () => cancelBooking(s.sessionId) },
                      ])
                    }
                    style={styles.cancel}>
                    <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                    <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                      {t('cancel_booking')}
                    </T>
                  </Pressable>
                ) : null}
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', margin: Spacing.three, marginBottom: 0, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 4, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: Colors.accent },
  cancel: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4 },
});
