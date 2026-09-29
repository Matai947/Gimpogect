import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Card, Divider, ListRow, Row, Screen, StatTile, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { clubById, clubs, formatDateLong } from '@/data/mock';
import { useApp, useFitnessProfile, useMembershipInfo, useVisitStats } from '@/store/app-context';

const achievements = [
  { id: 'a1', icon: 'flash', label: 'Первая тренировка', min: 1 },
  { id: 'a2', icon: 'flame', label: '10 тренировок', min: 10 },
  { id: 'a3', icon: 'medal', label: '25 тренировок', min: 25 },
  { id: 'a4', icon: 'trophy', label: '50 тренировок', min: 50 },
  { id: 'a5', icon: 'diamond', label: '100 тренировок', min: 100 },
] as const;

export default function ProfileScreen() {
  const { user, logout, updateUser, favorites, orders } = useApp();
  const membership = useMembershipInfo();
  const stats = useVisitStats();
  const fitness = useFitnessProfile();
  const homeClub = clubById(user?.homeClubId ?? 'c1');

  const changeHomeClub = () => {
    Alert.alert(
      'Домашний клуб',
      'Выберите клуб по умолчанию для расписания и QR-входа',
      [...clubs.map((c) => ({ text: c.name, onPress: () => updateUser({ homeClubId: c.id }) })), { text: 'Отмена', style: 'cancel' as const }]
    );
  };

  const confirmLogout = () => {
    Alert.alert('Выйти из аккаунта?', 'Данные демо-профиля будут сброшены.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
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
            {membership.active ? <Badge label={`«${membership.plan?.name}» до ${membership.endDate ? formatDateLong(membership.endDate) : ''}`} color={Colors.success} /> : <Badge label="Нет абонемента" color={Colors.danger} />}
          </Row>
        </View>
      </View>

      {fitness ? (
        <View style={styles.section}>
          <Card onPress={() => router.push('/onboarding?edit=1')} style={{ gap: Spacing.two }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T type="heading">Мои параметры</T>
              <Row gap={4}>
                <T type="small" color={Colors.accent} style={{ fontWeight: '700' }}>
                  Изменить
                </T>
                <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
              </Row>
            </Row>
            <Row gap={Spacing.two}>
              <Param label="Рост" value={`${fitness.heightCm} см`} />
              <Param label="Вес" value={`${fitness.currentWeightKg} кг`} />
              <Param label="ИМТ" value={`${fitness.bmi}`} hint={fitness.bmiInfo.label} color={fitness.bmiInfo.color} />
            </Row>
            <Row gap={Spacing.two}>
              <Param label="Цель" value={fitness.goalInfo.title} />
              <Param label="Уровень" value={fitness.level === 'beginner' ? 'Новичок' : fitness.level === 'intermediate' ? 'Средний' : 'Продвинутый'} />
              <Param label="В неделю" value={`${fitness.daysPerWeek} трен.`} />
            </Row>
          </Card>
        </View>
      ) : null}

      <View style={[styles.section, { flexDirection: 'row', gap: Spacing.two }]}>
        <StatTile value={stats.total} label="всего визитов" icon="barbell-outline" />
        <StatTile value={stats.thisMonth} label="за 30 дней" icon="calendar-outline" color={Colors.info} />
        <StatTile value={stats.weekStreak} label="недель подряд" icon="flame-outline" color={Colors.warning} />
      </View>

      <View style={styles.section}>
        <T type="heading" style={{ marginBottom: Spacing.two }}>
          Достижения
        </T>
        <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
          {achievements.map((a) => {
            const done = stats.total >= a.min;
            return (
              <View key={a.id} style={[styles.ach, done && { borderColor: Colors.accent, backgroundColor: 'rgba(198,255,61,0.08)' }]}>
                <Ionicons name={a.icon} size={22} color={done ? Colors.accent : Colors.textMuted} />
                <T type="small" color={done ? Colors.text : Colors.textMuted} style={{ textAlign: 'center' }}>
                  {a.label}
                </T>
              </View>
            );
          })}
        </Row>
      </View>

      <View style={styles.section}>
        <Card padded={false}>
          <ListRow icon="card-outline" title="Мой абонемент" subtitle={membership.active ? `${membership.daysLeft} дней осталось` : 'Оформить'} onPress={() => router.push('/membership')} />
          <Divider />
          <ListRow icon="qr-code-outline" title="QR-пропуск" subtitle="Вход в клуб без карты" onPress={() => router.push('/qr')} />
          <Divider />
          <ListRow icon="calendar-outline" title="Мои записи" subtitle="Групповые и персональные" onPress={() => router.push('/bookings')} />
          <Divider />
          <ListRow icon="trending-up-outline" title="Прогресс" subtitle="Вес и посещения" onPress={() => router.push('/progress')} />
          <Divider />
          <ListRow icon="sparkles-outline" title="ИИ-тренер" subtitle="План на неделю и техника упражнений" onPress={() => router.push('/coach')} />
          <Divider />
          <ListRow icon="people-outline" title="Тренеры" subtitle="Персональные тренировки" onPress={() => router.push('/trainers')} />
          <Divider />
          <ListRow icon="receipt-outline" title="Мои заказы" subtitle={orders.length ? `${orders.length} в истории` : 'Спортпит и аксессуары'} onPress={() => router.push('/orders')} />
        </Card>
      </View>

      <View style={styles.section}>
        <Card padded={false}>
          <ListRow icon="home-outline" title="Домашний клуб" subtitle={homeClub?.name} onPress={changeHomeClub} />
          <Divider />
          <ListRow icon="heart-outline" title="Избранные клубы" subtitle={favorites.length ? `${favorites.length} в списке` : 'Пока пусто'} onPress={() => router.push('/(tabs)/clubs')} />
          <Divider />
          <ListRow icon="language-outline" title="Язык" subtitle="Русский" onPress={() => Alert.alert('Язык', 'Казахский и английский появятся в следующей версии')} />
          <Divider />
          <ListRow icon="notifications-outline" title="Уведомления" subtitle="Напоминания о записях" onPress={() => Alert.alert('Уведомления', 'Настройка появится после подключения push-сервиса')} />
        </Card>
      </View>

      <View style={styles.section}>
        <Card padded={false}>
          <ListRow icon="chatbubble-ellipses-outline" title="Поддержка" subtitle="Чат с менеджером клуба" onPress={() => Alert.alert('Поддержка', 'Здесь будет чат поддержки (Intercom / WhatsApp)')} />
          <Divider />
          <ListRow icon="document-text-outline" title="Правила клуба и оферта" onPress={() => Alert.alert('Документы', 'Ссылка на правила клуба')} />
          <Divider />
          <ListRow icon="log-out-outline" title="Выйти" onPress={confirmLogout} danger right={<View />} />
        </Card>
        <T type="small" color={Colors.textMuted} style={{ textAlign: 'center', marginTop: Spacing.three }}>
          Gym Project • версия 1.0.0 (демо)
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
});
