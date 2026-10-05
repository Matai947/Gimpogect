import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MemberResult, StaffAccent, entryDecision } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Avatar, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useI18n, useMembers } from '@/store/app-context';

type Filter = 'all' | 'active' | 'expiring' | 'expired' | 'frozen';

export default function StaffMembersScreen() {
  const { t, td } = useI18n();
  const { list } = useMembers();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

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
      .filter((m) => (q ? m.name.toLowerCase().includes(q) || m.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) || m.id.includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [list, query, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'active', label: t('filter_active') },
    { key: 'expiring', label: t('filter_expiring') },
    { key: 'expired', label: t('filter_expired') },
    { key: 'frozen', label: t('filter_frozen') },
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
                  {m.isSelf ? (
                    <T type="small" color={StaffAccent} style={{ fontWeight: '700' }}>
                      • {t('self_badge')}
                    </T>
                  ) : null}
                </Row>
                <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                  {m.phone} • {m.planName ? `${td(m.planName)}${m.active ? `, ${t('member_days_left', { n: m.daysLeft })}` : ''}` : t('member_no_plan')}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          );
        })}
        {filtered.length === 0 ? <T type="caption">{t('nothing_found')}</T> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, margin: Spacing.three, marginBottom: Spacing.two, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 48 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },
  body: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
