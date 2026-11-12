import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MemberResult, StaffAccent, entryDecision } from '@/components/member-result';
import { LeadsCard } from '@/components/leads-card';
import { StaffHeader } from '@/components/staff-header';
import { Avatar, Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, clubs, toISODate } from '@/data/mock';
import { useApp, useCanManage, useI18n, useMembers, useRefetchOnMiss } from '@/store/app-context';
import { clientAddRemote } from '@/lib/api';
import { personMatches } from '@/lib/phone';

type Filter = 'all' | 'new' | 'active' | 'expiring' | 'expired' | 'frozen' | 'onefit';

export default function StaffMembersScreen() {
  const { t, td } = useI18n();
  const { list } = useMembers();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const { staff, staffCode, refreshClients } = useApp();
  const [add, setAdd] = useState<{ name: string; phone: string; msg?: string; busy?: boolean } | null>(null);
  const canManage = useCanManage();
  // an administrator sees the clients of the club they work at; the manager and the owner can open any club or all of them
  const [club, setClub] = useState<string>(staff?.clubId ?? 'c1');
  const shownClub = canManage ? club : (staff?.clubId ?? 'c1');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const newSince = toISODate(addDays(new Date(), -3));
    const isNew = (m: { since: string }) => m.since >= newSince;
    return list
      // a search looks in every club: a client who picked the other club at sign-up is still found at this desk
      .filter((m) => q || shownClub === 'all' || (m.homeClubId || 'c1') === shownClub)
      .filter((m) => {
        if (filter === 'new') return isNew(m);
        if (filter === 'active') return m.active && !m.frozen;
        if (filter === 'expiring') return m.active && m.daysLeft <= 7;
        if (filter === 'expired') return !m.active;
        if (filter === 'frozen') return m.frozen;
        if (filter === 'onefit') return m.onefitVisits !== undefined;
        return true;
      })
      .filter((m) => personMatches(m, q))
      .sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || a.name.localeCompare(b.name, 'ru'));
  }, [list, query, filter, shownClub]);
  useRefetchOnMiss(query, filtered.length);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'new', label: t('filter_new') },
    { key: 'active', label: t('filter_active') },
    { key: 'expiring', label: t('filter_expiring') },
    { key: 'expired', label: t('filter_expired') },
    { key: 'frozen', label: t('filter_frozen') },
    { key: 'onefit', label: '1Fit' },
  ];

  return (
    <View style={styles.root}>
      <StaffHeader title={t('staff_tab_members')} />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('members_search_ph')} placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {canManage ? (
        <ChipRow>
          {clubs.map((c) => (
            <Chip key={c.id} label={c.name} active={club === c.id} onPress={() => setClub(c.id)} />
          ))}
          <Chip label={t('all_clubs')} active={club === 'all'} onPress={() => setClub('all')} />
        </ChipRow>
      ) : null}
      <ChipRow>
        {filters.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <LeadsCard accent={StaffAccent} />
        <T type="small" color={Colors.textMuted}>
          {t('members_n', { n: filtered.length })}
        </T>
        {filtered.map((m) => {
          const decision = entryDecision(m, t);
          if (openId === m.id) return <MemberResult key={m.id} member={m} compact onDone={() => setOpenId(null)} />;
          return (
            <Pressable key={m.id} onPress={() => setOpenId(m.id)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.surfaceAlt }]}>
              <View style={[styles.dot, { backgroundColor: decision.ok ? Colors.success : m.frozen ? Colors.info : Colors.danger }]} />
              <Avatar name={m.name} size={40} />
              <View style={{ flex: 1 }}>
                <Row gap={6}>
                  <T type="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                    {m.name}
                  </T>
                  {m.since >= toISODate(addDays(new Date(), -3)) && !m.isSelf ? (
                    <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>
                      • {t('new_badge')}
                    </T>
                  ) : null}
                  {(m.homeClubId || 'c1') !== (staff?.clubId ?? 'c1') ? (
                    <T type="small" color={Colors.textMuted}>
                      • {clubs.find((c) => c.id === (m.homeClubId || 'c1'))?.name.replace('Seven Gym ', '')}
                    </T>
                  ) : null}
                  {m.isSelf ? (
                    <T type="small" color={StaffAccent} style={{ fontWeight: '700' }}>
                      • {t('self_badge')}
                    </T>
                  ) : null}
                </Row>
                <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                  {m.phone} • {m.planName ? `${td(m.planName)}${m.active ? `, ${t('member_days_left', { n: m.daysLeft })}` : ''}` : m.onefitVisits !== undefined ? t('member_onefit', { n: m.onefitVisits, date: m.onefitLast ? m.onefitLast.split('-').reverse().join('.') : '—' }) : t('member_no_plan')}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          );
        })}
        {filtered.length === 0 ? <T type="caption">{t('nothing_found')}</T> : null}
        {/* a client whose phone cannot run the app: the manager makes the card here, then sells the plan at the register */}
        {canManage && query.trim() && filtered.length === 0 ? (
          add ? (
            <View style={styles.add}>
              <T type="small" style={{ fontWeight: '700' }}>
                {t('ca_title')}
              </T>
              <TextInput value={add.name} onChangeText={(x) => setAdd({ ...add, name: x })} placeholder={t('ca_name')} placeholderTextColor={Colors.textMuted} maxLength={60} style={styles.addInput} />
              <TextInput value={add.phone} onChangeText={(x) => setAdd({ ...add, phone: x })} placeholder="+7 7__ ___ __ __" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" style={styles.addInput} />
              {add.msg ? (
                <T type="small" color={Colors.danger}>
                  {add.msg}
                </T>
              ) : null}
              <Button
                title={t('ca_save')}
                disabled={add.busy || add.name.trim().length < 2 || add.phone.replace(/\D/g, '').length < 10}
                onPress={async () => {
                  setAdd({ ...add, busy: true, msg: undefined });
                  const r = await clientAddRemote(staffCode, { name: add.name.trim(), phone: add.phone, clubId: shownClub === 'all' ? (staff?.clubId ?? 'c1') : shownClub });
                  if (!r) return setAdd({ ...add, busy: false, msg: t('ca_fail') });
                  await refreshClients();
                  setAdd(null);
                  setQuery(r.name);
                  setOpenId(r.id);
                }}
                style={{ backgroundColor: StaffAccent }}
              />
            </View>
          ) : (
            <Button title={t('ca_open')} icon="person-add-outline" variant="secondary" onPress={() => setAdd(/\d{6,}/.test(query.replace(/\D/g, '')) ? { name: '', phone: query } : { name: query.trim(), phone: '' })} />
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, margin: Spacing.three, marginBottom: Spacing.two, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 48 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 16 },
  body: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  add: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  addInput: { height: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.background },
});
