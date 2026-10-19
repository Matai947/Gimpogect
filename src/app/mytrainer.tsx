import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StaffAccent } from '@/components/member-result';
import { Card, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, clubById, formatDateHuman, formatDateLong, toISODate, trainerById } from '@/data/mock';
import { fetchTrainerMe, type TrainerMe } from '@/lib/api';
import { useApp, useI18n, useNow } from '@/store/app-context';

const DAY = 86400000;

/** A trainer's own page: working hours, group classes for two weeks, sessions the administrators recorded, personal clients. */
export default function MyTrainerScreen() {
  const { trainerAuth, trainerLogout } = useApp();
  const { t } = useI18n();
  const now = useNow();
  const [me, setMe] = useState<TrainerMe | null>(null);
  const [expired, setExpired] = useState(false);
  const token = trainerAuth?.token;

  useEffect(() => {
    let live = true;
    if (token)
      fetchTrainerMe(token).then((r) => {
        if (!live) return;
        if (r) setMe(r);
        else setExpired(true);
      });
    return () => {
      live = false;
    };
  }, [token]);

  // Trainer data (name, hours) comes from the shared content, so it follows the administrators' edits.
  const trainer = trainerAuth ? trainerById(trainerAuth.id) : undefined;

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);
  // Group classes and personal sessions of the next two weeks, day by day, by time.
  type Slot = { key: string; time: string; title: string; sub: string; color: string; phone?: string; personal: boolean };
  const week = useMemo(() => {
    return days
      .map((d) => {
        const iso = toISODate(d);
        const group: Slot[] = (me?.classes ?? [])
          .filter((c) => c.weekdays.includes(d.getDay()))
          .map((c) => ({ key: 'g' + c.id + iso, time: c.time, title: c.title, sub: `${clubById(c.clubId)?.name.replace('Seven Gym ', '') ?? ''}${c.room ? ' • ' + c.room : ''} • ${c.durationMin} ${t('min')}`, color: c.color, personal: false }));
        const personal: Slot[] = (me?.appointments ?? [])
          .filter((a) => (a.kind === 'weekly' ? a.weekdays.includes(d.getDay()) : a.date === iso))
          .map((a) => ({ key: 'p' + a.id + iso, time: a.time, title: a.clientName, sub: `${t('tm_personal')} • ${clubById(a.clubId)?.name.replace('Seven Gym ', '') ?? ''} • ${a.durationMin} ${t('min')}${a.note ? ' • ' + a.note : ''}`, color: StaffAccent, phone: a.clientPhone || undefined, personal: true }));
        return { iso, items: [...group, ...personal].sort((x, y) => x.time.localeCompare(y.time)) };
      })
      .filter((d) => d.items.length > 0);
  }, [days, me, t]);

  const thirtyAgo = toISODate(addDays(new Date(), -30));
  const sessions = (me?.sessions ?? []).filter((s) => s.date >= thirtyAgo);
  const total = sessions.reduce((sum, s) => sum + s.sessions, 0);

  // One line per client: the latest payment and what it covers (a month, as the trainers' price is monthly).
  const clients = useMemo(() => {
    const byName = new Map<string, { name: string; ts: number }>();
    (me?.clients ?? []).forEach((c) => {
      const key = c.name.toLowerCase();
      if (!byName.has(key) || (byName.get(key)?.ts ?? 0) < c.ts) byName.set(key, { name: c.name, ts: c.ts });
    });
    return [...byName.values()].sort((a, b) => b.ts - a.ts);
  }, [me]);

  if (!trainerAuth || expired) return <Redirect href={'/trainer-login' as Href} />;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Row gap={Spacing.three} style={styles.head}>
          {trainer?.photo ? <Image source={trainer.photo} style={styles.ava} contentFit="cover" contentPosition="top" /> : <View style={[styles.ava, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="barbell-outline" size={26} color={StaffAccent} /></View>}
          <View style={{ flex: 1 }}>
            <T type="small" color={Colors.textSecondary}>
              {t('tm_title')}
            </T>
            <T type="heading" numberOfLines={2}>
              {trainer?.name ?? trainerAuth.id}
            </T>
          </View>
          <Pressable
            onPress={() => {
              trainerLogout();
              router.replace('/staff-login' as Href);
            }}
            hitSlop={10}
            style={styles.out}
            accessibilityLabel={t('tm_logout')}>
            <Ionicons name="log-out-outline" size={22} color={Colors.text} />
          </Pressable>
        </Row>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Card style={{ gap: 4 }}>
            <T type="small" color={Colors.textSecondary}>
              {t('tm_hours')}
            </T>
            <T type="body" style={{ fontWeight: '700' }}>
              {trainer?.schedule || t('tm_hours_none')}
            </T>
          </Card>

          <T type="subheading">{t('tm_week')}</T>
          {week.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('tm_week_none')}
            </T>
          ) : (
            week.map((d) => (
              <View key={d.iso} style={{ gap: 6 }}>
                <T type="label" color={Colors.textSecondary}>
                  {formatDateHuman(d.iso)}
                </T>
                {d.items.map((c) => (
                  <Row key={c.key} gap={Spacing.two} style={styles.row}>
                    <View style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, backgroundColor: c.color }} />
                    <View style={{ flex: 1 }}>
                      <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                        {c.time} • {c.title}
                      </T>
                      <T type="small" color={Colors.textMuted} numberOfLines={2}>
                        {c.sub}
                      </T>
                    </View>
                    {c.phone ? <Ionicons name="call-outline" size={22} color={StaffAccent} onPress={() => Linking.openURL(`tel:${c.phone?.replace(/\s/g, '')}`)} accessibilityLabel={t('tm_call')} /> : null}
                  </Row>
                ))}
              </View>
            ))
          )}

          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T type="subheading">{t('tm_sessions')}</T>
            <T type="small" color={StaffAccent} style={{ fontWeight: '800' }}>
              {t('tm_sessions_total', { n: total })}
            </T>
          </Row>
          {sessions.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('tm_sessions_none')}
            </T>
          ) : (
            sessions.slice(0, 20).map((s) => (
              <Row key={s.id} gap={Spacing.two} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <T type="small" style={{ fontWeight: '700' }}>
                    {formatDateHuman(s.date)}
                  </T>
                  <T type="small" color={Colors.textMuted} numberOfLines={1}>
                    {clubById(s.clubId)?.name.replace('Seven Gym ', '')}
                    {s.note ? ` • ${s.note}` : ''}
                  </T>
                </View>
                <T type="subheading" color={StaffAccent}>
                  {s.sessions}
                </T>
              </Row>
            ))
          )}

          <T type="subheading">{t('tm_clients')}</T>
          {clients.length === 0 ? (
            <T type="small" color={Colors.textMuted}>
              {t('tm_clients_none')}
            </T>
          ) : (
            clients.map((c) => {
              const until = c.ts + 31 * DAY;
              const active = until >= now;
              return (
                <Row key={c.name} gap={Spacing.two} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                      {c.name}
                    </T>
                    <T type="small" color={active ? Colors.success : Colors.textMuted}>
                      {active ? t('tm_paid_until', { date: formatDateLong(toISODate(new Date(until))) }) : t('tm_expired')}
                    </T>
                  </View>
                </Row>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  head: { padding: Spacing.three, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  ava: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceAlt },
  out: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  row: { alignItems: 'center', padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
});
