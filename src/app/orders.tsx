import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Card, Divider, EmptyState, Row, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { clubById, formatDateHuman, formatPrice } from '@/data/mock';
import { productById } from '@/data/shop';
import { useApp, useI18n } from '@/store/app-context';

const statusColor = { Готовится: Colors.warning, 'Готов к выдаче': Colors.success, Выдан: Colors.textSecondary } as const;
const statusKey = { Готовится: 'st_preparing', 'Готов к выдаче': 'st_ready', Выдан: 'st_done' } as const;

export default function OrdersScreen() {
  const { orders: rawOrders, orderStatusOverrides } = useApp();
  const orders = rawOrders.map((o) => ({ ...o, status: orderStatusOverrides[o.id] ?? o.status }));
  const { t } = useI18n();

  if (orders.length === 0) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="receipt-outline" title={t('no_orders')} subtitle={t('no_orders_sub')} action={t('to_shop')} onAction={() => router.replace('/(tabs)/shop')} />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <View style={{ padding: Spacing.three, gap: Spacing.three }}>
        {orders.map((o) => (
          <Card key={o.id} style={{ gap: Spacing.two }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T type="subheading">{t('order_n', { id: o.id })}</T>
                <T type="small" color={Colors.textSecondary}>
                  {formatDateHuman(o.date)} • {clubById(o.clubId)?.name}
                </T>
              </View>
              <Badge label={t(statusKey[o.status])} color={statusColor[o.status]} />
            </Row>
            <Divider />
            {o.items.map((it) => {
              const p = productById(it.productId);
              if (!p) return null;
              return (
                <Row key={it.key} gap={Spacing.two}>
                  <Image source={{ uri: p.image }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.surfaceAlt }} contentFit="cover" />
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
              <T type="small" color={Colors.textSecondary}>
                {t('discount')} {o.discount ? `− ${formatPrice(o.discount)}` : '—'}
              </T>
              <T type="label" color={Colors.accent}>
                {formatPrice(o.total)}
              </T>
            </Row>
            {o.status !== 'Выдан' ? (
              <View style={{ alignItems: 'center', gap: 6, paddingVertical: Spacing.two }}>
                <View style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: 12 }}>
                  <QRCode value={JSON.stringify({ v: 1, t: 'order', id: o.id })} size={120} backgroundColor="#FFFFFF" color="#0B0F14" />
                </View>
                <T type="small" color={Colors.textMuted}>
                  {t('order_qr_hint')}
                </T>
              </View>
            ) : (
              <Row gap={6}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
                <T type="small" color={Colors.textMuted}>
                  {t('show_id')}
                </T>
              </Row>
            )}
          </Card>
        ))}
      </View>
    </Screen>
  );
}
