import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Dimensions, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Chip, EmptyState, IconButton, ProgressBar, Row, Screen, SectionHeader, Stars, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, occupancyLabel, sessionsForDate, toISODate, trainerById, trainers } from '@/data/mock';
import { useApp } from '@/store/app-context';

const W = Dimensions.get('window').width;

export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = clubById(id);
  const { favorites, toggleFavorite, user, updateUser } = useApp();
  const todaySessions = useMemo(() => sessionsForDate(toISODate(new Date())).filter((s) => s.clubId === id), [id]);
  const clubTrainers = trainers.filter((t) => t.clubId === id);

  if (!club) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Клуб не найден" />
      </Screen>
    );
  }

  const occ = occupancyLabel(club.occupancy);
  const fav = favorites.includes(club.id);
  const isHome = user?.homeClubId === club.id;

  const openRoute = () => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`${club.name}, ${club.address}`)}`);
  const call = () => Linking.openURL(`tel:${club.phone.replace(/\s/g, '')}`);

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: club.name.replace('Gym Project ', ''),
          headerRight: () => <IconButton icon={fav ? 'heart' : 'heart-outline'} color={fav ? Colors.danger : Colors.text} bg="transparent" onPress={() => toggleFavorite(club.id)} />,
        }}
      />

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ height: 240 }}>
        {club.photos.map((p) => (
          <Image key={p} source={{ uri: p }} style={{ width: W, height: 240 }} contentFit="cover" transition={200} />
        ))}
      </ScrollView>

      <View style={styles.body}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T type="title" style={{ flex: 1 }}>
            {club.name}
          </T>
          <Stars rating={club.rating} size={15} />
        </Row>
        <T type="caption">
          {club.reviews} отзывов • {club.city}
        </T>

        <Row gap={6} style={{ marginTop: Spacing.two }}>
          {club.is24h ? <Badge label="24/7" color={Colors.info} /> : null}
          {isHome ? <Badge label="Мой клуб" /> : null}
          <Badge label={occ.label} color={occ.color} />
        </Row>

        <Row gap={Spacing.two} style={{ marginTop: Spacing.three }}>
          <Button title="Маршрут" icon="navigate-outline" onPress={openRoute} style={{ flex: 1 }} />
          <Button title="Позвонить" icon="call-outline" variant="secondary" onPress={call} style={{ flex: 1 }} />
        </Row>

        <Card style={{ marginTop: Spacing.three, gap: Spacing.two }}>
          <InfoRow icon="location-outline" text={club.address} />
          <InfoRow icon="time-outline" text={club.hours} />
          <InfoRow icon="call-outline" text={club.phone} />
          <View style={{ marginTop: 4, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T type="small" color={Colors.textSecondary}>
                Загруженность сейчас
              </T>
              <T type="small" color={occ.color} style={{ fontWeight: '700' }}>
                {club.occupancy}%
              </T>
            </Row>
            <ProgressBar value={club.occupancy / 100} color={occ.color} />
          </View>
        </Card>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title="О клубе" />
          <T type="body" color={Colors.textSecondary}>
            {club.description}
          </T>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title="Инфраструктура" />
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            {club.amenities.map((a) => (
              <Chip key={a} label={a} icon="checkmark-circle-outline" />
            ))}
          </Row>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title="Сегодня в клубе" action="Расписание" onAction={() => router.push('/(tabs)/schedule')} />
          {todaySessions.length === 0 ? (
            <T type="caption">Сегодня групповых занятий нет</T>
          ) : (
            <View style={{ gap: Spacing.two }}>
              {todaySessions.map((s) => (
                <Card key={s.sessionId} onPress={() => router.push(`/class/${s.sessionId}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                  <View style={{ borderLeftWidth: 3, borderLeftColor: s.color, paddingLeft: 10, minWidth: 60 }}>
                    <T type="label">{s.time}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T type="subheading">{s.title}</T>
                    <T type="small" color={Colors.textSecondary}>
                      {trainerById(s.trainerId)?.name} • {s.room}
                    </T>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </Card>
              ))}
            </View>
          )}
        </View>

        {clubTrainers.length > 0 ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title="Тренеры клуба" action="Все" onAction={() => router.push('/trainers')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
              {clubTrainers.map((t) => (
                <Pressable key={t.id} onPress={() => router.push(`/trainer/${t.id}`)} style={styles.trainer}>
                  <Image source={{ uri: t.avatar }} style={styles.trainerImg} contentFit="cover" />
                  <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {t.name.split(' ')[0]}
                  </T>
                  <T type="small" color={Colors.textMuted} numberOfLines={1}>
                    {t.specialties[0]}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!isHome ? (
          <Button
            title="Сделать домашним клубом"
            variant="ghost"
            icon="home-outline"
            style={{ marginTop: Spacing.four }}
            onPress={() => {
              updateUser({ homeClubId: club.id });
              Alert.alert('Готово', `${club.name} теперь ваш домашний клуб`);
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function InfoRow({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <Row gap={10}>
      <Ionicons name={icon} size={16} color={Colors.accent} />
      <T type="body" style={{ flex: 1 }}>
        {text}
      </T>
    </Row>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.three },
  trainer: { width: 100, gap: 4 },
  trainerImg: { width: 100, height: 100, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, marginBottom: 4 },
});
