import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Badge, Button, Chip, EmptyState, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { clubById, trainerById } from '@/data/mock';
import { useI18n } from '@/store/app-context';

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
  const digits = (trainer.phone ?? '').replace(/\D/g, '');

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 120 }}>
      <Stack.Screen options={{ title: trainer.name }} />
      <View style={styles.head}>
        <Row gap={8}>
          <T type="title" style={{ flexShrink: 1 }}>
            {trainer.name}
          </T>
          {trainer.pro ? <Badge label={t('pro_badge')} color={Colors.info} /> : null}
        </Row>
        {club || trainer.audience ? <T type="caption">{[club?.name, trainer.audience].filter(Boolean).join(' • ')}</T> : null}
      </View>

      <View style={styles.body}>
        <View>
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
      </View>

      {trainer.phone ? (
        <View style={styles.footer}>
          <Button title={t('call')} icon="call-outline" onPress={() => Linking.openURL(`tel:+${digits}`)} style={{ flex: 1 }} />
          <Button title="WhatsApp" icon="logo-whatsapp" variant="secondary" onPress={() => Linking.openURL(`https://wa.me/${digits}`)} style={{ flex: 1 }} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { padding: Spacing.three, paddingBottom: 0, gap: 4 },
  body: { padding: Spacing.three },
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
