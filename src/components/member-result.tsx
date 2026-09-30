import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, formatDateLong } from '@/data/mock';
import { useApp, useI18n, type MemberInfo } from '@/store/app-context';

export const StaffAccent = '#4FB6E3';

/** Decides whether a member may enter right now and why not. */
export function entryDecision(m: MemberInfo, t: (k: any, v?: any) => string): { ok: boolean; reason?: string } {
  if (!m.planId || !m.endDate) return { ok: false, reason: t('member_no_plan') };
  if (!m.active) return { ok: false, reason: t('member_expired') };
  if (m.frozen) return { ok: false, reason: t('member_frozen') };
  if (m.dayOnly && new Date().getHours() >= 17) return { ok: false, reason: t('member_day_only') };
  return { ok: true };
}

export function MemberResult({ member, onDone, compact }: { member: MemberInfo; onDone?: () => void; compact?: boolean }) {
  const { t, td } = useI18n();
  const { staff, logCheckin } = useApp();
  const [logged, setLogged] = useState<string | null>(null);
  const decision = entryDecision(member, t);
  const club = clubById(member.homeClubId);

  const allow = () => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    logCheckin({ memberId: member.id, name: member.name, ok: true, clubId: staff?.clubId ?? member.homeClubId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setLogged(t('entry_logged', { name: member.name, time }));
  };

  const deny = () => {
    logCheckin({ memberId: member.id, name: member.name, ok: false, reason: decision.reason, clubId: staff?.clubId ?? member.homeClubId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    onDone?.();
  };

  return (
    <View style={[styles.card, { borderColor: decision.ok ? 'rgba(76,195,138,0.5)' : 'rgba(240,96,93,0.5)' }]}>
      <View style={[styles.stripe, { backgroundColor: decision.ok ? Colors.success : Colors.danger }]} />
      <View style={{ padding: Spacing.three, gap: Spacing.two }}>
        <Row gap={Spacing.three}>
          <Avatar name={member.name} size={compact ? 44 : 56} />
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <T type={compact ? 'subheading' : 'heading'} style={{ flexShrink: 1 }} numberOfLines={1}>
                {member.name}
              </T>
              {member.isSelf ? <Badge label={t('self_badge')} color={StaffAccent} /> : null}
            </Row>
            <T type="small" color={Colors.textSecondary}>
              {member.phone} • {club?.name.replace('Gym Project ', '')}
            </T>
          </View>
          <View style={[styles.verdict, { backgroundColor: decision.ok ? 'rgba(76,195,138,0.15)' : 'rgba(240,96,93,0.15)' }]}>
            <Ionicons name={decision.ok ? 'checkmark-circle' : 'close-circle'} size={26} color={decision.ok ? Colors.success : Colors.danger} />
          </View>
        </Row>

        <View style={styles.planBox}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="body" style={{ fontWeight: '700' }} color={decision.ok ? Colors.text : Colors.danger}>
              {member.planId && member.endDate ? t('member_plan_until', { name: td(member.planName ?? ''), date: formatDateLong(member.endDate) }) : t('member_no_plan')}
            </T>
            {member.active ? (
              <T type="small" color={member.daysLeft <= 7 ? Colors.warning : Colors.textSecondary}>
                {t('member_days_left', { n: member.daysLeft })}
              </T>
            ) : null}
          </Row>
          <T type="small" color={Colors.textSecondary}>
            {t('member_visits_month', { n: member.visitsThisMonth })}
            {member.note ? ` • ${member.note}` : ''}
          </T>
          {!decision.ok ? (
            <Row gap={6} style={{ marginTop: 4 }}>
              <Ionicons name="alert-circle" size={14} color={Colors.danger} />
              <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                {decision.reason}
              </T>
            </Row>
          ) : null}
        </View>

        {logged ? (
          <View style={styles.logged}>
            <Ionicons name="checkmark-done" size={18} color={Colors.success} />
            <T type="small" color={Colors.success} style={{ fontWeight: '700', flex: 1 }}>
              {logged}
            </T>
          </View>
        ) : (
          <Row gap={Spacing.two}>
            {decision.ok ? (
              <Button title={t('allow_entry')} icon="log-in-outline" onPress={allow} style={{ flex: 1 }} />
            ) : (
              <>
                <Button title={t('deny_entry')} variant="danger" icon="close" onPress={deny} style={{ flex: 1 }} />
                <Button title={t('sell_plan')} variant="secondary" icon="card-outline" onPress={() => Alert.alert(t('sell_plan'), t('sell_plan_alert'))} style={{ flex: 1 }} />
              </>
            )}
            <Button title="" icon="call-outline" variant="ghost" onPress={() => Linking.openURL(`tel:${member.phone.replace(/\s/g, '')}`)} style={{ paddingHorizontal: 14 }} />
          </Row>
        )}
        {logged && onDone ? <Button title={t('scan_again')} variant="secondary" icon="qr-code-outline" onPress={onDone} size="sm" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, overflow: 'hidden', flexDirection: 'row' },
  stripe: { width: 6 },
  verdict: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planBox: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 12, gap: 4 },
  logged: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(76,195,138,0.12)' },
});
