import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ProductCard } from '@/components/product-card';
import { Badge, IconButton, Row, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { goalTitle } from '@/data/fitness';
import { productById, products, shopCategories, type Product, type ShopCategory } from '@/data/shop';
import { useApp, useCartSummary, useFitnessProfile, useI18n, useMembershipInfo } from '@/store/app-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Sort = 'popular' | 'cheap' | 'expensive' | 'rating';

export default function ShopScreen() {
  const { addToCart } = useApp();
  const { t, td } = useI18n();
  const cart = useCartSummary();
  const membership = useMembershipInfo();
  const fitness = useFitnessProfile();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'Все' | ShopCategory>('Все');
  const [sort, setSort] = useState<Sort>('popular');

  const sortLabels: Record<Sort, string> = { popular: t('sort_popular'), cheap: t('sort_cheap'), expensive: t('sort_expensive'), rating: t('sort_rating') };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products
      .filter((p) => (category === 'Все' ? true : p.category === category))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) : true));
    switch (sort) {
      case 'cheap':
        return filtered.sort((a, b) => a.price - b.price);
      case 'expensive':
        return filtered.sort((a, b) => b.price - a.price);
      case 'rating':
        return filtered.sort((a, b) => b.rating - a.rating);
      default:
        return filtered.sort((a, b) => b.reviews - a.reviews);
    }
  }, [query, category, sort]);

  const hits = useMemo(() => products.filter((p) => p.badge === 'Хит' || p.badge === 'Новинка').slice(0, 6), []);
  const goalProducts = useMemo(() => (fitness ? fitness.goalInfo.productIds.map(productById).filter((p): p is Product => !!p) : []), [fitness]);
  const showHero = !query && category === 'Все';

  const quickAdd = (p: Product) => {
    if (p.options) {
      router.push(`/product/${p.id}`);
      return;
    }
    addToCart(p.id);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T type="title">{t('tab_shop')}</T>
          <T type="caption">{t('shop_sub')}</T>
        </View>
        <View>
          <IconButton icon="cart-outline" onPress={() => router.push('/cart')} />
          {cart.count > 0 ? (
            <View style={styles.cartBadge}>
              <T type="small" color={Colors.onAccent} style={{ fontWeight: '800', fontSize: 11 }}>
                {cart.count}
              </T>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('shop_search_ph')} placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }} style={{ marginBottom: Spacing.three }}>
        {shopCategories.map((c) => {
          const active = category === c.key;
          return (
            <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.cat, active && styles.catActive]}>
              <Ionicons name={c.icon as IconName} size={20} color={active ? Colors.onAccent : Colors.accent} />
              <T type="small" color={active ? Colors.onAccent : Colors.text} style={{ fontWeight: '600' }} numberOfLines={1}>
                {c.key === 'Все' ? t('all') : td(c.key)}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      {showHero ? (
        <>
          {/* Promo banner */}
          <View style={{ paddingHorizontal: Spacing.three, marginBottom: Spacing.four }}>
            <LinearGradient colors={['#2B3A14', '#151B23']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
              <View style={{ flex: 1, gap: 4 }}>
                <Badge label={membership.active ? t('your_discount') : t('for_members')} />
                <T type="heading">{t('discount_all')}</T>
                <T type="small" color={Colors.textSecondary}>
                  {t('discount_hint')}
                </T>
              </View>
              <Ionicons name="pricetags" size={44} color={Colors.accent} style={{ opacity: 0.9 }} />
            </LinearGradient>
          </View>

          {/* For your goal */}
          {goalProducts.length > 0 && fitness ? (
            <View style={{ marginBottom: Spacing.four }}>
              <View style={{ paddingHorizontal: Spacing.three }}>
                <SectionHeader title={t('for_goal', { g: goalTitle(fitness.goal) })} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}>
                {goalProducts.map((p) => (
                  <ProductCard key={p.id} product={p} width={160} onAdd={() => quickAdd(p)} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Hits */}
          <View style={{ marginBottom: Spacing.four }}>
            <View style={{ paddingHorizontal: Spacing.three }}>
              <SectionHeader title={t('hits')} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two }}>
              {hits.map((p) => (
                <ProductCard key={p.id} product={p} width={160} onAdd={() => quickAdd(p)} />
              ))}
            </ScrollView>
          </View>
        </>
      ) : null}

      {/* Sort + grid */}
      <View style={{ paddingHorizontal: Spacing.three }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: Spacing.two }}>
          <T type="heading">{category === 'Все' ? t('all_products') : td(category)}</T>
          <Pressable
            onPress={() => {
              const order: Sort[] = ['popular', 'cheap', 'expensive', 'rating'];
              setSort(order[(order.indexOf(sort) + 1) % order.length]);
            }}
            hitSlop={8}>
            <Row gap={4}>
              <Ionicons name="swap-vertical" size={14} color={Colors.accent} />
              <T type="small" color={Colors.accent} style={{ fontWeight: '700' }}>
                {sortLabels[sort]}
              </T>
            </Row>
          </Pressable>
        </Row>
        <T type="small" color={Colors.textMuted} style={{ marginBottom: Spacing.two }}>
          {t('products_n', { n: list.length })}
        </T>
        <View style={styles.grid}>
          {list.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={() => quickAdd(p)} />
          ))}
        </View>
        {list.length === 0 ? (
          <T type="caption" style={{ textAlign: 'center', paddingVertical: Spacing.five }}>
            {t('nothing_found')}
          </T>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  cartBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 40, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  catActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.lg, padding: Spacing.three, borderWidth: 1, borderColor: Colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
