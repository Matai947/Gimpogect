import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Dimensions, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, EmptyState, Row, Screen, SectionHeader, StatTile, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, classTemplates, clubById, formatDateHuman, formatPrice, toISODate, trainerById, weekdayShort } from '@/data/mock';
import { useI18n } from '@/store/app-context';

const W = Dimensions.get('window').width;
const slots = ['09:00', '11:00', '14:00', '17:00', '19:00'];

export default function TrainerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trainer = trainerById(id);
  const { t, tp, td } = useI18n();
  const [day, setDay] = useState(toISODate(addDays(new Date(), 1)));
  const [slot, setSlot] = useState<string | null>(null);

  if (!trainer) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('trainer_not_found')} />
      </Screen>
    );
  }

  const club = clubById(trainer.clubId);
  const classes = classTemplates.filter((c) => c.trainerId === trainer.id);
  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(new Date(), i + 1)));

  const bookPersonal = () => {
    if (!slot) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(t('request_sent'), t('request_body', { name: trainer.name, date: formatDateHuman(day).toLowerCase(), time: slot, price: formatPrice(trainer.pricePerSession) }), [{ text: t('great'), onPress: () => router.back() }]);
  };

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 120 }}>
      <Stack.Screen options={{ title: trainer.name }} />
      <View style={{ height: 320 }}>
        <Image source={{ uri: trainer.avatar }} style={{ width: W, height: 320 }} contentFit="cover" transition={200} />
        <LinearGradient colors={['transparent', Colors.background]} style={[StyleSheet.absoluteFill, { top: 140 }]} />
        <View style={styles.heroText}>
          <T type="title">{trainer.name}</T>
          <T type="caption">{club?.name}</T>
        </View>
      </View>

      <View style={styles.body}>
        <Row gap={Spacing.two}>
          <StatTile value={trainer.rating.toFixed(1)} label={`${trainer.reviews} ${tp(trainer.reviews, 'reviews_pl')}`} icon="star" color={Colors.warning} />
          <StatTile value={`${trainer.experienceYears} ${tp(trainer.experienceYears, 'years_pl')}`} label={t('experience')} icon="ribbon-outline" />
          <StatTile value={`${Math.round(trainer.pricePerSession / 1000)}K ₸`} label={t('session')} icon="pricetag-outline" color={Colors.info} />
        </Row>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('directions')} />
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            {trainer.specialties.map((s) => (
              <Chip key={s} label={td(s)} />
            ))}
          </Row>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('about_trainer')} />
          <T type="body" color={Colors.textSecondary}>
            {trainer.bio}
          </T>
        </View>

        {classes.length > 0 ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={t('leads_groups')} action={t('tab_schedule')} onAction={() => router.push('/(tabs)/schedule')} />
            <View style={{ gap: Spacing.two }}>
              {classes.map((c) => (
                <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                  <View style={{ width: 10, height: 36, borderRadius: 5, backgroundColor: c.color }} />
                  <View style={{ flex: 1 }}>
                    <T type="subheading">{td(c.title)}</T>
                    <T type="small" color={Colors.textSecondary}>
                      {c.weekdays.map((d) => weekdayShort.get(d)).join(', ')} • {c.time} • {c.durationMin} {t('min')}
                    </T>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('personal_title')} />
          <T type="caption" style={{ marginBottom: Spacing.two }}>
            {t('personal_sub')}
          </T>
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            {days.map((d) => (
              <Chip key={d} label={formatDateHuman(d)} active={day === d} onPress={() => setDay(d)} />
            ))}
          </Row>
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap', marginTop: Spacing.two }}>
            {slots.map((s) => (
              <Pressable key={s} onPress={() => setSlot(s)} style={[styles.slot, slot === s && styles.slotActive]}>
                <T type="label" color={slot === s ? Colors.onAccent : Colors.text}>
                  {s}
                </T>
              </Pressable>
            ))}
          </Row>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <T type="small" color={Colors.textSecondary}>
            {slot ? `${formatDateHuman(day)}, ${slot}` : t('choose_time')}
          </T>
          <T type="heading">{formatPrice(trainer.pricePerSession)}</T>
        </View>
        <Button title={t('book')} icon="checkmark" onPress={bookPersonal} disabled={!slot} style={{ paddingHorizontal: Spacing.four }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroText: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.two },
  body: { padding: Spacing.three },
  slot: { paddingHorizontal: 18, height: 42, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  slotActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.four,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
