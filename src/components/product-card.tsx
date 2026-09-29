import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Row, Stars, T } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { formatPrice } from '@/data/mock';
import type { Product } from '@/data/shop';

export function ProductCard({ product: p, width, onAdd }: { product: Product; width?: number; onAdd?: () => void }) {
  const badgeColor = p.badge === 'Хит' ? Colors.warning : p.badge === 'Новинка' ? Colors.info : Colors.danger;
  return (
    <Pressable onPress={() => router.push(`/product/${p.id}`)} style={({ pressed }) => [styles.card, width ? { width } : styles.gridCard, pressed && { opacity: 0.9 }]}>
      <View style={styles.imgWrap}>
        <Image source={{ uri: p.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        {p.badge ? (
          <View style={{ position: 'absolute', top: 8, left: 8 }}>
            <Badge label={p.badge} color={badgeColor} />
          </View>
        ) : null}
        {!p.inStock ? (
          <View style={styles.soldOut}>
            <T type="small" style={{ fontWeight: '700' }}>
              Нет в наличии
            </T>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 3, flex: 1 }}>
        <T type="small" color={Colors.textMuted} numberOfLines={1}>
          {p.brand}
        </T>
        <T type="small" style={{ fontWeight: '700', fontSize: 13.5 }} numberOfLines={2}>
          {p.name}
        </T>
        {p.unit ? (
          <T type="small" color={Colors.textSecondary} numberOfLines={1} style={{ fontSize: 11.5 }}>
            {p.unit}
          </T>
        ) : null}
        <Stars rating={p.rating} size={11} />
        <Row style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
          <View>
            <T type="label" color={Colors.accent} style={{ fontSize: 14 }}>
              {formatPrice(p.price)}
            </T>
            {p.oldPrice ? (
              <T type="small" color={Colors.textMuted} style={{ textDecorationLine: 'line-through', fontSize: 11 }}>
                {formatPrice(p.oldPrice)}
              </T>
            ) : null}
          </View>
          <Pressable onPress={onAdd} disabled={!p.inStock} hitSlop={6} style={[styles.addBtn, !p.inStock && { opacity: 0.4 }]}>
            <Ionicons name={p.options ? 'chevron-forward' : 'add'} size={18} color={Colors.onAccent} />
          </Pressable>
        </Row>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  gridCard: { width: '48.5%' },
  imgWrap: { height: 140, backgroundColor: Colors.surfaceAlt },
  soldOut: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 4, alignItems: 'center' },
  addBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
});
