import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MemberPass } from '@/components/member-pass';
import { ProductCard } from '@/components/product-card';
import { Badge, Button, Card, IconButton, ProgressBar, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { goalTip, goalTitle } from '@/data/fitness';
import { clubById, clubHours, clubs, formatDateHuman, formatPrice, news, occupancyLabel, sessionById, sessionStart, trainerById, trainers } from '@/data/mock';
import { useApp, useCatalog, useFitnessProfile, useI18n, useMembershipInfo, usePlans, useVisitStats } from '@/store/app-context';

export default function HomeScreen() {
  const { user, bookings, addToCart, coachPlan } = useApp();
  const membership = useMembershipInfo();
  const { t, tp, td } = useI18n();
  const plans = usePlans();
  const { products } = useCatalog();
  const shopHits = useMemo(() => products.filter((p) => p.badge === 'Хит' || p.badge === 'Новинка').slice(0, 6), [products]);
  const stats = useVisitStats();
  const fitness = useFitnessProfile();
  const homeClub = clubById(user?.homeClubId ?? 'c1');
  const goalTrainer = fitness ? trainers.find((tr) => tr.specialties.some((s) => fitness.goalInfo.specialties.includes(s))) : undefined;

  const quickActions = [
    { icon: 'calendar-outline', label: t('qa_book'), href: '/(tabs)/schedule' },
    { icon: 'sparkles-outline', label: t('qa_coach'), href: '/(tabs)/coach' },
    { icon: 'people-outline', label: t('qa_trainers'), href: '/trainers' },
    { icon: 'card-outline', label: t('qa_plan'), href: '/membership' },
  ] as const;

  const upcoming = useMemo(() => {
    const now = new Date();
    return bookings
      .map(sessionById)
      .filter((s): s is NonNullable<typeof s> => !!s && sessionStart(s) >= now)
      .sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime())
      .slice(0, 3);
  }, [bookings]);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? t('greet_night') : hour < 12 ? t('greet_morning') : hour < 18 ? t('greet_day') : t('greet_evening');

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T type="caption">{greeting}</T>
          <T type="title">{user?.name ?? t('guest')}</T>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/clubs')} style={styles.clubPill}>
          <Ionicons name="location" size={14} color={Colors.accent} />
          <T type="small" style={{ fontWeight: '600' }} numberOfLines={1}>
            {homeClub?.name.replace('Seven Gym ', '') ?? ''}
          </T>
        </Pressable>
        <IconButton icon="notifications-outline" onPress={() => router.push('/news/n1')} />
      </View>

      {/* Membership pass */}
      <View style={styles.section}>
        <MemberPass />
      </View>

      {/* Renewal reminder in the last 7 days */}
      {membership.active && !membership.frozen && membership.daysLeft <= 7 ? (
        <View style={styles.section}>
          <Pressable onPress={() => router.push(`/membership?plan=${membership.plan?.id ?? ''}`)} style={styles.expiring}>
            <Ionicons name="alarm-outline" size={28} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <T type="subheading">{t('expiring_title')}</T>
              <T type="small" color={Colors.textSecondary}>
                {t('expiring_body', { n: membership.daysLeft, d: tp(membership.daysLeft, 'days_pl') })}
              </T>
            </View>
            <View style={styles.trialBtn}>
              <T type="label" color={Colors.onAccent} style={{ fontSize: 13 }}>
                {t('home_extend')}
              </T>
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* Free trial, like the "3 дня пробных тренировок" block on s89 */}
      {!membership.active ? (
        <View style={styles.section}>
          <Pressable
            onPress={() => router.push('/membership')}
            style={styles.trial}>
            <View style={{ flex: 1 }}>
              <T type="display" style={{ fontSize: 22, lineHeight: 26 }}>
                {t('trial_title')}
              </T>
              <T type="small" color={Colors.textSecondary} style={{ marginTop: 4 }}>
                {t('trial_sub_desk')}
              </T>
              <View style={styles.trialBtn}>
                <T type="label" color={Colors.onAccent} style={{ fontSize: 13 }}>
                  {t('trial_cta_desk')}
                </T>
              </View>
            </View>
            <Ionicons name="gift-outline" size={44} color={Colors.info} />
          </Pressable>
        </View>
      ) : null}

      {/* Quick actions */}
      <View style={[styles.section, { flexDirection: 'row', gap: Spacing.two }]}>
        {quickActions.map((a) => (
          <Pressable key={a.label} onPress={() => router.push(a.href)} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]}>
            <View style={styles.quickIcon}>
              <Ionicons name={a.icon} size={20} color={Colors.accent} />
            </View>
            <T type="small" style={{ fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>
              {a.label}
            </T>
          </Pressable>
        ))}
      </View>

      {/* Price list, like "Галерея абонементов" on s89 */}
      <View style={{ marginBottom: Spacing.four }}>
        <View style={{ paddingHorizontal: Spacing.three }}>
          <SectionHeader title={t('price_list')} action={t('to_plans')} onAction={() => router.push('/membership')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }} style={{ flexGrow: 0, flexShrink: 0 }}>
          {plans
            .filter((p) => !p.trial)
            .map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/membership?plan=${p.id}`)} style={[styles.price, p.popular && { borderColor: Colors.accent }]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="label" color={Colors.textSecondary} style={{ fontSize: 11 }}>
                    {p.months} {tp(p.months, 'months_pl')}
                  </T>
                  {p.popular ? <Badge label={t('popular')} /> : null}
                  {p.dayOnly ? <Badge label={t('day_only')} color={Colors.info} /> : null}
                </Row>
                <T type="display" style={{ fontSize: 17, lineHeight: 21, marginTop: 6 }} numberOfLines={1}>
                  {td(p.name)}
                </T>
                <T type="heading" color={Colors.accent} style={{ marginTop: 'auto' }}>
                  {formatPrice(p.price)}
                </T>
                <Row gap={6}>
                  {p.oldPrice ? (
                    <T type="small" color={Colors.textMuted} style={{ textDecorationLine: 'line-through' }}>
                      {formatPrice(p.oldPrice)}
                    </T>
                  ) : null}
                  <T type="small" color={Colors.textSecondary}>
                    {formatPrice(p.perMonth)}
                    {t('per_month')}
                  </T>
                </Row>
              </Pressable>
            ))}
        </ScrollView>
      </View>

      {/* Goal */}
      {fitness ? (
        <View style={styles.section}>
          <Card style={{ gap: Spacing.three }}>
            <Row gap={Spacing.three}>
              <View style={styles.goalIcon}>
                <Ionicons name={fitness.goalInfo.icon as React.ComponentProps<typeof Ionicons>['name']} size={22} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <T type="small" color={Colors.textSecondary}>
                  {t('home_goal')}
                </T>
                <T type="heading">{goalTitle(fitness.goal)}</T>
              </View>
              <Pressable onPress={() => router.push('/onboarding?edit=1')} hitSlop={8}>
                <Ionicons name="create-outline" size={20} color={Colors.textMuted} />
              </Pressable>
            </Row>
            <Row gap={Spacing.two}>
              <MiniStat value={`${fitness.currentWeightKg}`} unit={t('kg')} label={fitness.toTarget !== undefined ? t('home_to_target', { n: Math.abs(fitness.toTarget) }) : t('home_weight')} />
              <MiniStat value={`${fitness.bmi}`} label={t('home_bmi')} unit="" color={fitness.bmiInfo.color} />
              <MiniStat value={`${fitness.targets.calories}`} unit={t('kcal').toLowerCase()} label={t('home_kcal_norm')} />
              <MiniStat value={`${fitness.targets.protein}`} unit={t('g')} label={t('home_protein')} />
            </Row>
            <T type="small" color={Colors.textSecondary}>
              {goalTip(fitness.goal)}
            </T>
            <Pressable onPress={() => router.push('/(tabs)/coach')} style={styles.coachRow}>
              <Ionicons name="sparkles" size={18} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <T type="small" style={{ fontWeight: '700' }}>
                  {t('qa_coach')}
                </T>
                <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                  {coachPlan ? t('home_coach_plan', { title: coachPlan.title }) : t('home_coach_sub')}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>
            <Row gap={Spacing.two}>
              <Button title={t('home_classes_btn')} size="sm" onPress={() => router.push(`/(tabs)/schedule?category=${encodeURIComponent(fitness.goalInfo.categories[0])}`)} style={{ flex: 1, paddingHorizontal: 8 }} />
              {goalTrainer ? <Button title={t('home_trainer_btn')} size="sm" variant="secondary" onPress={() => router.push(`/trainer/${goalTrainer.id}`)} style={{ flex: 1, paddingHorizontal: 8 }} /> : null}
              <Button title={t('home_nutrition_btn')} size="sm" variant="secondary" onPress={() => router.push('/(tabs)/shop')} style={{ flex: 1, paddingHorizontal: 8 }} />
            </Row>
          </Card>
        </View>
      ) : null}

      {/* Week stats */}
      <View style={styles.section}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
          <View style={styles.flame}>
            <Ionicons name="flame" size={22} color={Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <T type="subheading">{t('home_week_stat', { n: stats.thisWeek, w: tp(stats.thisWeek, 'workouts_pl') })}</T>
            <T type="small" color={Colors.textSecondary}>
              {t('home_streak', { n: stats.weekStreak, w: tp(stats.weekStreak, 'weeks_pl'), total: stats.total })}
            </T>
          </View>
          <Pressable onPress={() => router.push('/progress')} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </Pressable>
        </Card>
      </View>

      {/* Upcoming bookings */}
      <View style={styles.section}>
        <SectionHeader title={t('home_upcoming')} action={t('all')} onAction={() => router.push('/bookings')} />
        {upcoming.length === 0 ? (
          <Card onPress={() => router.push('/(tabs)/schedule')} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <View style={[styles.flame, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
              <Ionicons name="add" size={22} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <T type="subheading">{t('home_no_bookings')}</T>
              <T type="small" color={Colors.textSecondary}>
                {t('home_no_bookings_sub')}
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
                    <T type="subheading">{td(s.title)}</T>
                    <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                      {trainer?.name} • {club?.name.replace('Seven Gym ', '')}
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
          <SectionHeader title={t('home_occupancy')} action={t('home_all_clubs')} onAction={() => router.push('/(tabs)/clubs')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}>
          {clubs.map((c) => {
            const occ = occupancyLabel(c.occupancy);
            return (
              <Card key={c.id} onPress={() => router.push(`/club/${c.id}`)} style={{ width: 200, gap: Spacing.two }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="subheading" numberOfLines={1} style={{ flex: 1 }}>
                    {c.name.replace('Seven Gym ', '')}
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
                  {clubHours(c)}
                </T>
              </Card>
            );
          })}
        </ScrollView>
      </View>

      {/* Shop */}
      <View style={[styles.section, { paddingHorizontal: 0 }]}>
        <View style={{ paddingHorizontal: Spacing.three }}>
          <SectionHeader title={t('home_shop_section')} action={t('home_to_shop')} onAction={() => router.push('/(tabs)/shop')} />
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
          <SectionHeader title={t('home_news')} />
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

function MiniStat({ value, unit, label, color }: { value: string; unit: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 8, gap: 2 }}>
      <Row gap={2} style={{ alignItems: 'flex-end' }}>
        <T type="subheading" color={color}>
          {value}
        </T>
        {unit ? (
          <T type="small" color={Colors.textSecondary} style={{ marginBottom: 2 }}>
            {unit}
          </T>
        ) : null}
      </Row>
      <T type="small" color={Colors.textMuted} style={{ fontSize: 11 }} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
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
  quick: { flex: 1, alignItems: 'center', gap: 8 },
  quickIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  flame: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,138,76,0.15)', alignItems: 'center', justifyContent: 'center' },
  goalIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center' },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  timeBox: { borderLeftWidth: 3, paddingLeft: 10, minWidth: 82 },
  expiring: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: 'rgba(217,100,58,0.5)' },
  trial: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: 'rgba(184,149,43,0.45)' },
  trialBtn: { alignSelf: 'flex-start', marginTop: Spacing.two, paddingHorizontal: 16, height: 44, borderRadius: Radius.pill, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  price: { width: 200, height: 150, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  newsCard: { width: 280, height: 160, borderRadius: Radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: Colors.surface },
});
