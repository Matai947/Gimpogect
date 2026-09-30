import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Badge, Button, Card, Chip, ChipRow, Divider, EmptyState, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, clubHours, clubs, formatPrice } from '@/data/mock';
import { useApp, useCartSummary, useI18n, useMembershipInfo } from '@/store/app-context';

export default function CartScreen() {
  const { user, setCartQty, removeFromCart, clearCart, placeOrder, orders } = useApp();
  const { t, tp } = useI18n();
  const membership = useMembershipInfo();
  const [promo, setPromo] = useState('');
  const [applied, setApplied] = useState<string | undefined>();
  const [clubId, setClubId] = useState(user?.homeClubId ?? 'c1');
  const summary = useCartSummary(applied);
  const club = clubById(clubId);

  const applyPromo = () => {
    const code = promo.trim().toUpperCase();
    if (!code) return;
    setApplied(code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const checkout = () => {
    Alert.alert(t('checkout_q'), t('checkout_body', { n: summary.count, total: formatPrice(summary.total), club: club?.name ?? '' }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('place'),
        onPress: () => {
          const order = placeOrder(clubId, applied);
          if (!order) return;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Alert.alert(t('order_ok_title'), t('order_ok_body', { id: order.id }), [{ text: t('to_orders'), onPress: () => router.replace('/orders') }]);
        },
      },
    ]);
  };

  if (summary.lines.length === 0) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="cart-outline" title={t('cart_empty')} subtitle={t('cart_empty_sub')} action={t('to_shop')} onAction={() => router.replace('/(tabs)/shop')} />
        {orders.length > 0 ? (
          <View style={{ paddingHorizontal: Spacing.three }}>
            <Button title={t('my_orders_n', { n: orders.length })} variant="ghost" icon="receipt-outline" onPress={() => router.push('/orders')} />
          </View>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 150 }}>
      <View style={{ padding: Spacing.three, gap: Spacing.two }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T type="heading">{t('items_n', { n: summary.count, i: tp(summary.count, 'items_pl') })}</T>
          <Pressable onPress={() => Alert.alert(t('clear_cart_q'), undefined, [{ text: t('cancel'), style: 'cancel' }, { text: t('clear'), style: 'destructive', onPress: clearCart }])} hitSlop={8}>
            <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
              {t('clear')}
            </T>
          </Pressable>
        </Row>

        {summary.lines.map((l) => (
          <Card key={l.key} padded={false} style={{ flexDirection: 'row', overflow: 'hidden' }}>
            <Pressable onPress={() => router.push(`/product/${l.productId}`)}>
              <Image source={{ uri: l.product.image }} style={styles.img} contentFit="cover" transition={200} />
            </Pressable>
            <View style={{ flex: 1, padding: 12, gap: 4 }}>
              <T type="small" color={Colors.textMuted}>
                {l.product.brand}
              </T>
              <T type="subheading" numberOfLines={2} style={{ fontSize: 14.5 }}>
                {l.product.name}
              </T>
              {l.option ? <Badge label={l.option} color={Colors.textSecondary} /> : null}
              <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <T type="label" color={Colors.accent}>
                  {formatPrice(l.product.price * l.qty)}
                </T>
                <View style={styles.qty}>
                  <Pressable onPress={() => setCartQty(l.key, l.qty - 1)} hitSlop={8} style={styles.qtyBtn}>
                    <Ionicons name={l.qty === 1 ? 'trash-outline' : 'remove'} size={16} color={l.qty === 1 ? Colors.danger : Colors.text} />
                  </Pressable>
                  <T type="label" style={{ minWidth: 20, textAlign: 'center' }}>
                    {l.qty}
                  </T>
                  <Pressable onPress={() => setCartQty(l.key, Math.min(20, l.qty + 1))} hitSlop={8} style={styles.qtyBtn}>
                    <Ionicons name="add" size={16} color={Colors.text} />
                  </Pressable>
                </View>
              </Row>
            </View>
            <Pressable onPress={() => removeFromCart(l.key)} hitSlop={8} style={{ padding: 10 }}>
              <Ionicons name="close" size={16} color={Colors.textMuted} />
            </Pressable>
          </Card>
        ))}
      </View>

      <View style={{ paddingHorizontal: Spacing.three, marginBottom: Spacing.four }}>
        <SectionHeader title={t('where_pickup')} />
        <ChipRow style={{ paddingHorizontal: 0 }}>
          {clubs.map((c) => (
            <Chip key={c.id} label={c.name.replace('Gym Project ', '')} icon="storefront-outline" active={clubId === c.id} onPress={() => setClubId(c.id)} />
          ))}
        </ChipRow>
        <T type="small" color={Colors.textMuted} style={{ marginTop: Spacing.two }}>
          {club?.address} • {club ? clubHours(club) : ''}
        </T>
      </View>

      <View style={{ paddingHorizontal: Spacing.three, marginBottom: Spacing.four }}>
        <SectionHeader title={t('promo')} />
        <Row gap={Spacing.two}>
          <View style={styles.promo}>
            <Ionicons name="ticket-outline" size={18} color={Colors.textSecondary} />
            <TextInput value={promo} onChangeText={setPromo} placeholder="GYM10" placeholderTextColor={Colors.textMuted} autoCapitalize="characters" style={styles.promoInput} />
          </View>
          <Button title={t('apply')} variant="secondary" onPress={applyPromo} disabled={!promo.trim()} />
        </Row>
        {applied ? (
          <T type="small" color={summary.promoValid ? Colors.success : Colors.danger} style={{ marginTop: 6 }}>
            {summary.promoValid ? t('promo_applied', { c: applied }) : t('promo_invalid', { c: applied })}
          </T>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: Spacing.three }}>
        <Card style={{ gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="body" color={Colors.textSecondary}>
              {t('goods')}
            </T>
            <T type="body">{formatPrice(summary.subtotal)}</T>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="body" color={Colors.textSecondary}>
              {summary.discountSource === 'promo' ? t('discount_promo') : summary.discountSource === 'member' ? t('discount_member') : t('discount')}
            </T>
            <T type="body" color={summary.discount ? Colors.success : Colors.textSecondary}>
              {summary.discount ? `− ${formatPrice(summary.discount)}` : '—'}
            </T>
          </Row>
          {!membership.active ? (
            <T type="small" color={Colors.textMuted}>
              {t('member_hint')}
            </T>
          ) : null}
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="heading">{t('total')}</T>
            <T type="heading" color={Colors.accent}>
              {formatPrice(summary.total)}
            </T>
          </Row>
        </Card>
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <T type="small" color={Colors.textSecondary}>
            {t('total')}
          </T>
          <T type="heading">{formatPrice(summary.total)}</T>
        </View>
        <Button title={t('checkout')} icon="checkmark" onPress={checkout} style={{ paddingHorizontal: Spacing.four }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  img: { width: 96, height: '100%', minHeight: 110, backgroundColor: Colors.surfaceAlt },
  qty: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  qtyBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  promo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 48, borderWidth: 1, borderColor: Colors.border },
  promoInput: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.four,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
