import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StaffAccent } from '@/components/member-result';
import { Button, Chip, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { shopCategories, type Product, type ShopCategory } from '@/data/shop';
import { useApp, useCatalog, useI18n } from '@/store/app-context';

const badges: (NonNullable<Product['badge']> | 'none')[] = ['none', 'Хит', 'Новинка', 'Скидка'];
const optionLabels: NonNullable<Product['options']>['label'][] = ['Вкус', 'Размер', 'Цвет'];

export default function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, td } = useI18n();
  const { byId, isCustom } = useCatalog();
  const { upsertProduct, deleteProduct } = useApp();
  const existing = id ? byId(id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? 'Gym Project');
  const [category, setCategory] = useState<ShopCategory | null>(existing?.category ?? null);
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [oldPrice, setOldPrice] = useState(existing?.oldPrice ? String(existing.oldPrice) : '');
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [image, setImage] = useState(existing?.image ?? '');
  const [imageUrlOpen, setImageUrlOpen] = useState(false);
  const [optionLabel, setOptionLabel] = useState<NonNullable<Product['options']>['label']>(existing?.options?.label ?? 'Вкус');
  const [optionValues, setOptionValues] = useState(existing?.options?.values.join(', ') ?? '');
  const [badge, setBadge] = useState<(typeof badges)[number]>(existing?.badge ?? 'none');
  const [inStock, setInStock] = useState(existing?.inStock ?? true);
  const [nutritionOpen, setNutritionOpen] = useState(!!existing?.nutrition);
  const [serving, setServing] = useState(existing?.nutrition?.serving ?? '');
  const [protein, setProtein] = useState(existing?.nutrition ? String(existing.nutrition.protein) : '');
  const [carbs, setCarbs] = useState(existing?.nutrition ? String(existing.nutrition.carbs) : '');
  const [fat, setFat] = useState(existing?.nutrition ? String(existing.nutrition.fat) : '');
  const [calories, setCalories] = useState(existing?.nutrition ? String(existing.nutrition.calories) : '');

  const priceN = parseInt(price.replace(/\D/g, ''), 10);
  const valid = name.trim().length >= 2 && !!category && priceN > 0;

  const pickImage = async (camera: boolean) => {
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const res = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!res.canceled && res.assets[0]) setImage(res.assets[0].uri);
    } catch (e) {
      Alert.alert(t('failed'), e instanceof Error ? e.message : String(e));
    }
  };

  const save = () => {
    if (!valid || !category) {
      Alert.alert(t('fill_required'));
      return;
    }
    const values = optionValues
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const product: Product = {
      id: existing?.id ?? `c_${Date.now().toString(36)}`,
      name: name.trim(),
      brand: brand.trim() || 'Gym Project',
      category,
      price: priceN,
      oldPrice: oldPrice ? parseInt(oldPrice.replace(/\D/g, ''), 10) || undefined : undefined,
      unit: unit.trim() || undefined,
      image: image || 'https://images.unsplash.com/photo-1593188543121-6441d07ad2e5?w=800&q=80&fit=crop',
      rating: existing?.rating ?? 0,
      reviews: existing?.reviews ?? 0,
      description: description.trim(),
      options: values.length ? { label: optionLabel, values } : undefined,
      badge: badge === 'none' ? undefined : badge,
      nutrition: nutritionOpen && (protein || carbs || fat || calories) ? { serving: serving.trim() || '—', protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0, calories: Number(calories) || 0 } : undefined,
      inStock,
    };
    upsertProduct(product);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(t('product_saved'), product.name, [{ text: t('ok'), onPress: () => router.back() }]);
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('delete_product_q', { name: existing.name }), isCustom(existing.id) ? undefined : t('delete_product_sub'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete_product'),
        style: 'destructive',
        onPress: () => {
          deleteProduct(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <T type="heading" style={{ flex: 1, textAlign: 'center' }}>
          {existing ? t('edit_product') : t('new_product')}
        </T>
        {existing ? (
          <Pressable onPress={remove} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Photo */}
          <Label text={t('p_image')} />
          <Row gap={Spacing.three} style={{ alignItems: 'flex-start' }}>
            <View style={styles.photo}>
              {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="image-outline" size={34} color={Colors.textMuted} />}
            </View>
            <View style={{ flex: 1, gap: Spacing.two }}>
              <Row gap={Spacing.two}>
                <Button title={t('pick_photo')} size="sm" variant="secondary" icon="images-outline" onPress={() => void pickImage(false)} style={{ flex: 1 }} />
                {Platform.OS !== 'web' ? <Button title={t('take_photo')} size="sm" variant="secondary" icon="camera-outline" onPress={() => void pickImage(true)} style={{ flex: 1 }} /> : null}
              </Row>
              <Pressable onPress={() => setImageUrlOpen((v) => !v)} hitSlop={6}>
                <T type="small" color={StaffAccent} style={{ fontWeight: '700' }}>
                  {t('p_image_url')} {imageUrlOpen ? '▴' : '▾'}
                </T>
              </Pressable>
              {imageUrlOpen ? <Field value={image} onChange={setImage} placeholder="https://…" autoCapitalize="none" /> : null}
              {image ? (
                <Pressable onPress={() => setImage('')} hitSlop={6}>
                  <T type="small" color={Colors.danger}>
                    {t('remove_photo')}
                  </T>
                </Pressable>
              ) : null}
            </View>
          </Row>

          <Label text={t('p_name')} required />
          <Field value={name} onChange={setName} placeholder={t('p_name_ph')} />
          <Label text={t('p_brand')} />
          <Field value={brand} onChange={setBrand} placeholder="Gym Project" />

          <Label text={t('p_category')} required />
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            {shopCategories
              .filter((c) => c.key !== 'Все')
              .map((c) => (
                <Chip key={c.key} label={td(c.key)} active={category === c.key} onPress={() => setCategory(c.key as ShopCategory)} />
              ))}
          </Row>

          <Row gap={Spacing.two}>
            <View style={{ flex: 1 }}>
              <Label text={t('p_price')} required />
              <Field value={price} onChange={(v) => setPrice(v.replace(/\D/g, ''))} placeholder="24990" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Label text={t('p_old_price')} />
              <Field value={oldPrice} onChange={(v) => setOldPrice(v.replace(/\D/g, ''))} placeholder="28990" keyboardType="number-pad" />
            </View>
          </Row>

          <Label text={t('p_unit')} />
          <Field value={unit} onChange={setUnit} placeholder={t('p_unit_ph')} />
          <Label text={t('p_desc')} />
          <Field value={description} onChange={setDescription} placeholder="…" multiline />

          <Label text={t('p_options')} />
          <Row gap={Spacing.two} style={{ marginBottom: Spacing.two }}>
            {optionLabels.map((l) => (
              <Chip key={l} label={td(l)} active={optionLabel === l} onPress={() => setOptionLabel(l)} />
            ))}
          </Row>
          <Field value={optionValues} onChange={setOptionValues} placeholder={t('p_options_ph')} />
          <T type="small" color={Colors.textMuted}>
            {t('p_options_values')}
          </T>

          <Label text={t('p_badge')} />
          <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
            {badges.map((b) => (
              <Chip key={b} label={b === 'none' ? t('p_none') : td(b)} active={badge === b} onPress={() => setBadge(b)} />
            ))}
          </Row>

          <Row style={[styles.switchRow, { marginTop: Spacing.three }]}>
            <T type="body" style={{ fontWeight: '600', flex: 1 }}>
              {t('toggle_stock')}
            </T>
            <Switch value={inStock} onValueChange={setInStock} trackColor={{ true: StaffAccent, false: Colors.border }} thumbColor="#FFFFFF" />
          </Row>
          <Row style={styles.switchRow}>
            <T type="body" style={{ fontWeight: '600', flex: 1 }}>
              {t('p_nutrition')}
            </T>
            <Switch value={nutritionOpen} onValueChange={setNutritionOpen} trackColor={{ true: StaffAccent, false: Colors.border }} thumbColor="#FFFFFF" />
          </Row>
          {nutritionOpen ? (
            <View style={{ gap: Spacing.two }}>
              <Field value={serving} onChange={setServing} placeholder={`${t('p_serving')}: 30 г`} />
              <Row gap={Spacing.two}>
                <Field value={protein} onChange={setProtein} placeholder={t('protein')} keyboardType="decimal-pad" style={{ flex: 1 }} />
                <Field value={carbs} onChange={setCarbs} placeholder={t('carbs')} keyboardType="decimal-pad" style={{ flex: 1 }} />
                <Field value={fat} onChange={setFat} placeholder={t('fat')} keyboardType="decimal-pad" style={{ flex: 1 }} />
                <Field value={calories} onChange={setCalories} placeholder={t('kcal')} keyboardType="number-pad" style={{ flex: 1 }} />
              </Row>
            </View>
          ) : null}

          {!existing ? (
            <T type="small" color={Colors.textMuted}>
              {t('rating_default')}
            </T>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button title={t('save_product')} icon="checkmark" size="lg" onPress={save} disabled={!valid} style={{ backgroundColor: StaffAccent }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <T type="label" style={{ marginTop: Spacing.two, marginBottom: 6 }}>
      {text}
      {required ? <T color={StaffAccent}> *</T> : null}
    </T>
  );
}

function Field({ value, onChange, placeholder, keyboardType, multiline, style, autoCapitalize }: { value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: 'number-pad' | 'decimal-pad' | 'default'; multiline?: boolean; style?: object; autoCapitalize?: 'none' | 'sentences' }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      style={[styles.field, multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, style]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.three, gap: 4, paddingBottom: Spacing.six },
  photo: { width: 110, height: 110, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  field: { height: 48, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, color: Colors.text, fontSize: 15 },
  switchRow: { justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  footer: { padding: Spacing.three, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
});
