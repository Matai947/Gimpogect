import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Button, Card, Row, Screen, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { DAY_ONLY_UNTIL, clubById, clubHour, formatDateLong, toISODate } from '@/data/mock';
import { fetchQrProof } from '@/lib/api';
import { PushPrompt } from '@/components/push-prompt';
import { useApp, useI18n, useMembershipInfo } from '@/store/app-context';

const REFRESH_SEC = 30;

export default function QrScreen() {
  const { user, visits, token, freeEntry } = useApp();
  const { t, td } = useI18n();
  const membership = useMembershipInfo();
  const [proof, setProof] = useState<{ code: string; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const club = clubById(user?.homeClubId ?? 'c1');
  const visitedToday = visits.some((v) => v.date === toISODate(new Date()));

  // A fresh server-signed proof (valid 90 s) so the scanner can let the client in. Phones (Android above all) freeze a page
  // in the background, so a QR opened again could carry a dead proof: the age is counted by this phone's own clock since
  // the proof arrived (a phone set an hour off does not matter), it is renewed every 30 s, at once when the app comes back,
  // and every 3 s while the network fails. A stale proof is never shown.
  useEffect(() => {
    if (!user || !token) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      clearTimeout(timer);
      const c = await fetchQrProof(user.id, token);
      if (!live) return;
      if (c) setProof({ code: c, at: Date.now() });
      // two loads may overlap (open + return): only one timer chain survives
      clearTimeout(timer);
      timer = setTimeout(load, c ? REFRESH_SEC * 1000 : 3000);
    };
    void load();
    const onBack = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void load();
    };
    // the web page hears its own visibility; AppState is for the native app (on the web it is the same event, twice)
    const web = typeof document !== 'undefined';
    const sub = web ? null : AppState.addEventListener('change', (st) => st === 'active' && onBack());
    if (web) document.addEventListener('visibilitychange', onBack);
    return () => {
      live = false;
      clearTimeout(timer);
      sub?.remove();
      if (web) document.removeEventListener('visibilitychange', onBack);
    };
  }, [user, token]);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const age = proof ? Math.max(0, Math.round((now - proof.at) / 1000)) : 999;
  const fresh = age < 75;
  const left = Math.max(0, REFRESH_SEC - age);
  const payload = JSON.stringify({ uid: user?.id ?? 'guest', ...(proof && fresh ? { c: proof.code } : {}) });

  const dayClosed = !!membership.plan?.dayOnly && clubHour() >= DAY_ONLY_UNTIL;
  // no running pass, but the manager allowed entry without one: the QR is shown as usual
  const open = (membership.active && !membership.frozen && !dayClosed) || (!!freeEntry && !membership.active);

  return (
    <Screen scroll={false} edges={[]} contentStyle={{ padding: Spacing.three, gap: Spacing.three, alignItems: 'center', justifyContent: 'center' }}>
      <T type="caption" style={{ textAlign: 'center' }}>
        {t('qr_show')}
      </T>

      <View style={styles.qrCard}>
        {open && !fresh ? (
          <View style={{ width: 250, height: 250, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <ActivityIndicator size="large" color="#5B6673" />
            <T type="small" color="#5B6673" style={{ textAlign: 'center' }}>
              {t('qr_loading')}
            </T>
          </View>
        ) : open ? (
          <QRCode value={payload} size={250} quietZone={24} ecl="M" backgroundColor="#FFFFFF" color="#000000" />
        ) : (
          <View style={{ width: 230, height: 230, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="lock-closed" size={48} color="#5B6673" />
            <T type="body" color="#5B6673" style={{ textAlign: 'center' }}>
              {membership.frozen ? t('frozen_title') : dayClosed ? t('member_day_only') : t('qr_no_plan')}
            </T>
          </View>
        )}
        {open && fresh ? (
          <Row gap={6} style={{ marginTop: Spacing.three }}>
            <Ionicons name="refresh" size={14} color="#5B6673" />
            <T type="small" color="#5B6673">
              {t('qr_refresh', { n: left })}
            </T>
          </Row>
        ) : null}
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

      {open ? (
        visitedToday ? <Badge label={t('qr_visited')} color={Colors.success} /> : null
      ) : (
        <Button title={t('to_plans')} icon="card-outline" onPress={() => router.replace('/membership')} style={{ alignSelf: 'stretch' }} />
      )}
      {/* at the desk the admin can help turn notifications on: asked every time, «later» or not */}
      <View style={{ alignSelf: 'stretch' }}>
        <PushPrompt always />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrCard: { backgroundColor: '#FFFFFF', borderRadius: Radius.xl, padding: Spacing.four, alignItems: 'center' },
});
