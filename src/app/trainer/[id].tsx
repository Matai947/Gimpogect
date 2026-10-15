import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Dimensions, StyleSheet, View } from 'react-native';

import { Badge, Card, Chip, EmptyState, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { clubById, formatPrice, trainerById } from '@/data/mock';
import { useI18n } from '@/store/app-context';

const W = Dimensions.get('window').width;

export default function TrainerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trainer = trainerById(id);
  const { t, td } = useI18n();

  if (!trainer) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('trainer_not_found')} />
      </Screen>
    );
  }

  const club = clubById(trainer.clubId);
  const sub = [club?.name, trainer.audience].filter(Boolean).join(' • ');
  const title = (
    <>
      <Row gap={8}>
        <T type="title" style={{ flexShrink: 1 }}>
          {trainer.name}
        </T>
        {trainer.pro ? <Badge label={t('pro_badge')} color={Colors.info} /> : null}
      </Row>
      {sub ? <T type="caption">{sub}</T> : null}
    </>
  );

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: trainer.name }} />
      {trainer.photo ? (
        <View style={{ height: 380 }}>
          <Image source={trainer.photo} style={{ width: W, height: 380 }} contentFit="cover" contentPosition="top" transition={200} />
          <LinearGradient colors={['transparent', Colors.background]} style={[StyleSheet.absoluteFill, { top: 200 }]} />
          <View style={styles.heroText}>{title}</View>
        </View>
      ) : (
        <View style={styles.head}>{title}</View>
      )}

      <View style={styles.body}>
        {trainer.pricePerSession ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.four }}>
            <T type="body" color={Colors.textSecondary}>
              {t('trainer_price')}
            </T>
            <T type="heading">{formatPrice(trainer.pricePerSession)}</T>
          </Card>
        ) : null}

        <View>
          <SectionHeader title={t('directions')} />
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            {trainer.specialties.map((s) => (
              <Chip key={s} label={td(s)} />
            ))}
          </Row>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('trainer_quals')} />
          <View style={{ gap: 6 }}>
            {trainer.bio.split('\n').map((line) => (
              <T key={line} type="body" color={Colors.textSecondary}>
                {trainer.bio.includes('\n') ? `★  ${line}` : line}
              </T>
            ))}
          </View>
        </View>

        {trainer.services?.length ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={t('trainer_services')} />
            <View style={{ gap: 6 }}>
              {trainer.services.map((s) => (
                <T key={s} type="body" color={Colors.textSecondary}>
                  •  {s}
                </T>
              ))}
            </View>
          </View>
        ) : null}

        {trainer.why?.length ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={t('trainer_why')} />
            <View style={{ gap: 6 }}>
              {trainer.why.map((s) => (
                <T key={s} type="body" color={Colors.textSecondary}>
                  ✓  {s}
                </T>
              ))}
            </View>
          </View>
        ) : null}

        {trainer.experience ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={t('trainer_experience')} />
            <T type="body">{trainer.experience}</T>
          </View>
        ) : null}

        {trainer.ages ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={t('trainer_ages')} />
            <T type="body">{trainer.ages}</T>
          </View>
        ) : null}

        {trainer.schedule ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={t('trainer_schedule')} />
            <T type="body">{trainer.schedule}</T>
          </View>
        ) : null}

        <Card style={{ marginTop: Spacing.four }}>
          <T type="body" style={{ fontWeight: '700' }}>
            {t('trainer_book_admin')}
          </T>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroText: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.two },
  head: { padding: Spacing.three, paddingBottom: 0, gap: 4 },
  body: { padding: Spacing.three },
});
