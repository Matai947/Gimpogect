import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Avatar, Badge, ProgressBar, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { sessionsForDate, toISODate, trainerById, type ClassSession } from '@/data/mock';
import { useApp, useI18n, useMembers, type MemberInfo } from '@/store/app-context';

/** Deterministic mock roster per session, plus the device user when they actually booked. */
function rosterFor(s: ClassSession, all: MemberInfo[], selfBooked: boolean): MemberInfo[] {
  let h = 0;
  for (const ch of s.sessionId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const others = all.filter((m) => !m.isSelf && m.active);
  const count = Math.min(others.length, Math.max(2, s.booked % 7));
  const picked: MemberInfo[] = [];
  for (let i = 0; i < count; i++) picked.push(others[(h + i * 7) % others.length]);
  const unique = picked.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
  const self = all.find((m) => m.isSelf);
  return selfBooked && self ? [self, ...unique] : unique;
}

export default function StaffClassesScreen() {
  const { staff, attendance, toggleAttendance, bookings } = useApp();
  const { t, td } = useI18n();
  const { list } = useMembers();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const clubId = staff?.clubId ?? 'c1';
  const todayIso = toISODate(new Date());
  const sessions = useMemo(() => sessionsForDate(todayIso).filter((s) => s.clubId === clubId), [todayIso, clubId]);
  const [open, setOpen] = useState<string | null>(focus ?? sessions[0]?.sessionId ?? null);

  return (
    <View style={styles.root}>
      <StaffHeader title={t('classes_today')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? <T type="caption">{t('no_classes_today')}</T> : null}
        {sessions.map((s) => {
          const roster = rosterFor(s, list, bookings.includes(s.sessionId));
          const marked = attendance[s.sessionId] ?? [];
          const isOpen = open === s.sessionId;
          const presentCount = roster.filter((m) => marked.includes(m.id)).length;
          return (
            <View key={s.sessionId} style={[styles.card, isOpen && { borderColor: 'rgba(217,100,58,0.5)' }]}>
              <Pressable onPress={() => setOpen(isOpen ? null : s.sessionId)} style={styles.head}>
                <View style={[styles.time, { borderLeftColor: s.color }]}>
                  <T type="label">{s.time}</T>
                  <T type="small" color={Colors.textSecondary}>
                    {s.durationMin} {t('min')}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T type="subheading">{td(s.title)}</T>
                  <T type="small" color={Colors.textSecondary}>
                    {trainerById(s.trainerId)?.name} • {td(s.room)}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge label={t('attendees_n', { a: presentCount, b: roster.length })} color={presentCount === roster.length && roster.length > 0 ? Colors.success : StaffAccent} />
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                </View>
              </Pressable>
              {isOpen ? (
                <View style={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two }}>
                  <ProgressBar value={roster.length ? presentCount / roster.length : 0} color={StaffAccent} />
                  {roster.length === 0 ? <T type="caption">{t('no_attendees')}</T> : null}
                  {roster.map((m) => {
                    const present = marked.includes(m.id);
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          toggleAttendance(s.sessionId, m.id);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        style={[styles.person, present && styles.personOn]}>
                        <Avatar name={m.name} size={36} />
                        <View style={{ flex: 1 }}>
                          <Row gap={6}>
                            <T type="body" style={{ fontWeight: '600' }}>
                              {m.name}
                            </T>
                            {m.isSelf ? <Badge label={t('self_badge')} color={StaffAccent} /> : null}
                          </Row>
                          <T type="small" color={present ? Colors.success : Colors.textMuted}>
                            {present ? t('present') : t('absent')}
                          </T>
                        </View>
                        <Ionicons name={present ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={present ? Colors.success : Colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  time: { borderLeftWidth: 3, paddingLeft: 10, minWidth: 64 },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  personOn: { borderColor: 'rgba(76,195,138,0.5)', backgroundColor: 'rgba(76,195,138,0.08)' },
});
