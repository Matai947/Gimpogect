import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Card, ProgressBar, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { mockOrders } from '@/data/members';
import { clubById, occupancyLabel, sessionsForDate, toISODate, trainerById } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

export default function StaffTodayScreen() {
  const { staff, staffLog, orders, orderStatusOverrides } = useApp();
  const { t, td } = useI18n();
  const clubId = staff?.clubId ?? 'c1';
  const club = clubById(clubId)!;
  const todayIso = toISODate(new Date());

  const todayLog = useMemo(() => staffLog.filter((e) => e.clubId === clubId && toISODate(new Date(e.ts)) === todayIso), [staffLog, clubId, todayIso]);
  const okCount = todayLog.filter((e) => e.ok).length;
  const deniedCount = todayLog.length - okCount;
  const sessions = useMemo(() => sessionsForDate(todayIso).filter((s) => s.clubId === clubId), [todayIso, clubId]);
  const pendingOrders = [...orders, ...mockOrders].filter((o) => o.clubId === clubId && (orderStatusOverrides[o.id] ?? o.status) !== 'Выдан').length;
  const occ = occupancyLabel(club.occupancy);

  return (
    <View style={styles.root}>
      <StaffHeader title={t('staff_tab_today')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <Stat value={okCount} label={t('today_checkins')} icon="log-in-outline" color={Colors.success} onPress={() => router.push('/staff')} />
          <Stat value={deniedCount} label={t('today_denied')} icon="close-circle-outline" color={Colors.danger} />
          <Stat value={sessions.length} label={t('today_classes')} icon="people-outline" color={StaffAccent} onPress={() => router.push('/staff/classes')} />
          <Stat value={pendingOrders} label={t('today_orders')} icon="cube-outline" color={Colors.warning} onPress={() => router.push('/staff/orders')} />
        </View>

        <Card style={{ gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="subheading">{t('occupancy_label')}</T>
            <T type="label" color={occ.color}>
              {club.occupancy}% • {occ.label}
            </T>
          </Row>
          <ProgressBar value={club.occupancy / 100} color={occ.color} height={10} />
        </Card>

        <T type="heading">{t('classes_today')}</T>
        {sessions.length === 0 ? (
          <T type="caption">{t('no_classes_today')}</T>
        ) : (
          sessions.map((s) => (
            <Pressable key={s.sessionId} onPress={() => router.push({ pathname: '/staff/classes', params: { focus: s.sessionId } })} style={styles.session}>
              <View style={[styles.time, { borderLeftColor: s.color }]}>
                <T type="label">{s.time}</T>
                <T type="small" color={Colors.textSecondary}>
                  {s.durationMin} {t('min')}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T type="subheading">{td(s.title)}</T>
                <T type="small" color={Colors.textSecondary}>
                  {trainerById(s.trainerId)?.name} • {td(s.room)} • {s.booked}/{s.capacity}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))
        )}

        <T type="heading">{t('today_recent')}</T>
        {todayLog.length === 0 ? (
          <T type="caption">{t('today_no_checkins')}</T>
        ) : (
          <Card padded={false}>
            {todayLog.slice(0, 12).map((e, i) => (
              <View key={e.ts} style={[styles.logRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border }]}>
                <Ionicons name={e.ok ? 'checkmark-circle' : 'close-circle'} size={20} color={e.ok ? Colors.success : Colors.danger} />
                <View style={{ flex: 1 }}>
                  <T type="body" style={{ fontWeight: '600' }}>
                    {e.name}
                  </T>
                  {e.reason ? (
                    <T type="small" color={Colors.danger}>
                      {e.reason}
                    </T>
                  ) : null}
                </View>
                <T type="small" color={Colors.textMuted}>
                  {new Date(e.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </T>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, icon, color, onPress }: { value: number; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stat, pressed && onPress && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={20} color={color} />
      <T type="display" style={{ fontSize: 30, lineHeight: 34 }}>
        {value}
      </T>
      <T type="small" color={Colors.textSecondary} numberOfLines={2}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stat: { width: '48%', flexGrow: 1, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  session: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  time: { borderLeftWidth: 3, paddingLeft: 10, minWidth: 64 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 12 },
});
