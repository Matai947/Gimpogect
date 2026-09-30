import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Badge, Button, Chip, ChipRow, Divider, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { mockOrders } from '@/data/members';
import { clubById, formatDateHuman, formatPrice } from '@/data/mock';
import { useApp, useCatalog, useI18n, useMembers, type Order, type OrderStatus } from '@/store/app-context';

const statusColor: Record<OrderStatus, string> = { Готовится: Colors.warning, 'Готов к выдаче': Colors.success, Выдан: Colors.textSecondary };
const statusKey = { Готовится: 'st_preparing', 'Готов к выдаче': 'st_ready', Выдан: 'st_done' } as const;

export default function StaffOrdersScreen() {
  const { staff, orders, orderStatusOverrides, setOrderStatus } = useApp();
  const { t } = useI18n();
  const { byId } = useMembers();
  const { byId: productById } = useCatalog();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const clubId = staff?.clubId ?? 'c1';

  const all: Order[] = useMemo(() => {
    const merged = [...orders, ...mockOrders.filter((m) => !orders.some((o) => o.id === m.id))];
    return merged.map((o) => ({ ...o, status: orderStatusOverrides[o.id] ?? o.status })).sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : b.date.localeCompare(a.date)));
  }, [orders, orderStatusOverrides, focus]);

  const list = all.filter((o) => (filter === 'all' ? true : o.status !== 'Выдан')).filter((o) => o.clubId === clubId || o.id === focus);

  const advance = (o: Order) => {
    if (o.status === 'Готовится') {
      setOrderStatus(o.id, 'Готов к выдаче');
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    if (o.status === 'Готов к выдаче') {
      setOrderStatus(o.id, 'Выдан');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(t('done'), t('order_issued', { id: o.id }));
    }
  };

  return (
    <View style={styles.root}>
      <StaffHeader title={t('staff_tab_orders')} />
      <ChipRow style={{ paddingVertical: Spacing.three }}>
        <Chip label={t('orders_pending')} active={filter === 'pending'} onPress={() => setFilter('pending')} icon="time-outline" />
        <Chip label={t('orders_all')} active={filter === 'all'} onPress={() => setFilter('all')} />
      </ChipRow>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? <T type="caption">{t('no_orders')}</T> : null}
        {list.map((o) => {
          const member = o.memberId ? byId(o.memberId) : undefined;
          const club = clubById(o.clubId);
          const highlighted = o.id === focus;
          return (
            <View key={o.id} style={[styles.card, highlighted && { borderColor: StaffAccent }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <T type="heading">{o.id}</T>
                  <T type="small" color={Colors.textSecondary}>
                    {formatDateHuman(o.date)} • {club?.name.replace('Gym Project ', '')}
                  </T>
                </View>
                <Badge label={t(statusKey[o.status])} color={statusColor[o.status]} />
              </Row>
              <View style={styles.member}>
                <Ionicons name="person-circle-outline" size={20} color={StaffAccent} />
                <View style={{ flex: 1 }}>
                  <T type="small" color={Colors.textMuted}>
                    {t('order_member')}
                  </T>
                  <T type="body" style={{ fontWeight: '600' }}>
                    {member?.name ?? '—'}
                    {member ? ` • ${member.phone}` : ''}
                  </T>
                </View>
              </View>
              <Divider />
              {o.items.map((it) => {
                const p = productById(it.productId);
                if (!p) return null;
                return (
                  <Row key={it.key} gap={Spacing.two}>
                    <Image source={{ uri: p.image }} style={styles.thumb} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <T type="small" style={{ fontWeight: '600' }} numberOfLines={1}>
                        {p.name}
                      </T>
                      <T type="small" color={Colors.textMuted}>
                        {it.option ? `${it.option} • ` : ''}× {it.qty}
                      </T>
                    </View>
                    <T type="small" style={{ fontWeight: '600' }}>
                      {formatPrice(p.price * it.qty)}
                    </T>
                  </Row>
                );
              })}
              <Divider />
              <Row style={{ justifyContent: 'space-between' }}>
                <T type="label" color={StaffAccent}>
                  {formatPrice(o.total)}
                </T>
                {o.status !== 'Выдан' ? (
                  <Button title={o.status === 'Готовится' ? t('mark_ready') : t('mark_done')} size="sm" icon={o.status === 'Готовится' ? 'checkmark' : 'hand-left-outline'} onPress={() => advance(o)} style={{ backgroundColor: o.status === 'Готовится' ? Colors.surfaceAlt : StaffAccent }} />
                ) : (
                  <Pressable onPress={() => setOrderStatus(o.id, 'Готов к выдаче')} hitSlop={8}>
                    <T type="small" color={Colors.textMuted}>
                      {t('edit')}
                    </T>
                  </Pressable>
                )}
              </Row>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, paddingTop: 0, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.three, gap: Spacing.two },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: Radius.md, backgroundColor: 'rgba(79,182,227,0.08)' },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surfaceAlt },
});
