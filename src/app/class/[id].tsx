import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ProgressBar, Row, Screen, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, formatDateHuman, sessionById, sessionStart, trainerById } from '@/data/mock';
import { useApp, useMembershipInfo } from '@/store/app-context';

export default function ClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = sessionById(id);
  const { isBooked, book, cancelBooking } = useApp();
  const membership = useMembershipInfo();

  if (!session) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Занятие не найдено" />
      </Screen>
    );
  }

  const trainer = trainerById(session.trainerId);
  const club = clubById(session.clubId);
  const booked = isBooked(session.sessionId);
  const left = session.capacity - session.booked - (booked ? 1 : 0);
  const past = sessionStart(session) < new Date();
  const full = left <= 0 && !booked;

  const onBook = () => {
    if (!membership.active) {
      Alert.alert('Нужен активный абонемент', 'Групповые занятия входят в абонемент. Оформить сейчас?', [
        { text: 'Позже', style: 'cancel' },
        { text: 'К абонементам', onPress: () => router.push('/membership') },
      ]);
      return;
    }
    if (membership.frozen) {
      Alert.alert('Абонемент заморожен', 'Разморозьте абонемент, чтобы записываться на занятия.', [
        { text: 'Ок', style: 'cancel' },
        { text: 'Открыть', onPress: () => router.push('/membership') },
      ]);
      return;
    }
    book(session.sessionId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Вы записаны!', `${session.title}, ${formatDateHuman(session.date).toLowerCase()} в ${session.time}. Напомним за 2 часа.`);
  };

  const onCancel = () => {
    Alert.alert('Отменить запись?', 'Место освободится для других участников.', [
      { text: 'Оставить', style: 'cancel' },
      {
        text: 'Отменить запись',
        style: 'destructive',
        onPress: () => {
          cancelBooking(session.sessionId);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        },
      },
    ]);
  };

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 120 }}>
      <Stack.Screen options={{ title: session.title }} />
      <LinearGradient colors={[session.color + 'AA', Colors.background]} style={styles.hero}>
        <Badge label={session.category} color={Colors.text} />
        <T type="display" style={{ marginTop: Spacing.two }}>
          {session.title}
        </T>
        <T type="body" color={Colors.textSecondary}>
          {formatDateHuman(session.date)} • {session.time} • {session.durationMin} мин
        </T>
        {booked ? (
          <Row gap={6} style={{ marginTop: Spacing.two }}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <T type="label" color={Colors.success}>
              Вы записаны
            </T>
          </Row>
        ) : null}
      </LinearGradient>

      <View style={styles.body}>
        <Card style={{ gap: Spacing.three }}>
          <Pressable onPress={() => router.push(`/trainer/${session.trainerId}`)} style={styles.row}>
            <Image source={{ uri: trainer?.avatar }} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <T type="small" color={Colors.textSecondary}>
                Тренер
              </T>
              <T type="subheading">{trainer?.name}</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => router.push(`/club/${session.clubId}`)} style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="location" size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <T type="small" color={Colors.textSecondary}>
                Клуб • {session.room}
              </T>
              <T type="subheading">{club?.name}</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="speedometer-outline" size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <T type="small" color={Colors.textSecondary}>
                Уровень
              </T>
              <T type="subheading">{session.level}</T>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: Spacing.three, gap: Spacing.two }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="subheading">Места</T>
            <T type="label" color={left <= 3 ? Colors.warning : Colors.success}>
              {left <= 0 ? 'Мест нет' : `Свободно ${left} из ${session.capacity}`}
            </T>
          </Row>
          <ProgressBar value={(session.capacity - left) / session.capacity} color={left <= 3 ? Colors.warning : Colors.accent} />
          <T type="small" color={Colors.textMuted}>
            Отмена записи бесплатна не позднее чем за 3 часа до начала
          </T>
        </Card>

        <View style={{ marginTop: Spacing.four }}>
          <T type="heading" style={{ marginBottom: Spacing.two }}>
            Описание
          </T>
          <T type="body" color={Colors.textSecondary}>
            {session.description}
          </T>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <T type="heading" style={{ marginBottom: Spacing.two }}>
            Что взять с собой
          </T>
          {['Спортивная форма и сменная обувь', 'Полотенце и вода', session.category === 'Аква' ? 'Купальник, шапочка, сланцы' : 'Хорошее настроение'].map((i) => (
            <Row key={i} gap={8} style={{ marginBottom: 6 }}>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.accent} />
              <T type="body" color={Colors.textSecondary}>
                {i}
              </T>
            </Row>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        {past ? (
          <Button title="Занятие уже прошло" disabled style={{ flex: 1 }} />
        ) : booked ? (
          <Button title="Отменить запись" variant="danger" icon="close-circle-outline" onPress={onCancel} style={{ flex: 1 }} />
        ) : (
          <Button title={full ? 'В лист ожидания' : 'Записаться'} icon={full ? 'hourglass-outline' : 'checkmark'} onPress={onBook} style={{ flex: 1 }} variant={full ? 'secondary' : 'primary'} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.four, alignItems: 'flex-start' },
  body: { padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceAlt },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(198,255,61,0.12)', alignItems: 'center', justifyContent: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    padding: Spacing.three,
    paddingBottom: Spacing.four,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
});
