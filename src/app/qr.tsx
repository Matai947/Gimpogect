import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Button, Card, Row, Screen, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, formatDateLong, toISODate } from '@/data/mock';
import { useApp, useI18n, useMembershipInfo } from '@/store/app-context';

const REFRESH_SEC = 30;

export default function QrScreen() {
  const { user, checkIn, visits } = useApp();
  const { t, td } = useI18n();
  const membership = useMembershipInfo();
  const [tick, setTick] = useState(0);
  const [left, setLeft] = useState(REFRESH_SEC);
  const club = clubById(user?.homeClubId ?? 'c1');
  const visitedToday = visits.some((v) => v.date === toISODate(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          setTick((x) => x + 1);
          return REFRESH_SEC;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotating nonce: a real backend would sign this payload and validate the timestamp.
  const payload = JSON.stringify({ v: 1, uid: user?.id ?? 'guest', n: tick });

  const simulate = () => {
    if (!membership.active || membership.frozen) return;
    checkIn(club?.id ?? 'c1');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(t('welcome_title'), t('welcome_body', { club: club?.name ?? '' }), [{ text: t('thanks'), onPress: () => router.back() }]);
  };

  return (
    <Screen scroll={false} edges={[]} contentStyle={{ padding: Spacing.three, gap: Spacing.three, alignItems: 'center', justifyContent: 'center' }}>
      <T type="caption" style={{ textAlign: 'center' }}>
        {t('qr_show')}
      </T>

      <View style={styles.qrCard}>
        {membership.active && !membership.frozen ? (
          <QRCode value={payload} size={230} backgroundColor="#FFFFFF" color="#0B0F14" />
        ) : (
          <View style={{ width: 230, height: 230, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="lock-closed" size={48} color="#5B6673" />
            <T type="body" color="#5B6673" style={{ textAlign: 'center' }}>
              {membership.frozen ? t('frozen_title') : t('qr_no_plan')}
            </T>
          </View>
        )}
        <Row gap={6} style={{ marginTop: Spacing.three }}>
          <Ionicons name="refresh" size={14} color="#5B6673" />
          <T type="small" color="#5B6673">
            {t('qr_refresh', { n: left })}
          </T>
        </Row>
      </View>

      <Card style={{ alignSelf: 'stretch', gap: Spacing.two }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T type="subheading">{user?.name}</T>
          {membership.active ? <Badge label={membership.frozen ? t('status_frozen') : t('status_active')} color={membership.frozen ? Colors.info : Colors.success} /> : <Badge label={t('status_inactive')} color={Colors.danger} />}
        </Row>
        <T type="small" color={Colors.textSecondary}>
          {membership.plan ? t('plan_until', { name: td(membership.plan.name), date: membership.endDate ? formatDateLong(membership.endDate) : '' }) : t('plan_none')}
        </T>
        <T type="small" color={Colors.textSecondary}>
          {t('home_club_label', { name: club?.name ?? '' })}
        </T>
      </Card>

      {membership.active && !membership.frozen ? (
        <Button title={visitedToday ? t('qr_visited') : t('qr_demo_checkin')} variant="secondary" icon="log-in-outline" onPress={simulate} disabled={visitedToday} style={{ alignSelf: 'stretch' }} />
      ) : (
        <Button title={t('to_plans')} icon="card-outline" onPress={() => router.replace('/membership')} style={{ alignSelf: 'stretch' }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrCard: { backgroundColor: '#FFFFFF', borderRadius: Radius.xl, padding: Spacing.four, alignItems: 'center' },
});
