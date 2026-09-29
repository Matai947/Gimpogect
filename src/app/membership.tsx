import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, ProgressBar, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDateLong, formatPrice, plans } from '@/data/mock';
import { useApp, useMembershipInfo } from '@/store/app-context';

const payMethods = [
  { id: 'kaspi', label: 'Kaspi Pay', icon: 'phone-portrait-outline', hint: 'Оплата в приложении Kaspi' },
  { id: 'card', label: 'Банковская карта', icon: 'card-outline', hint: 'Visa, Mastercard' },
  { id: 'split', label: 'Рассрочка 0-0-12', icon: 'calendar-outline', hint: 'Без переплаты через Kaspi' },
] as const;

export default function MembershipScreen() {
  const { membership, buyPlan, freezeMembership, unfreezeMembership } = useApp();
  const info = useMembershipInfo();
  const [selected, setSelected] = useState<string>(info.plan?.id ?? 'p6');
  const [pay, setPay] = useState<(typeof payMethods)[number]['id']>('kaspi');
  const plan = plans.find((p) => p.id === selected)!;

  const purchase = () => {
    const monthly = pay === 'split' ? ` (${formatPrice(Math.round(plan.price / 12))} × 12 мес)` : '';
    Alert.alert(
      info.active ? 'Продлить абонемент?' : 'Оформить абонемент?',
      `«${plan.name}» на ${plan.months} мес за ${formatPrice(plan.price)}${monthly}. Способ оплаты: ${payMethods.find((m) => m.id === pay)?.label}.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Оплатить',
          onPress: () => {
            buyPlan(plan.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert('Оплачено', 'Абонемент активирован. QR-пропуск уже работает.', [{ text: 'Отлично', onPress: () => router.back() }]);
          },
        },
      ]
    );
  };

  const freeze = () => {
    if (!membership) return;
    const options = [7, 14, 30].filter((d) => d <= membership.freezeDaysLeft);
    if (options.length === 0) {
      Alert.alert('Заморозка недоступна', 'Дни заморозки по этому абонементу закончились.');
      return;
    }
    Alert.alert('Заморозить абонемент', `Доступно ${membership.freezeDaysLeft} дней. Срок действия продлится на выбранное количество дней.`, [
      ...options.map((d) => ({ text: `На ${d} дней`, onPress: () => freezeMembership(d) })),
      { text: 'Отмена', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 140 }}>
      <View style={styles.body}>
        {/* Current */}
        <LinearGradient colors={info.active ? ['#2B3A14', Colors.surface] : ['#3A1A1A', Colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.current}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="caption">Текущий абонемент</T>
            {info.active ? <Badge label={info.frozen ? 'Заморожен' : 'Активен'} color={info.frozen ? Colors.info : Colors.success} /> : <Badge label="Не активен" color={Colors.danger} />}
          </Row>
          {info.active && membership ? (
            <>
              <T type="title" style={{ marginTop: 4 }}>
                «{info.plan?.name}»
              </T>
              <T type="body" color={Colors.textSecondary}>
                {formatDateLong(membership.startDate)} — {formatDateLong(membership.endDate)}
              </T>
              <View style={{ marginTop: Spacing.three, gap: 6 }}>
                <ProgressBar value={info.progress} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="small" color={Colors.textSecondary}>
                    Осталось {info.daysLeft} дней
                  </T>
                  <T type="small" color={Colors.textSecondary}>
                    Заморозка: {membership.freezeDaysLeft} дн.
                  </T>
                </Row>
              </View>
              <Row gap={Spacing.two} style={{ marginTop: Spacing.three }}>
                {info.frozen ? (
                  <Button title={`Разморозить (до ${membership.frozenUntil ? formatDateLong(membership.frozenUntil) : ''})`} variant="secondary" icon="sunny-outline" onPress={unfreezeMembership} style={{ flex: 1 }} size="sm" />
                ) : (
                  <Button title="Заморозить" variant="secondary" icon="snow-outline" onPress={freeze} style={{ flex: 1 }} size="sm" />
                )}
                <Button title="QR-пропуск" variant="ghost" icon="qr-code-outline" onPress={() => router.push('/qr')} style={{ flex: 1 }} size="sm" />
              </Row>
            </>
          ) : (
            <T type="heading" style={{ marginTop: 4 }}>
              Выберите тариф ниже
            </T>
          )}
        </LinearGradient>

        {/* Plans */}
        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={info.active ? 'Продлить' : 'Тарифы'} />
          <View style={{ gap: Spacing.two }}>
            {plans.map((p) => {
              const active = p.id === selected;
              return (
                <Pressable key={p.id} onPress={() => setSelected(p.id)} style={[styles.plan, active && styles.planActive]}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Row gap={8}>
                        <T type="subheading">{p.name}</T>
                        {p.popular ? <Badge label="Популярный" /> : null}
                        {p.dayOnly ? <Badge label="До 17:00" color={Colors.info} /> : null}
                      </Row>
                      <T type="small" color={Colors.textSecondary}>
                        {p.months} {p.months === 1 ? 'месяц' : p.months < 5 ? 'месяца' : 'месяцев'} • {formatPrice(p.perMonth)}/мес
                      </T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T type="heading" color={active ? Colors.accent : Colors.text}>
                        {formatPrice(p.price)}
                      </T>
                      {p.oldPrice ? (
                        <T type="small" color={Colors.textMuted} style={{ textDecorationLine: 'line-through' }}>
                          {formatPrice(p.oldPrice)}
                        </T>
                      ) : null}
                    </View>
                  </Row>
                  {active ? (
                    <View style={{ marginTop: Spacing.two, gap: 4 }}>
                      {p.features.map((f) => (
                        <Row key={f} gap={8}>
                          <Ionicons name="checkmark-circle" size={15} color={Colors.accent} />
                          <T type="small">{f}</T>
                        </Row>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Payment */}
        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title="Способ оплаты" />
          <Card padded={false}>
            {payMethods.map((m, i) => (
              <Pressable key={m.id} onPress={() => setPay(m.id)} style={[styles.pay, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border }]}>
                <Ionicons name={m.icon} size={20} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <T type="body" style={{ fontWeight: '600' }}>
                    {m.label}
                  </T>
                  <T type="small" color={Colors.textSecondary}>
                    {m.hint}
                  </T>
                </View>
                <Ionicons name={pay === m.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={pay === m.id ? Colors.accent : Colors.textMuted} />
              </Pressable>
            ))}
          </Card>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title="Частые вопросы" />
          {[
            ['Можно ходить в любой клуб?', 'Да, абонемент действует во всех клубах сети в Алматы и Астане.'],
            ['Как работает заморозка?', 'Абонемент ставится на паузу, срок действия продлевается на дни заморозки.'],
            ['Групповые входят в цену?', 'Да, все групповые занятия из расписания без доплат. Персональные — отдельно.'],
          ].map(([q, a]) => (
            <Card key={q} style={{ marginBottom: Spacing.two, gap: 4 }}>
              <T type="subheading">{q}</T>
              <T type="small" color={Colors.textSecondary}>
                {a}
              </T>
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <T type="small" color={Colors.textSecondary}>
            «{plan.name}» • {plan.months} мес
          </T>
          <T type="heading">{pay === 'split' ? `${formatPrice(Math.round(plan.price / 12))}/мес` : formatPrice(plan.price)}</T>
        </View>
        <Button title={info.active ? 'Продлить' : 'Оплатить'} icon="lock-closed-outline" onPress={purchase} style={{ paddingHorizontal: Spacing.four }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.three },
  current: { borderRadius: Radius.xl, padding: Spacing.four, borderWidth: 1, borderColor: Colors.border },
  plan: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.three },
  planActive: { borderColor: Colors.accent, backgroundColor: 'rgba(198,255,61,0.06)' },
  pay: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
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
