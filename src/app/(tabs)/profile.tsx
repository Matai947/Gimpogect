import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { LangSwitch } from '@/components/lang-switch';
import { Avatar, Badge, Card, Divider, ListRow, Row, Screen, StatTile, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { goalTitle, levelTitle } from '@/data/fitness';
import { clubById, clubs, formatDateLong } from '@/data/mock';
import { languages } from '@/i18n';
import { useApp, useFitnessProfile, useI18n, useMembershipInfo, useVisitStats } from '@/store/app-context';

const achievements = [
  { id: 'a1', icon: 'flash', min: 1 },
  { id: 'a2', icon: 'flame', min: 10 },
  { id: 'a3', icon: 'medal', min: 25 },
  { id: 'a4', icon: 'trophy', min: 50 },
  { id: 'a5', icon: 'diamond', min: 100 },
] as const;

export default function ProfileScreen() {
  const { user, logout, updateUser, favorites, orders, staff } = useApp();
  const { t, td, lang } = useI18n();
  const membership = useMembershipInfo();
  const stats = useVisitStats();
  const fitness = useFitnessProfile();
  const homeClub = clubById(user?.homeClubId ?? 'c1');

  const changeHomeClub = () => {
    Alert.alert(t('home_club'), t('home_club_pick_sub'), [...clubs.map((c) => ({ text: c.name, onPress: () => updateUser({ homeClubId: c.id }) })), { text: t('cancel'), style: 'cancel' as const }]);
  };

  const confirmLogout = () => {
    Alert.alert(t('logout_q'), t('logout_body'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/auth');
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar name={user?.name ?? 'Г'} size={72} />
        <View style={{ flex: 1 }}>
          <T type="title">{user?.name}</T>
          <T type="caption">{user?.phone}</T>
          <Row gap={6} style={{ marginTop: 6 }}>
            {membership.active ? <Badge label={t('plan_until', { name: td(membership.plan?.name ?? ''), date: membership.endDate ? formatDateLong(membership.endDate) : '' })} color={Colors.success} /> : <Badge label={t('status_none')} color={Colors.danger} />}
          </Row>
        </View>
      </View>

      {fitness ? (
        <View style={styles.section}>
          <Card onPress={() => router.push('/onboarding?edit=1')} style={{ gap: Spacing.two }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T type="heading">{t('my_params')}</T>
              <Row gap={4}>
                <T type="small" color={Colors.accent} style={{ fontWeight: '700' }}>
                  {t('edit')}
                </T>
                <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
              </Row>
            </Row>
            <Row gap={Spacing.two}>
              <Param label={t('height')} value={`${fitness.heightCm} ${t('cm')}`} />
              <Param label={t('weight')} value={`${fitness.currentWeightKg} ${t('kg')}`} />
              <Param label={t('bmi')} value={`${fitness.bmi}`} hint={fitness.bmiInfo.label} color={fitness.bmiInfo.color} />
            </Row>
            <Row gap={Spacing.two}>
              <Param label={t('goal')} value={goalTitle(fitness.goal)} />
              <Param label={t('level')} value={levelTitle(fitness.level)} />
              <Param label={t('per_week')} value={t('per_week_v', { n: fitness.daysPerWeek })} />
            </Row>
          </Card>
        </View>
      ) : null}

      <View style={[styles.section, { flexDirection: 'row', gap: Spacing.two }]}>
        <StatTile value={stats.total} label={t('total_visits')} icon="barbell-outline" />
        <StatTile value={stats.thisMonth} label={t('last_30')} icon="calendar-outline" color={Colors.info} />
        <StatTile value={stats.weekStreak} label={t('weeks_streak')} icon="flame-outline" color={Colors.warning} />
      </View>

      <View style={styles.section}>
        <T type="heading" style={{ marginBottom: Spacing.two }}>
          {t('achievements')}
        </T>
        <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
          {achievements.map((a) => {
            const done = stats.total >= a.min;
            return (
              <View key={a.id} style={[styles.ach, done && { borderColor: Colors.accent, backgroundColor: 'rgba(154,61,205,0.08)' }]}>
                <Ionicons name={a.icon} size={22} color={done ? Colors.accent : Colors.textMuted} />
                <T type="small" color={done ? Colors.text : Colors.textMuted} style={{ textAlign: 'center' }}>
                  {a.min === 1 ? t('ach_first') : t('ach_n', { n: a.min })}
                </T>
              </View>
            );
          })}
        </Row>
      </View>

      <View style={styles.section}>
        <Card padded={false}>
          <ListRow icon="card-outline" title={t('my_plan')} subtitle={membership.active ? t('days_left_n', { n: membership.daysLeft }) : t('get_plan')} onPress={() => router.push('/membership')} />
          <Divider />
          <ListRow icon="qr-code-outline" title={t('home_qr')} subtitle={t('qr_pass_sub')} onPress={() => router.push('/qr')} />
          <Divider />
          <ListRow icon="calendar-outline" title={t('my_bookings')} subtitle={t('my_bookings_sub')} onPress={() => router.push('/bookings')} />
          <Divider />
          <ListRow icon="trending-up-outline" title={t('progress')} subtitle={t('progress_sub')} onPress={() => router.push('/progress')} />
          <Divider />
          <ListRow icon="sparkles-outline" title={t('qa_coach')} subtitle={t('ai_coach_sub')} onPress={() => router.push('/(tabs)/coach')} />
          <Divider />
          <ListRow icon="people-outline" title={t('qa_trainers')} subtitle={t('trainers_row_sub')} onPress={() => router.push('/trainers')} />
          <Divider />
          <ListRow icon="receipt-outline" title={t('my_orders')} subtitle={orders.length ? t('orders_in_history', { n: orders.length }) : t('orders_sub_empty')} onPress={() => router.push('/orders')} />
        </Card>
      </View>

      <View style={styles.section}>
        <Card padded={false}>
          <ListRow icon="home-outline" title={t('home_club')} subtitle={homeClub?.name} onPress={changeHomeClub} />
          <Divider />
          <ListRow icon="heart-outline" title={t('fav_clubs')} subtitle={favorites.length ? t('fav_count', { n: favorites.length }) : t('fav_empty')} onPress={() => router.push('/(tabs)/clubs')} />
          <Divider />
          <View style={styles.langRow}>
            <View style={styles.langIcon}>
              <Ionicons name="language-outline" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <T type="body" style={{ fontWeight: '600' }}>
                {t('language')}
              </T>
              <T type="small" color={Colors.textSecondary}>
                {languages.find((l) => l.key === lang)?.label}
              </T>
            </View>
            <LangSwitch compact />
          </View>
          <Divider />
          <ListRow icon="notifications-outline" title={t('notifications')} subtitle={t('notif_sub')} onPress={() => Alert.alert(t('notifications'), t('notif_alert'))} />
        </Card>
      </View>

      <View style={styles.section}>
        <Card padded={false}>
          <ListRow icon="logo-whatsapp" title={t('support')} subtitle={`${t('whatsapp')} • ${homeClub?.phone ?? ''}`} onPress={() => Linking.openURL(`https://wa.me/${(homeClub?.phone ?? '').replace(/\D/g, '')}`)} />
          <Divider />
          <ListRow icon="document-text-outline" title={t('rules')} onPress={() => Alert.alert(t('documents'), t('rules_alert'))} />
          <Divider />
          <ListRow icon="id-card-outline" title={t('staff_mode_row')} subtitle={t('staff_mode_row_sub')} onPress={() => router.push(staff ? '/staff' : '/staff-login')} />
          <Divider />
          <ListRow icon="log-out-outline" title={t('logout')} onPress={confirmLogout} danger right={<View />} />
        </Card>
        <T type="small" color={Colors.textMuted} style={{ textAlign: 'center', marginTop: Spacing.three }}>
          {t('version')}
        </T>
      </View>
    </Screen>
  );
}

function Param({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 10, gap: 2 }}>
      <T type="small" color={Colors.textMuted} style={{ fontSize: 11 }}>
        {label}
      </T>
      <T type="subheading" color={color} numberOfLines={1} style={{ fontSize: 15 }}>
        {value}
      </T>
      {hint ? (
        <T type="small" color={color ?? Colors.textSecondary} style={{ fontSize: 10.5 }} numberOfLines={1}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four },
  section: { paddingHorizontal: Spacing.three, marginBottom: Spacing.four },
  ach: { width: '30%', flexGrow: 1, alignItems: 'center', gap: 6, padding: Spacing.two, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 12, paddingHorizontal: Spacing.three },
  langIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(154,61,205,0.12)', alignItems: 'center', justifyContent: 'center' },
});
