import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/product-card';
import { Badge, Button, Card, IconButton, ProgressBar, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, clubs, formatDateHuman, formatDateLong, news, occupancyLabel, sessionById, sessionStart, trainerById } from '@/data/mock';
import { products } from '@/data/shop';
import { useApp, useMembershipInfo, useVisitStats } from '@/store/app-context';

const shopHits = products.filter((p) => p.badge === 'Хит' || p.badge === 'Новинка').slice(0, 6);

const quickActions = [
  { icon: 'calendar-outline', label: 'Записаться', href: '/(tabs)/schedule' },
  { icon: 'people-outline', label: 'Тренеры', href: '/trainers' },
  { icon: 'trending-up-outline', label: 'Прогресс', href: '/progress' },
  { icon: 'card-outline', label: 'Абонемент', href: '/membership' },
] as const;

export default function HomeScreen() {
  const { user, bookings, addToCart } = useApp();
  const membership = useMembershipInfo();
  const stats = useVisitStats();
  const homeClub = clubById(user?.homeClubId ?? 'c1');

  const upcoming = useMemo(() => {
    const now = new Date();
    return bookings
      .map(sessionById)
      .filter((s): s is NonNullable<typeof s> => !!s && sessionStart(s) >= now)
      .sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime())
      .slice(0, 3);
  }, [bookings]);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T type="caption">{greeting}</T>
          <T type="title">{user?.name ?? 'Гость'} 👋</T>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/clubs')} style={styles.clubPill}>
          <Ionicons name="location" size={14} color={Colors.accent} />
          <T type="small" style={{ fontWeight: '600' }} numberOfLines={1}>
            {homeClub?.name.replace('Gym Project ', '') ?? 'Клуб'}
          </T>
        </Pressable>
        <IconButton icon="notifications-outline" onPress={() => router.push('/news/n1')} />
      </View>

      {/* Membership card */}
      <View style={styles.section}>
        <Pressable onPress={() => router.push('/membership')}>
          <LinearGradient
            colors={membership.active ? ['#2B3A14', '#151B23'] : ['#3A1A1A', '#151B23']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.memberCard}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8}>
                <Ionicons name="barbell" size={18} color={Colors.accent} />
                <T type="label" color={Colors.accent}>
                  GYM PROJECT
                </T>
              </Row>
              {membership.active ? (
                <Badge label={membership.frozen ? 'Заморожен' : 'Активен'} color={membership.frozen ? Colors.info : Colors.success} />
              ) : (
                <Badge label="Нет абонемента" color={Colors.danger} />
              )}
            </Row>

            {membership.active ? (
              <>
                <View style={{ marginTop: Spacing.three }}>
                  <T type="caption">Абонемент «{membership.plan?.name ?? '—'}»</T>
                  <Row gap={6} style={{ alignItems: 'flex-end' }}>
                    <T type="display" style={{ fontSize: 44, lineHeight: 48 }}>
                      {membership.daysLeft}
                    </T>
                    <T type="body" color={Colors.textSecondary} style={{ marginBottom: 6 }}>
                      {pluralDays(membership.daysLeft)} осталось
                    </T>
                  </Row>
                </View>
                <View style={{ marginTop: Spacing.two, gap: 6 }}>
                  <ProgressBar value={membership.progress} />
                  <T type="small" color={Colors.textSecondary}>
                    Действует до {membership.endDate ? formatDateLong(membership.endDate) : '—'}
                  </T>
                </View>
              </>
            ) : (
              <View style={{ marginTop: Spacing.three }}>
                <T type="heading">Оформите абонемент</T>
                <T type="caption">Доступ во все клубы сети и групповые занятия</T>
              </View>
            )}

            <Row style={{ marginTop: Spacing.three }} gap={Spacing.two}>
              {membership.active ? (
                <>
                  <Button title="QR-пропуск" icon="qr-code-outline" onPress={() => router.push('/qr')} style={{ flex: 1 }} />
                  <Button title="Продлить" variant="secondary" onPress={() => router.push('/membership')} style={{ flex: 1 }} />
                </>
              ) : (
                <Button title="Выбрать абонемент" icon="card-outline" onPress={() => router.push('/membership')} style={{ flex: 1 }} />
              )}
            </Row>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Quick actions */}
      <View style={[styles.section, { flexDirection: 'row', gap: Spacing.two }]}>
        {quickActions.map((a) => (
          <Pressable key={a.label} onPress={() => router.push(a.href)} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]}>
            <View style={styles.quickIcon}>
              <Ionicons name={a.icon} size={20} color={Colors.accent} />
            </View>
            <T type="small" style={{ fontWeight: '600' }}>
              {a.label}
            </T>
          </Pressable>
        ))}
      </View>

      {/* Week stats */}
      <View style={styles.section}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
          <View style={styles.flame}>
            <Ionicons name="flame" size={22} color={Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <T type="subheading">
              {stats.thisWeek} {pluralVisits(stats.thisWeek)} на этой неделе
            </T>
            <T type="small" color={Colors.textSecondary}>
              Серия: {stats.weekStreak} {pluralWeeks(stats.weekStreak)} подряд • всего {stats.total}
            </T>
          </View>
          <Pressable onPress={() => router.push('/progress')} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </Pressable>
        </Card>
      </View>

      {/* Upcoming bookings */}
      <View style={styles.section}>
        <SectionHeader title="Ближайшие записи" action="Все" onAction={() => router.push('/bookings')} />
        {upcoming.length === 0 ? (
          <Card onPress={() => router.push('/(tabs)/schedule')} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <View style={[styles.flame, { backgroundColor: 'rgba(198,255,61,0.12)' }]}>
              <Ionicons name="add" size={22} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <T type="subheading">Записей пока нет</T>
              <T type="small" color={Colors.textSecondary}>
                Выберите групповое занятие в расписании
              </T>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </Card>
        ) : (
          <View style={{ gap: Spacing.two }}>
            {upcoming.map((s) => {
              const trainer = trainerById(s.trainerId);
              const club = clubById(s.clubId);
              return (
                <Card key={s.sessionId} onPress={() => router.push(`/class/${s.sessionId}`)} style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
                  <View style={[styles.timeBox, { borderLeftColor: s.color }]}>
                    <T type="label">{s.time}</T>
                    <T type="small" color={Colors.textSecondary}>
                      {formatDateHuman(s.date)}
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T type="subheading">{s.title}</T>
                    <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                      {trainer?.name} • {club?.name.replace('Gym Project ', '')}
                    </T>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                </Card>
              );
            })}
          </View>
        )}
      </View>

      {/* Club occupancy */}
      <View style={[styles.section, { paddingHorizontal: 0 }]}>
        <View style={{ paddingHorizontal: Spacing.three }}>
          <SectionHeader title="Загруженность клубов" action="Все клубы" onAction={() => router.push('/(tabs)/clubs')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}>
          {clubs.map((c) => {
            const occ = occupancyLabel(c.occupancy);
            return (
              <Card key={c.id} onPress={() => router.push(`/club/${c.id}`)} style={{ width: 200, gap: Spacing.two }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="subheading" numberOfLines={1} style={{ flex: 1 }}>
                    {c.name.replace('Gym Project ', '')}
                  </T>
                  {c.is24h ? <Badge label="24/7" color={Colors.info} /> : null}
                </Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="small" color={occ.color} style={{ fontWeight: '700' }}>
                    {occ.label}
                  </T>
                  <T type="small" color={Colors.textSecondary}>
                    {c.occupancy}%
                  </T>
                </Row>
                <ProgressBar value={c.occupancy / 100} color={occ.color} />
                <T type="small" color={Colors.textSecondary}>
                  {c.hours}
                </T>
              </Card>
            );
          })}
        </ScrollView>
      </View>

      {/* Shop */}
      <View style={[styles.section, { paddingHorizontal: 0 }]}>
        <View style={{ paddingHorizontal: Spacing.three }}>
          <SectionHeader title="Спортпит и аксессуары" action="В магазин" onAction={() => router.push('/(tabs)/shop')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}>
          {shopHits.map((p) => (
            <ProductCard key={p.id} product={p} width={150} onAdd={() => (p.options ? router.push(`/product/${p.id}`) : addToCart(p.id))} />
          ))}
        </ScrollView>
      </View>

      {/* News */}
      <View style={[styles.section, { paddingHorizontal: 0 }]}>
        <View style={{ paddingHorizontal: Spacing.three }}>
          <SectionHeader title="Новости и акции" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}>
          {news.map((n) => (
            <Pressable key={n.id} onPress={() => router.push(`/news/${n.id}`)} style={({ pressed }) => [styles.newsCard, pressed && { opacity: 0.9 }]}>
              <Image source={{ uri: n.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
              <View style={{ padding: Spacing.three, gap: 4 }}>
                <T type="subheading">{n.title}</T>
                <T type="small" color={Colors.textSecondary}>
                  {n.subtitle}
                </T>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

function pluralDays(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня';
  return 'дней';
}
function pluralVisits(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'тренировка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'тренировки';
  return 'тренировок';
}
function pluralWeeks(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'неделя';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'недели';
  return 'недель';
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  clubPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    height: 40,
    maxWidth: 150,
  },
  section: { paddingHorizontal: Spacing.three, marginBottom: Spacing.four },
  memberCard: { borderRadius: Radius.xl, padding: Spacing.four, borderWidth: 1, borderColor: Colors.border },
  quick: { flex: 1, alignItems: 'center', gap: 8 },
  quickIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  flame: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,179,71,0.15)', alignItems: 'center', justifyContent: 'center' },
  timeBox: { borderLeftWidth: 3, paddingLeft: 10, minWidth: 82 },
  newsCard: { width: 280, height: 160, borderRadius: Radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: Colors.surface },
});
