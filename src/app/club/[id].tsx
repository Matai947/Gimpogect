import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Dimensions, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Chip, EmptyState, IconButton, ProgressBar, Row, Screen, SectionHeader, Stars, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, clubHours, occupancyLabel, sessionsForDate, toISODate, trainerById, trainers } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

const W = Dimensions.get('window').width;

export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = clubById(id);
  const { favorites, toggleFavorite, user, updateUser } = useApp();
  const { t, tp, td } = useI18n();
  const todaySessions = useMemo(() => sessionsForDate(toISODate(new Date())).filter((s) => s.clubId === id), [id]);
  const clubTrainers = trainers.filter((tr) => tr.clubId === id);

  if (!club) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('club_not_found')} />
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
        <T type="caption">{t('reviews_city', { n: club.reviews, r: tp(club.reviews, 'reviews_pl'), city: td(club.city) })}</T>

        <Row gap={6} style={{ marginTop: Spacing.two }}>
          {club.is24h ? <Badge label="24/7" color={Colors.info} /> : null}
          {isHome ? <Badge label={t('my_club')} /> : null}
          <Badge label={occ.label} color={occ.color} />
        </Row>

        <Row gap={Spacing.two} style={{ marginTop: Spacing.three }}>
          <Button title={t('route')} icon="navigate-outline" onPress={openRoute} style={{ flex: 1 }} />
          <Button title={t('call')} icon="call-outline" variant="secondary" onPress={call} style={{ flex: 1 }} />
        </Row>

        <Card style={{ marginTop: Spacing.three, gap: Spacing.two }}>
          <InfoRow icon="location-outline" text={club.address} />
          <InfoRow icon="time-outline" text={clubHours(club)} />
          <InfoRow icon="call-outline" text={club.phone} />
          <View style={{ marginTop: 4, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T type="small" color={Colors.textSecondary}>
                {t('occupancy_now')}
              </T>
              <T type="small" color={occ.color} style={{ fontWeight: '700' }}>
                {club.occupancy}%
              </T>
            </Row>
            <ProgressBar value={club.occupancy / 100} color={occ.color} />
          </View>
        </Card>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('about_club')} />
          <T type="body" color={Colors.textSecondary}>
            {club.description}
          </T>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('amenities')} />
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            {club.amenities.map((a) => (
              <Chip key={a} label={td(a)} icon="checkmark-circle-outline" />
            ))}
          </Row>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('today_in_club')} action={t('tab_schedule')} onAction={() => router.push('/(tabs)/schedule')} />
          {todaySessions.length === 0 ? (
            <T type="caption">{t('no_classes_today')}</T>
          ) : (
            <View style={{ gap: Spacing.two }}>
              {todaySessions.map((s) => (
                <Card key={s.sessionId} onPress={() => router.push(`/class/${s.sessionId}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                  <View style={{ borderLeftWidth: 3, borderLeftColor: s.color, paddingLeft: 10, minWidth: 60 }}>
                    <T type="label">{s.time}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T type="subheading">{td(s.title)}</T>
                    <T type="small" color={Colors.textSecondary}>
                      {trainerById(s.trainerId)?.name} • {td(s.room)}
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
            <SectionHeader title={t('club_trainers')} action={t('all')} onAction={() => router.push('/trainers')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
              {clubTrainers.map((tr) => (
                <Pressable key={tr.id} onPress={() => router.push(`/trainer/${tr.id}`)} style={styles.trainer}>
                  <Image source={{ uri: tr.avatar }} style={styles.trainerImg} contentFit="cover" />
                  <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {tr.name.split(' ')[0]}
                  </T>
                  <T type="small" color={Colors.textMuted} numberOfLines={1}>
                    {td(tr.specialties[0])}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!isHome ? (
          <Button
            title={t('make_home')}
            variant="ghost"
            icon="home-outline"
            style={{ marginTop: Spacing.four }}
            onPress={() => {
              updateUser({ homeClubId: club.id });
              Alert.alert(t('done'), t('home_set', { name: club.name }));
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
