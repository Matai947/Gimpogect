import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Fact, entryDecision } from '@/components/member-result';
import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { Avatar, Button, Chip, ChipRow, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { goalTitle } from '@/data/fitness';
import { clubById, formatDateHuman, formatDateLong, formatPrice, trainerById } from '@/data/mock';
import { useI18n, useMembers, useSales } from '@/store/app-context';

type Filter = 'all' | 'active' | 'expiring' | 'expired' | 'frozen';

export default function OwnerClients() {
  const { t, td } = useI18n();
  const { list } = useMembers();
  const sales = useSales();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const paid = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => s.memberId && m.set(s.memberId, (m.get(s.memberId) ?? 0) + s.amount));
    return m;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((m) => {
        if (filter === 'active') return m.active && !m.frozen;
        if (filter === 'expiring') return m.active && m.daysLeft <= 7;
        if (filter === 'expired') return !m.active;
        if (filter === 'frozen') return m.frozen;
        return true;
      })
      .filter((m) => (q ? m.name.toLowerCase().includes(q) || m.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) : true))
      .sort((a, b) => (paid.get(b.id) ?? 0) - (paid.get(a.id) ?? 0));
  }, [list, query, filter, paid]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'active', label: t('filter_active') },
    { key: 'expiring', label: t('filter_expiring') },
    { key: 'expired', label: t('filter_expired') },
    { key: 'frozen', label: t('filter_frozen') },
  ];

  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_clients')} />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('members_search_ph')} placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
      </View>
      <ChipRow>
        {filters.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <T type="small" color={Colors.textMuted}>
          {t('members_n', { n: filtered.length })}
        </T>
        {filtered.map((m) => {
          const ok = entryDecision(m, t).ok;
          const open = openId === m.id;
          return (
            <View key={m.id} style={styles.row}>
              <Pressable onPress={() => setOpenId(open ? null : m.id)} style={styles.rowHead}>
                <View style={[styles.dot, { backgroundColor: ok ? Colors.success : m.frozen ? Colors.info : Colors.danger }]} />
                <Avatar name={m.name} size={40} />
                <View style={{ flex: 1 }}>
                  <T type="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                    {m.name}
                  </T>
                  <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                    {m.planName ? `${td(m.planName)}${m.active ? ` • ${t('member_days_left', { n: m.daysLeft })}` : ''}` : t('member_no_plan')}
                  </T>
                </View>
                <T type="small" color={OwnerAccent} style={{ fontWeight: '700' }}>
                  {formatPrice(paid.get(m.id) ?? 0)}
                </T>
              </Pressable>
              {open ? (
                <View style={{ gap: Spacing.two, padding: Spacing.three, paddingTop: 0 }}>
                  <T type="small" color={Colors.textSecondary}>
                    {m.phone} • {clubById(m.homeClubId)?.name}
                  </T>
                  <View style={styles.grid}>
                    <Fact label={t('client_ltv')} value={formatPrice(paid.get(m.id) ?? 0)} accent />
                    <Fact label={t('fact_since')} value={formatDateLong(m.since)} />
                    <Fact label={t('fact_last_visit')} value={m.lastVisit ? formatDateHuman(m.lastVisit) : '—'} />
                    <Fact label={t('fact_visits_total')} value={String(m.visitsTotal)} />
                    <Fact label={t('fact_age_goal')} value={[m.age ? t('age_n', { n: m.age }) : '', m.goal ? goalTitle(m.goal) : ''].filter(Boolean).join(' • ') || '—'} />
                    <Fact label={t('fact_trainer')} value={m.trainerId ? (trainerById(m.trainerId)?.name ?? '—') : t('fact_no_trainer')} />
                  </View>
                  {m.note ? (
                    <T type="small" color={Colors.warning}>
                      {m.note}
                    </T>
                  ) : null}
                  <Button title={t('call')} icon="call-outline" variant="secondary" size="sm" onPress={() => Linking.openURL(`tel:${m.phone.replace(/\s/g, '')}`)} />
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
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, margin: Spacing.three, marginBottom: Spacing.two, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 48 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 16 },
  body: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
