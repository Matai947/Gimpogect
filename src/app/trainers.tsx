import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Badge, Card, Chip, ChipRow, Row, Screen, Stars, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, formatPrice, trainers } from '@/data/mock';
import { useI18n } from '@/store/app-context';

const specialties = ['Все', 'Силовые', 'Йога', 'Похудение', 'Бокс', 'Плавание', 'Танцы', 'Кроссфит'];

export default function TrainersScreen() {
  const { t, tp, td } = useI18n();
  const [query, setQuery] = useState('');
  const [spec, setSpec] = useState('Все');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trainers
      .filter((tr) => (spec === 'Все' ? true : tr.specialties.includes(spec)))
      .filter((tr) => (q ? tr.name.toLowerCase().includes(q) || tr.specialties.some((s) => s.toLowerCase().includes(q) || td(s).toLowerCase().includes(q)) : true))
      .sort((a, b) => b.rating - a.rating);
  }, [query, spec, td]);

  return (
    <Screen edges={[]}>
      <View style={styles.header}>
        <T type="caption">{t('trainers_sub')}</T>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('trainers_search_ph')} placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
      </View>

      <ChipRow style={{ marginBottom: Spacing.three }}>
        {specialties.map((s) => (
          <Chip key={s} label={s === 'Все' ? t('all') : td(s)} active={spec === s} onPress={() => setSpec(s)} />
        ))}
      </ChipRow>

      <View style={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}>
        {list.map((tr) => {
          const club = clubById(tr.clubId);
          return (
            <Card key={tr.id} onPress={() => router.push(`/trainer/${tr.id}`)} style={{ flexDirection: 'row', gap: Spacing.three }}>
              <Image source={{ uri: tr.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
              <View style={{ flex: 1, gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={6} style={{ flex: 1 }}>
                    <T type="subheading" style={{ flexShrink: 1 }} numberOfLines={1}>
                      {tr.name}
                    </T>
                    {tr.pro ? <Badge label={t('pro_badge')} color={Colors.info} /> : null}
                  </Row>
                  <Stars rating={tr.rating} />
                </Row>
                <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                  {tr.specialties.map(td).join(' • ')}
                </T>
                <Row gap={6}>
                  <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                  <T type="small" color={Colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
                    {club?.name.replace('Seven Gym ', '')} • {t('exp_years', { n: tr.experienceYears, y: tp(tr.experienceYears, 'years_pl') })}
                  </T>
                </Row>
                <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
                  <T type="label" color={Colors.accent}>
                    {formatPrice(tr.pricePerSession)}
                  </T>
                  <T type="small" color={Colors.textMuted}>
                    {t('per_session')}
                  </T>
                </Row>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 16 },
  avatar: { width: 84, height: 84, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
});
