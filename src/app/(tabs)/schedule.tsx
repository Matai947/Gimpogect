import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge, Card, Chip, ChipRow, EmptyState, Row, Screen, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, categories, clubById, clubs, monthShort, sessionsForDate, sessionStart, toISODate, trainerById, weekdayShort } from '@/data/mock';
import { useApp } from '@/store/app-context';

export default function ScheduleScreen() {
  const { isBooked, user } = useApp();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);
  const [date, setDate] = useState(toISODate(new Date()));
  const [category, setCategory] = useState<(typeof categories)[number]>('Все');
  const [clubId, setClubId] = useState<string>(user?.homeClubId ?? 'all');

  const sessions = useMemo(() => {
    const now = new Date();
    return sessionsForDate(date)
      .filter((s) => (category === 'Все' ? true : s.category === category))
      .filter((s) => (clubId === 'all' ? true : s.clubId === clubId))
      .map((s) => ({ ...s, past: sessionStart(s) < now }));
  }, [date, category, clubId]);

  const today = toISODate(new Date());

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <T type="title">Расписание</T>
        <T type="caption">Групповые занятия по абонементу</T>
      </View>

      {/* Date strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }} style={{ flexGrow: 0 }}>
        {days.map((d) => {
          const iso = toISODate(d);
          const active = iso === date;
          const isToday = iso === today;
          return (
            <Pressable key={iso} onPress={() => setDate(iso)} style={[styles.day, active && styles.dayActive]}>
              <T type="small" color={active ? Colors.onAccent : Colors.textSecondary} style={{ fontWeight: '600' }}>
                {isToday ? 'Сег' : weekdayShort[d.getDay()]}
              </T>
              <T type="heading" color={active ? Colors.onAccent : Colors.text}>
                {d.getDate()}
              </T>
              <T type="small" color={active ? Colors.onAccent : Colors.textMuted}>
                {monthShort[d.getMonth()]}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ height: Spacing.three }} />

      <ChipRow>
        <Chip label="Все клубы" active={clubId === 'all'} onPress={() => setClubId('all')} icon="location-outline" />
        {clubs.map((c) => (
          <Chip key={c.id} label={c.name.replace('Gym Project ', '')} active={clubId === c.id} onPress={() => setClubId(c.id)} />
        ))}
      </ChipRow>
      <View style={{ height: Spacing.two }} />
      <ChipRow>
        {categories.map((c) => (
          <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </ChipRow>

      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six }} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title="Занятий нет" subtitle="Попробуйте другой день, клуб или направление" />
        ) : (
          sessions.map((s) => {
            const trainer = trainerById(s.trainerId);
            const club = clubById(s.clubId);
            const left = s.capacity - s.booked;
            const booked = isBooked(s.sessionId);
            return (
              <Card key={s.sessionId} onPress={() => router.push(`/class/${s.sessionId}`)} style={[styles.session, s.past && { opacity: 0.5 }]}>
                <View style={[styles.time, { borderLeftColor: s.color }]}>
                  <T type="label">{s.time}</T>
                  <T type="small" color={Colors.textSecondary}>
                    {s.durationMin} мин
                  </T>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T type="subheading" style={{ flex: 1 }} numberOfLines={1}>
                      {s.title}
                    </T>
                    {booked ? <Badge label="Вы записаны" color={Colors.success} /> : null}
                  </Row>
                  <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                    {trainer?.name} • {club?.name.replace('Gym Project ', '')} • {s.room}
                  </T>
                  <Row gap={6}>
                    <Ionicons name="people-outline" size={13} color={left <= 3 ? Colors.warning : Colors.textMuted} />
                    <T type="small" color={left <= 3 ? Colors.warning : Colors.textMuted}>
                      {left <= 0 ? 'Мест нет — лист ожидания' : `Свободно ${left} из ${s.capacity}`}
                    </T>
                    <View style={{ flex: 1 }} />
                    <T type="small" color={Colors.textMuted}>
                      {s.level}
                    </T>
                  </Row>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  day: {
    width: 58,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 2,
  },
  dayActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  session: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  time: { borderLeftWidth: 3, paddingLeft: 10, minWidth: 64 },
});
