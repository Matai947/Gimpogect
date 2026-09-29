import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, ChipRow, Row, Screen, Stars, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, formatPrice, trainers } from '@/data/mock';

const specialties = ['Все', 'Силовые', 'Йога', 'Похудение', 'Бокс', 'Плавание', 'Танцы', 'Кроссфит'];

export default function TrainersScreen() {
  const [query, setQuery] = useState('');
  const [spec, setSpec] = useState('Все');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trainers
      .filter((t) => (spec === 'Все' ? true : t.specialties.includes(spec)))
      .filter((t) => (q ? t.name.toLowerCase().includes(q) || t.specialties.some((s) => s.toLowerCase().includes(q)) : true))
      .sort((a, b) => b.rating - a.rating);
  }, [query, spec]);

  return (
    <Screen edges={[]}>
      <View style={styles.header}>
        <T type="caption">Персональные тренировки, ведение и групповые программы</T>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Имя или направление" placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
      </View>

      <ChipRow style={{ marginBottom: Spacing.three }}>
        {specialties.map((s) => (
          <Chip key={s} label={s} active={spec === s} onPress={() => setSpec(s)} />
        ))}
      </ChipRow>

      <View style={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}>
        {list.map((t) => {
          const club = clubById(t.clubId);
          return (
            <Card key={t.id} onPress={() => router.push(`/trainer/${t.id}`)} style={{ flexDirection: 'row', gap: Spacing.three }}>
              <Image source={{ uri: t.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
              <View style={{ flex: 1, gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="subheading" style={{ flex: 1 }}>
                    {t.name}
                  </T>
                  <Stars rating={t.rating} />
                </Row>
                <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                  {t.specialties.join(' • ')}
                </T>
                <Row gap={6}>
                  <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                  <T type="small" color={Colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
                    {club?.name.replace('Gym Project ', '')} • опыт {t.experienceYears} лет
                  </T>
                </Row>
                <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
                  <T type="label" color={Colors.accent}>
                    {formatPrice(t.pricePerSession)}
                  </T>
                  <T type="small" color={Colors.textMuted}>
                    за тренировку
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
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },
  avatar: { width: 84, height: 84, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
});
