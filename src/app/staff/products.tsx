import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Badge, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/data/mock';
import { shopCategories, type ShopCategory } from '@/data/shop';
import { useApp, useCatalog, useI18n } from '@/store/app-context';

export default function StaffProductsScreen() {
  const { t, td } = useI18n();
  const { all, hidden, isCustom } = useCatalog();
  const { upsertProduct, restoreProduct, productOverrides } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'Все' | ShopCategory | 'hidden'>('Все');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => (category === 'hidden' ? hidden.includes(p.id) : category === 'Все' ? !hidden.includes(p.id) : p.category === category && !hidden.includes(p.id)))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) : true));
  }, [all, hidden, category, query]);

  return (
    <View style={styles.root}>
      <StaffHeader
        title={t('staff_tab_products')}
        right={
          <Pressable onPress={() => router.push('/staff/product-edit')} style={styles.addBtn} accessibilityLabel={t('add_product')}>
            <Ionicons name="add" size={18} color={Colors.onAccent} />
            <T type="small" color={Colors.onAccent} style={{ fontWeight: '800' }}>
              {t('add_product')}
            </T>
          </Pressable>
        }
      />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('shop_search_ph')} placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
      </View>
      <ChipRow>
        {shopCategories.map((c) => (
          <Chip key={c.key} label={c.key === 'Все' ? t('all') : td(c.key)} active={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
        <Chip label={`${t('filter_hidden')} ${hidden.length ? `(${hidden.length})` : ''}`} icon="eye-off-outline" active={category === 'hidden'} onPress={() => setCategory('hidden')} />
      </ChipRow>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <T type="small" color={Colors.textMuted}>
          {t('products_n', { n: list.length })} • {t('products_manage_sub')}
        </T>
        {list.map((p) => {
          const isHidden = hidden.includes(p.id);
          const custom = isCustom(p.id);
          const edited = !custom && !!productOverrides[p.id];
          return (
            <Pressable key={p.id} onPress={() => router.push({ pathname: '/staff/product-edit', params: { id: p.id } })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.surfaceAlt }, isHidden && { opacity: 0.6 }]}>
              <Image source={{ uri: p.image }} style={styles.thumb} contentFit="cover" transition={150} />
              <View style={{ flex: 1, gap: 2 }}>
                <Row gap={6}>
                  <T type="body" style={{ fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                    {p.name}
                  </T>
                  {custom ? <Badge label={t('custom_badge')} color={StaffAccent} /> : edited ? <Badge label={t('edited_badge')} color={Colors.info} /> : null}
                  {isHidden ? <Badge label={t('hidden_badge')} color={Colors.textSecondary} /> : null}
                </Row>
                <T type="small" color={Colors.textSecondary} numberOfLines={1}>
                  {p.brand} • {td(p.category)}
                  {p.unit ? ` • ${p.unit}` : ''}
                </T>
                <Row gap={8}>
                  <T type="label" color={StaffAccent} style={{ fontSize: 14 }}>
                    {formatPrice(p.price)}
                  </T>
                  {p.oldPrice ? (
                    <T type="small" color={Colors.textMuted} style={{ textDecorationLine: 'line-through' }}>
                      {formatPrice(p.oldPrice)}
                    </T>
                  ) : null}
                </Row>
              </View>
              {isHidden ? (
                <Pressable onPress={() => restoreProduct(p.id)} hitSlop={8} style={styles.restore}>
                  <Ionicons name="refresh" size={14} color={StaffAccent} />
                  <T type="small" color={StaffAccent} style={{ fontWeight: '700' }}>
                    {t('restore')}
                  </T>
                </Pressable>
              ) : (
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Switch value={p.inStock} onValueChange={(v) => upsertProduct({ ...p, inStock: v })} trackColor={{ true: StaffAccent, false: Colors.border }} thumbColor="#FFFFFF" />
                  <T type="small" color={Colors.textMuted} style={{ fontSize: 10 }}>
                    {p.inStock ? t('in_stock') : t('out_of_stock')}
                  </T>
                </View>
              )}
            </Pressable>
          );
        })}
        {list.length === 0 ? <T type="caption">{t('nothing_found')}</T> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, height: 44, borderRadius: Radius.pill, backgroundColor: StaffAccent },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, margin: Spacing.three, marginBottom: Spacing.two, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 48 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 16 },
  body: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: Colors.surfaceAlt },
  restore: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(255,133,98,0.5)' },
});
