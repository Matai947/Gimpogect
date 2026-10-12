import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Badge, Card, Chip, ChipRow, Row, Screen, Stars, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { trainers } from '@/data/mock';
import { useI18n } from '@/store/app-context';

const specialties = ['Все', 'Пауэрлифтинг', 'Жим лёжа', 'Бокс', 'Вольная борьба', 'Армрестлинг'];

export default function TrainersScreen() {
  const { t, td } = useI18n();
  const [query, setQuery] = useState('');
  const [spec, setSpec] = useState('Все');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trainers
      .filter((tr) => (spec === 'Все' ? true : tr.specialties.includes(spec)))
      .filter((tr) => (q ? tr.name.toLowerCase().includes(q) || tr.specialties.some((s) => s.toLowerCase().includes(q) || td(s).toLowerCase().includes(q)) : true));
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
        {list.map((tr) => (
          <Card key={tr.id} onPress={() => router.push(`/trainer/${tr.id}`)} style={{ flexDirection: 'row', gap: Spacing.three }}>
            <Image source={tr.avatar} style={styles.avatar} contentFit="cover" transition={200} />
            <View style={{ flex: 1, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={6} style={{ flex: 1 }}>
                  <T type="subheading" style={{ flexShrink: 1 }} numberOfLines={2}>
                    {tr.name}
                  </T>
                  {tr.pro ? <Badge label={t('pro_badge')} color={Colors.info} /> : null}
                </Row>
                {tr.rating ? <Stars rating={tr.rating} /> : null}
              </Row>
              <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                {tr.specialties.map(td).join(' • ')}
              </T>
              {tr.phone ? (
                <Row gap={6}>
                  <Ionicons name="call-outline" size={13} color={Colors.accent} />
                  <T type="label" color={Colors.accent}>
                    {tr.phone}
                  </T>
                </Row>
              ) : null}
            </View>
          </Card>
        ))}
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
