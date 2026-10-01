import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, ProgressBar, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDateLong, formatPrice, plans } from '@/data/mock';
import { useApp, useI18n, useMembershipInfo } from '@/store/app-context';

type PayId = 'kaspi' | 'card' | 'split';

export default function MembershipScreen() {
  const { membership, buyPlan, freezeMembership, unfreezeMembership } = useApp();
  const { t, tp, td } = useI18n();
  const info = useMembershipInfo();
  const [selected, setSelected] = useState<string>(info.plan?.id ?? 'p6');
  const [pay, setPay] = useState<PayId>('kaspi');
  const plan = plans.find((p) => p.id === selected)!;

  const payMethods: { id: PayId; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; hint: string }[] = [
    { id: 'kaspi', label: t('pay_kaspi'), icon: 'phone-portrait-outline', hint: t('pay_kaspi_hint') },
    { id: 'card', label: t('pay_card'), icon: 'card-outline', hint: t('pay_card_hint') },
    { id: 'split', label: t('pay_split'), icon: 'calendar-outline', hint: t('pay_split_hint') },
  ];

  const purchase = () => {
    const monthly = pay === 'split' ? ` (${formatPrice(Math.round(plan.price / 12))} × 12)` : '';
    Alert.alert(info.active ? t('confirm_extend') : t('confirm_buy'), t('ms_confirm_body', { name: td(plan.name), m: plan.months, price: formatPrice(plan.price), monthly, method: payMethods.find((m) => m.id === pay)?.label ?? '' }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('pay'),
        onPress: () => {
          buyPlan(plan.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Alert.alert(t('paid_title'), t('paid_body'), [{ text: t('great'), onPress: () => router.back() }]);
        },
      },
    ]);
  };

  const freeze = () => {
    if (!membership) return;
    const options = [7, 14, 30].filter((d) => d <= membership.freezeDaysLeft);
    if (options.length === 0) {
      Alert.alert(t('freeze_na_title'), t('freeze_na_sub'));
      return;
    }
    Alert.alert(t('freeze_title'), t('freeze_body', { n: membership.freezeDaysLeft }), [...options.map((d) => ({ text: t('freeze_for', { n: d }), onPress: () => freezeMembership(d) })), { text: t('cancel'), style: 'cancel' as const }]);
  };

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 140 }}>
      <View style={styles.body}>
        <LinearGradient colors={info.active ? ['#2A1A3A', Colors.surface] : ['#3A1A1A', Colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.current}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="caption">{t('ms_current')}</T>
            {info.active ? <Badge label={info.frozen ? t('status_frozen') : t('status_active')} color={info.frozen ? Colors.info : Colors.success} /> : <Badge label={t('status_inactive')} color={Colors.danger} />}
          </Row>
          {info.active && membership ? (
            <>
              <T type="title" style={{ marginTop: 4 }}>
                «{td(info.plan?.name ?? '')}»
              </T>
              <T type="body" color={Colors.textSecondary}>
                {formatDateLong(membership.startDate)} — {formatDateLong(membership.endDate)}
              </T>
              <View style={{ marginTop: Spacing.three, gap: 6 }}>
                <ProgressBar value={info.progress} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="small" color={Colors.textSecondary}>
                    {t('ms_left', { n: info.daysLeft })}
                  </T>
                  <T type="small" color={Colors.textSecondary}>
                    {t('ms_freeze_left', { n: membership.freezeDaysLeft })}
                  </T>
                </Row>
              </View>
              <Row gap={Spacing.two} style={{ marginTop: Spacing.three }}>
                {info.frozen ? (
                  <Button title={t('unfreeze_until', { date: membership.frozenUntil ? formatDateLong(membership.frozenUntil) : '' })} variant="secondary" icon="sunny-outline" onPress={unfreezeMembership} style={{ flex: 1 }} size="sm" />
                ) : (
                  <Button title={t('freeze')} variant="secondary" icon="snow-outline" onPress={freeze} style={{ flex: 1 }} size="sm" />
                )}
                <Button title={t('home_qr')} variant="ghost" icon="qr-code-outline" onPress={() => router.push('/qr')} style={{ flex: 1 }} size="sm" />
              </Row>
            </>
          ) : (
            <T type="heading" style={{ marginTop: 4 }}>
              {t('choose_below')}
            </T>
          )}
        </LinearGradient>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={info.active ? t('home_extend') : t('plans')} />
          <View style={{ gap: Spacing.two }}>
            {plans.map((p) => {
              const active = p.id === selected;
              return (
                <Pressable key={p.id} onPress={() => setSelected(p.id)} style={[styles.plan, active && styles.planActive]}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Row gap={8}>
                        <T type="subheading">{td(p.name)}</T>
                        {p.popular ? <Badge label={t('popular')} /> : null}
                        {p.dayOnly ? <Badge label={t('day_only')} color={Colors.info} /> : null}
                      </Row>
                      <T type="small" color={Colors.textSecondary}>
                        {p.months} {tp(p.months, 'months_pl')} • {formatPrice(p.perMonth)}
                        {t('per_month')}
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
                          <T type="small">{td(f)}</T>
                        </Row>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('pay_method')} />
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
          <SectionHeader title={t('faq')} />
          {[
            [t('faq_1q'), t('faq_1a')],
            [t('faq_2q'), t('faq_2a')],
            [t('faq_3q'), t('faq_3a')],
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
            «{td(plan.name)}» • {plan.months} {t('months_short')}
          </T>
          <T type="heading">{pay === 'split' ? `${formatPrice(Math.round(plan.price / 12))}${t('per_month')}` : formatPrice(plan.price)}</T>
        </View>
        <Button title={info.active ? t('home_extend') : t('pay')} icon="lock-closed-outline" onPress={purchase} style={{ paddingHorizontal: Spacing.four }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.three },
  current: { borderRadius: Radius.xl, padding: Spacing.four, borderWidth: 1, borderColor: Colors.border },
  plan: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.three },
  planActive: { borderColor: Colors.accent, backgroundColor: 'rgba(154,61,205,0.06)' },
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
