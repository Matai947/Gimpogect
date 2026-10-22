import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, Toggle } from '@/components/admin/fields';
import { Button, Row, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { planCatalog } from '@/data/content';
import { formatPrice, planLength, type Plan } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

const monthsFromDays = (d: number) => (d >= 360 ? 12 : d >= 170 ? 6 : d >= 80 ? 3 : d >= 28 ? 1 : 0);

function featuresOf(days: number, visits: number, dayOnly: boolean, freeze: number, times = 1): string[] {
  const f = [visits ? `${visits} посещений` : 'Безлимит', `Срок: ${days} ${days === 1 ? 'день' : 'дн.'}`];
  if (dayOnly) f.push('Вход с 07:00 до 17:00');
  if (freeze) f.push(times > 1 ? `Заморозка: ${times} раза по ${freeze} дн.` : `Заморозка: ${freeze} дн.`);
  return f;
}

type Form = { id: string; isNew: boolean; name: string; price: string; oldPrice: string; days: string; visits: string; freeze: string; times: string; dayOnly: boolean; visible: boolean };

/** Administrators: change plans and prices, add a plan, hide one from sale. Members who already hold a hidden plan keep it. */
export function PlansEditor({ accent }: { accent: string }) {
  const { content, saveContent } = useApp();
  const { t } = useI18n();
  const [form, setForm] = useState<Form | null>(null);
  const list = planCatalog(content).filter((p) => !p.trial && !p.staffOnly && !p.partner);
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const open = (p: Plan & { hidden: boolean }) =>
    setForm({ id: p.id, isNew: false, name: p.name, price: String(p.price), oldPrice: p.oldPrice ? String(p.oldPrice) : '', days: String(p.days ?? 31), visits: p.visits ? String(p.visits) : '', freeze: p.freezeDays ? String(p.freezeDays) : '', times: String(p.freezeCount ?? 1), dayOnly: !!p.dayOnly, visible: !p.hidden });

  const save = () => {
    if (!form || form.name.trim().length < 2) return;
    const days = Math.max(1, Number(form.days) || 1);
    const price = Number(form.price.replace(/\D/g, '')) || 0;
    const visits = Number(form.visits) || 0;
    const freeze = Number(form.freeze) || 0;
    const times = Math.max(1, Math.min(10, Number(form.times) || 1));
    const fields: Partial<Plan> = {
      name: form.name.trim(),
      price,
      oldPrice: Number(form.oldPrice.replace(/\D/g, '')) || undefined,
      days,
      months: monthsFromDays(days),
      visits: visits || undefined,
      freezeDays: freeze || undefined,
      freezeCount: freeze ? times : undefined,
      dayOnly: form.dayOnly || undefined,
      features: featuresOf(days, visits, form.dayOnly, freeze, times),
    };
    const cur = content.plans ?? { overrides: {}, custom: [], hidden: [] };
    const isCustom = form.isNew || cur.custom.some((p) => p.id === form.id);
    const next = form.isNew
      ? { ...cur, custom: [...cur.custom, { id: form.id, perMonth: price, ...fields } as Plan] }
      : isCustom
        ? { ...cur, custom: cur.custom.map((p) => (p.id === form.id ? ({ ...p, ...fields } as Plan) : p)) }
        : { ...cur, overrides: { ...cur.overrides, [form.id]: { ...cur.overrides[form.id], ...fields } } };
    const hidden = form.visible ? next.hidden.filter((h) => h !== form.id) : [...new Set([...next.hidden, form.id])];
    saveContent('plans', { ...next, hidden });
    setForm(null);
  };

  return (
    <View style={{ gap: Spacing.two }}>
      {list.map((p) => (
        <Row key={p.id} gap={Spacing.two} style={styles.row}>
          <View style={{ flex: 1 }}>
            <T type="small" style={{ fontWeight: '700' }} numberOfLines={2}>
              {p.name}
              {p.hidden ? ` • ${t('adm_hidden')}` : ''}
            </T>
            <T type="small" color={Colors.textMuted}>
              {planLength(p)}
              {p.visits ? ` • ${p.visits} ${t('adm_visits_short')}` : ''}
            </T>
          </View>
          <T type="small" style={{ fontWeight: '700' }}>
            {formatPrice(p.price)}
          </T>
          <T type="small" color={accent} style={{ fontWeight: '700' }} onPress={() => open(p)}>
            {t('edit')}
          </T>
        </Row>
      ))}

      {form ? (
        <View style={{ gap: Spacing.two }}>
          <Field label={t('adm_plan_name')} value={form.name} onChange={(v) => set({ name: v })} />
          <Row gap={Spacing.two}>
            <View style={{ flex: 1 }}>
              <Field label={t('plan_price')} value={form.price} onChange={(v) => set({ price: v })} keyboard="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('plan_old_price')} value={form.oldPrice} onChange={(v) => set({ oldPrice: v })} keyboard="number-pad" />
            </View>
          </Row>
          <Row gap={Spacing.two}>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_plan_days')} value={form.days} onChange={(v) => set({ days: v.replace(/\D/g, '') })} keyboard="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_plan_visits')} value={form.visits} onChange={(v) => set({ visits: v.replace(/\D/g, '') })} keyboard="number-pad" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_plan_freeze')} value={form.freeze} onChange={(v) => set({ freeze: v.replace(/\D/g, '') })} keyboard="number-pad" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_plan_freeze_times')} value={form.times} onChange={(v) => set({ times: v.replace(/\D/g, '').slice(0, 2) })} keyboard="number-pad" placeholder="1" />
            </View>
          </Row>
          <Toggle label={t('adm_plan_day_only')} value={form.dayOnly} onChange={(v) => set({ dayOnly: v })} accent={accent} />
          <Toggle label={t('adm_on_sale')} value={form.visible} onChange={(v) => set({ visible: v })} accent={accent} />
          <Row gap={Spacing.two}>
            <Button title={t('cancel')} variant="secondary" onPress={() => setForm(null)} style={{ flex: 1 }} />
            <Button title={t('save')} icon="checkmark" onPress={save} disabled={form.name.trim().length < 2} style={{ flex: 1, backgroundColor: accent }} />
          </Row>
        </View>
      ) : (
        <Button
          title={t('adm_plan_new')}
          icon="add-circle-outline"
          variant="secondary"
          onPress={() => setForm({ id: `n${Date.now().toString(36)}`, isNew: true, name: '', price: '', oldPrice: '', days: '31', visits: '', freeze: '5', times: '1', dayOnly: false, visible: true })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
