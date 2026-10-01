import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Badge, Card, Chip, ChipRow, ProgressBar, Row, Screen, Stars, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubHours, clubs, occupancyLabel } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

const cities = ['Все', 'Алматы', 'Астана'];

export default function ClubsScreen() {
  const { favorites, toggleFavorite, user } = useApp();
  const { t, tp, td } = useI18n();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Все');
  const [onlyFav, setOnlyFav] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs
      .filter((c) => (city === 'Все' ? true : c.city === city))
      .filter((c) => (onlyFav ? favorites.includes(c.id) : true))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q) : true))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [query, city, onlyFav, favorites]);

  return (
    <Screen>
      <View style={styles.header}>
        <T type="title">{t('tab_clubs')}</T>
        <T type="caption">{t('clubs_sub', { n: clubs.length, c: tp(clubs.length, 'clubs_pl') })}</T>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('clubs_search_ph')} placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ChipRow style={{ marginBottom: Spacing.three }}>
        {cities.map((c) => (
          <Chip key={c} label={c === 'Все' ? t('all') : td(c)} active={city === c} onPress={() => setCity(c)} />
        ))}
        <Chip label={t('favorites')} icon="heart" active={onlyFav} onPress={() => setOnlyFav((v) => !v)} />
      </ChipRow>

      <View style={{ paddingHorizontal: Spacing.three, gap: Spacing.three }}>
        {list.map((c) => {
          const occ = occupancyLabel(c.occupancy);
          const fav = favorites.includes(c.id);
          const isHome = user?.homeClubId === c.id;
          return (
            <Card key={c.id} padded={false} onPress={() => router.push(`/club/${c.id}`)} style={{ overflow: 'hidden' }}>
              <View style={{ height: 150 }}>
                <Image source={{ uri: c.photos[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                <View style={styles.imgTop}>
                  <Row gap={6}>
                    {isHome ? <Badge label={t('my_club')} color={Colors.accent} /> : null}
                    {c.is24h ? <Badge label="24/7" color={Colors.info} /> : null}
                  </Row>
                  <Pressable onPress={() => toggleFavorite(c.id)} hitSlop={8} style={styles.heart}>
                    <Ionicons name={fav ? 'heart' : 'heart-outline'} size={18} color={fav ? Colors.danger : Colors.text} />
                  </Pressable>
                </View>
              </View>
              <View style={{ padding: Spacing.three, gap: Spacing.two }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="subheading" style={{ flex: 1 }}>
                    {c.name}
                  </T>
                  <Stars rating={c.rating} />
                </Row>
                <Row gap={6}>
                  <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                  <T type="small" color={Colors.textSecondary} style={{ flex: 1 }} numberOfLines={1}>
                    {c.address}
                  </T>
                  <T type="small" color={Colors.textSecondary}>
                    {c.distanceKm < 100 ? t('km', { n: c.distanceKm }) : td(c.city)}
                  </T>
                </Row>
                <Row gap={6}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <T type="small" color={Colors.textSecondary}>
                    {clubHours(c)} • {t('area_m2', { n: c.areaM2.toLocaleString('ru-RU') })} • {t('machines_n', { n: c.machines })}
                  </T>
                </Row>
                <View style={{ gap: 6, marginTop: 4 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T type="small" color={occ.color} style={{ fontWeight: '700' }}>
                      {occ.label}
                    </T>
                    <T type="small" color={Colors.textSecondary}>
                      {t('occ_now', { p: c.occupancy })}
                    </T>
                  </Row>
                  <ProgressBar value={c.occupancy / 100} color={occ.color} />
                </View>
              </View>
            </Card>
          );
        })}
        {list.length === 0 ? (
          <T type="caption" style={{ textAlign: 'center', paddingVertical: Spacing.five }}>
            {t('nothing_found')}
          </T>
        ) : null}
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
  imgTop: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heart: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
