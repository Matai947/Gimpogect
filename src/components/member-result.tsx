import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, Chip, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { goalTitle } from '@/data/fitness';
import { clubById, formatDateHuman, formatDateLong, formatPrice, plans, trainerById } from '@/data/mock';
import { useApp, useI18n, useMembers, usePresence, type MemberInfo } from '@/store/app-context';

export const hm = (ts: number) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const StaffAccent = '#D9643A';

/** Decides whether a member may enter right now and why not. */
export function entryDecision(m: MemberInfo, t: (k: any, v?: any) => string): { ok: boolean; reason?: string } {
  if (!m.planId || !m.endDate) return { ok: false, reason: t('member_no_plan') };
  if (!m.active) return { ok: false, reason: t('member_expired') };
  if (m.frozen) return { ok: false, reason: t('member_frozen') };
  if (m.dayOnly && new Date().getHours() >= 17) return { ok: false, reason: t('member_day_only') };
  return { ok: true };
}

export function MemberResult({ member: snapshot, onDone, compact }: { member: MemberInfo; onDone?: () => void; compact?: boolean }) {
  const { t, td } = useI18n();
  // The scanner passes a snapshot; re-read so the card updates right after a plan is issued.
  const member = useMembers().byId(snapshot.id) ?? snapshot;
  const { staff, logCheckin, checkoutMember, grantPlan } = useApp();
  const here = usePresence().find((p) => p.memberId === snapshot.id);
  const [logged, setLogged] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [granted, setGranted] = useState<string | null>(null);

  const [choice, setChoice] = useState<string | null>(null);
  const chosen = plans.find((p) => p.id === choice);

  const grant = (planId: string) => {
    grantPlan(member.id, planId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPicking(false);
    setChoice(null);
    setGranted(planId);
  };
  const decision = entryDecision(member, t);
  const club = clubById(member.homeClubId);

  const allow = () => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    logCheckin({ memberId: member.id, name: member.name, ok: true, clubId: staff?.clubId ?? member.homeClubId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setLogged(t('entry_logged', { name: member.name, time }));
  };

  const giveAccess = () => {
    grantPlan(member.id, 'guest');
    setGranted('guest');
    allow();
  };

  const deny = () => {
    logCheckin({ memberId: member.id, name: member.name, ok: false, reason: decision.reason, clubId: staff?.clubId ?? member.homeClubId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    onDone?.();
  };

  return (
    <View style={[styles.card, { borderColor: decision.ok ? 'rgba(76,195,138,0.5)' : 'rgba(240,96,93,0.5)' }]}>
      <View style={[styles.stripe, { backgroundColor: decision.ok ? Colors.success : Colors.danger }]} />
      <View style={{ flex: 1, minWidth: 0, padding: Spacing.three, gap: Spacing.two }}>
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
              {member.phone} • {club?.name.replace('Seven Gym ', '')}
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

        {here ? (
          <View style={{ gap: Spacing.two }}>
            <View style={styles.logged}>
              <Ionicons name="log-in" size={18} color={Colors.success} />
              <T type="small" color={Colors.success} style={{ fontWeight: '700', flex: 1 }}>
                {t('present_since', { from: hm(here.inTs), to: hm(here.until) })}
              </T>
            </View>
            <Button
              title={t('mark_exit')}
              icon="log-out-outline"
              variant="secondary"
              onPress={() => {
                checkoutMember(member.id);
                setLogged(null);
              }}
            />
          </View>
        ) : logged ? (
          <View style={styles.logged}>
            <Ionicons name="checkmark-done" size={18} color={Colors.success} />
            <T type="small" color={Colors.success} style={{ fontWeight: '700', flex: 1 }}>
              {logged}
            </T>
          </View>
        ) : (
          <View style={{ gap: Spacing.two }}>
            <Row gap={Spacing.two}>
              {decision.ok ? (
                <>
                  <Button title={t('allow_entry')} icon="log-in-outline" onPress={allow} style={{ flex: 1 }} />
                  <Button title="" icon="card-outline" variant="ghost" onPress={() => setPicking((v) => !v)} style={{ paddingHorizontal: 14 }} />
                </>
              ) : (
                <>
                  <Button title={t('give_access')} icon="key-outline" onPress={giveAccess} style={{ flex: 1 }} />
                  <Button title="" icon="close" variant="danger" onPress={deny} style={{ paddingHorizontal: 14 }} />
                </>
              )}
              <Button title="" icon="call-outline" variant="ghost" onPress={() => Linking.openURL(`tel:${member.phone.replace(/\s/g, '')}`)} style={{ paddingHorizontal: 14 }} />
            </Row>
            {!decision.ok ? <Button title={t('sell_plan')} variant="secondary" icon="card-outline" onPress={() => setPicking((v) => !v)} /> : null}
          </View>
        )}
        {/* Full client profile for the front desk */}
        <View style={styles.grid}>
          <Fact label={t('fact_since')} value={formatDateLong(member.since)} />
          <Fact label={t('fact_last_visit')} value={member.lastVisit ? formatDateHuman(member.lastVisit) : '—'} />
          <Fact label={t('fact_visits_total')} value={String(member.visitsTotal)} />
          <Fact label={t('fact_age_goal')} value={[member.age ? t('age_n', { n: member.age }) : '', member.goal ? goalTitle(member.goal) : ''].filter(Boolean).join(' • ') || '—'} />
          <Fact label={t('fact_trainer')} value={member.trainerId ? (trainerById(member.trainerId)?.name ?? '—') : t('fact_no_trainer')} />
          <Fact label={t('fact_freeze')} value={t('days_n', { n: member.freezeDaysLeft })} />
          {member.params ? <Fact label={t('my_params')} value={member.params} /> : null}
          {member.bookingsToday ? <Fact label={t('fact_bookings_today')} value={String(member.bookingsToday)} accent /> : null}
          {member.ordersReady ? <Fact label={t('fact_orders_ready')} value={String(member.ordersReady)} accent /> : null}
        </View>

        {picking ? (
          <View style={styles.picker}>
            <T type="small" color={Colors.textSecondary}>
              {t('grant_pick')}
            </T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {plans.map((p) => (
                <Chip key={p.id} label={p.staffOnly ? t('guest_pass') : p.trial ? t('trial_grant') : `${td(p.name)} · ${formatPrice(p.price)}`} active={choice === p.id} onPress={() => setChoice(p.id)} />
              ))}
            </Row>
            {chosen ? (
              <Button
                title={chosen.price > 0 ? t('grant_confirm', { price: formatPrice(chosen.price), name: td(chosen.name) }) : t('grant_confirm_free', { name: td(chosen.name) })}
                icon="checkmark-circle-outline"
                onPress={() => grant(chosen.id)}
              />
            ) : null}
          </View>
        ) : null}
        {granted && member.endDate ? (
          <View style={styles.logged}>
            <Ionicons name="card" size={18} color={Colors.success} />
            <T type="small" color={Colors.success} style={{ fontWeight: '700', flex: 1 }}>
              {t('grant_done', { name: td(member.planName ?? ''), date: formatDateLong(member.endDate) })}
            </T>
          </View>
        ) : null}
        {(logged || here) && onDone ? <Button title={t('scan_again')} variant="secondary" icon="qr-code-outline" onPress={onDone} size="sm" /> : null}
      </View>
    </View>
  );
}

export function Fact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.fact}>
      <T type="small" color={Colors.textMuted} style={{ fontSize: 10.5 }} numberOfLines={1}>
        {label}
      </T>
      <T type="small" color={accent ? StaffAccent : Colors.text} style={{ fontWeight: '700' }} numberOfLines={2}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: { width: '48%', flexGrow: 1, gap: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, overflow: 'hidden', flexDirection: 'row' },
  stripe: { width: 6 },
  verdict: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planBox: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 12, gap: 4 },
  picker: { gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  logged: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(76,195,138,0.12)' },
});
