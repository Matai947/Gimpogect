import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/product-card';
import { Badge, Button, Card, EmptyState, IconButton, Row, Screen, SectionHeader, Stars, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/data/mock';
import { MEMBER_DISCOUNT } from '@/data/shop';
import { useApp, useCartSummary, useCatalog, useI18n, useMembershipInfo } from '@/store/app-context';

const W = Dimensions.get('window').width;

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, byId } = useCatalog();
  const product = byId(id);
  const { addToCart } = useApp();
  const { t, tp, td } = useI18n();
  const cart = useCartSummary();
  const membership = useMembershipInfo();
  const [option, setOption] = useState<string | undefined>(product?.options?.values[0]);
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('product_not_found')} />
      </Screen>
    );
  }

  const similar = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const badgeColor = product.badge === 'Хит' ? Colors.warning : product.badge === 'Новинка' ? Colors.info : Colors.danger;
  const memberPrice = Math.round(product.price * (1 - MEMBER_DISCOUNT));

  const add = () => {
    addToCart(product.id, option, qty);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(t('added_title'), `${product.name}${option ? ` (${option})` : ''} × ${qty}`, [
      { text: t('continue_shopping'), style: 'cancel', onPress: () => router.back() },
      { text: t('to_cart'), onPress: () => router.push('/cart') },
    ]);
  };

  return (
    <Screen edges={[]} contentStyle={{ paddingBottom: 130 }}>
      <Stack.Screen
        options={{
          title: product.brand,
          headerRight: () => (
            <View>
              <IconButton icon="cart-outline" bg="transparent" onPress={() => router.push('/cart')} />
              {cart.count > 0 ? (
                <View style={styles.cartBadge}>
                  <T type="small" color={Colors.onAccent} style={{ fontWeight: '800', fontSize: 10 }}>
                    {cart.count}
                  </T>
                </View>
              ) : null}
            </View>
          ),
        }}
      />

      <View style={{ height: 320, backgroundColor: Colors.surfaceAlt }}>
        <Image source={{ uri: product.image }} style={{ width: W, height: 320 }} contentFit="cover" transition={200} />
        {product.badge ? (
          <View style={{ position: 'absolute', top: 12, left: Spacing.three }}>
            <Badge label={td(product.badge)} color={badgeColor} />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <T type="caption">{product.brand}</T>
        <T type="title" style={{ marginTop: 2 }}>
          {product.name}
        </T>
        {product.unit ? (
          <T type="body" color={Colors.textSecondary}>
            {product.unit}
          </T>
        ) : null}
        <Row gap={Spacing.two} style={{ marginTop: Spacing.two }}>
          <Stars rating={product.rating} size={15} />
          <T type="small" color={Colors.textMuted}>
            {product.reviews} {tp(product.reviews, 'reviews_pl')}
          </T>
          <View style={{ flex: 1 }} />
          {product.inStock ? <Badge label={t('in_stock')} color={Colors.success} /> : <Badge label={t('out_of_stock')} color={Colors.danger} />}
        </Row>

        <Card style={{ marginTop: Spacing.three, gap: 6 }}>
          <Row gap={8} style={{ alignItems: 'flex-end' }}>
            <T type="display" style={{ fontSize: 30, lineHeight: 34 }}>
              {formatPrice(product.price)}
            </T>
            {product.oldPrice ? (
              <T type="body" color={Colors.textMuted} style={{ textDecorationLine: 'line-through', marginBottom: 4 }}>
                {formatPrice(product.oldPrice)}
              </T>
            ) : null}
          </Row>
          <Row gap={6}>
            <Ionicons name="pricetag" size={13} color={Colors.accent} />
            <T type="small" color={Colors.accent} style={{ fontWeight: '700' }}>
              {membership.active ? t('member_price_yours', { p: formatPrice(memberPrice) }) : t('member_price', { p: formatPrice(memberPrice) })}
            </T>
          </Row>
        </Card>

        {product.options ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={td(product.options.label)} />
            <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
              {product.options.values.map((v) => (
                <Pressable key={v} onPress={() => setOption(v)} style={[styles.opt, option === v && styles.optActive]}>
                  <T type="label" color={option === v ? Colors.onAccent : Colors.text} style={{ fontSize: 14 }}>
                    {v}
                  </T>
                </Pressable>
              ))}
            </Row>
          </View>
        ) : null}

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('description')} />
          <T type="body" color={Colors.textSecondary} style={{ lineHeight: 23 }}>
            {product.description}
          </T>
        </View>

        {product.nutrition ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={t('nutrition_serving', { s: product.nutrition.serving })} />
            <Card padded={false} style={{ flexDirection: 'row' }}>
              {[
                [t('protein'), `${product.nutrition.protein} ${t('g')}`],
                [t('carbs'), `${product.nutrition.carbs} ${t('g')}`],
                [t('fat'), `${product.nutrition.fat} ${t('g')}`],
                [t('kcal'), `${product.nutrition.calories}`],
              ].map(([k, v], i) => (
                <View key={k} style={[styles.nut, i > 0 && { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                  <T type="heading">{v}</T>
                  <T type="small" color={Colors.textSecondary}>
                    {k}
                  </T>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('pickup')} />
          <Card style={{ gap: Spacing.two }}>
            {[
              ['storefront-outline', t('pickup_1')],
              ['time-outline', t('pickup_2')],
              ['shield-checkmark-outline', t('pickup_3')],
            ].map(([icon, text]) => (
              <Row key={text} gap={10}>
                <Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={Colors.accent} />
                <T type="body" style={{ flex: 1 }}>
                  {text}
                </T>
              </Row>
            ))}
          </Card>
        </View>

        {similar.length > 0 ? (
          <View style={{ marginTop: Spacing.four }}>
            <SectionHeader title={t('similar')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
              {similar.map((p) => (
                <ProductCard key={p.id} product={p} width={160} onAdd={() => (p.options ? router.push(`/product/${p.id}`) : addToCart(p.id))} />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.qty}>
          <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} hitSlop={8} style={styles.qtyBtn}>
            <Ionicons name="remove" size={18} color={Colors.text} />
          </Pressable>
          <T type="label">{qty}</T>
          <Pressable onPress={() => setQty((q) => Math.min(20, q + 1))} hitSlop={8} style={styles.qtyBtn}>
            <Ionicons name="add" size={18} color={Colors.text} />
          </Pressable>
        </View>
        <Button title={product.inStock ? t('add_cart', { p: formatPrice(product.price * qty) }) : t('out_of_stock')} icon="cart-outline" onPress={add} disabled={!product.inStock} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.three },
  cartBadge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  opt: { paddingHorizontal: 16, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  optActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  nut: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, gap: 2 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingHorizontal: 6, height: 48, borderWidth: 1, borderColor: Colors.border },
  qtyBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: Spacing.four,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
