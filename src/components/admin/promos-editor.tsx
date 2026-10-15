import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, PhotoPicker, Toggle } from '@/components/admin/fields';
import { Button, Chip, Row, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { Promo } from '@/data/content';
import { addDays, clubs, formatDateLong, toISODate } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

type Form = { id: string; isNew: boolean; title: string; text: string; kind: Promo['kind']; value: string; code: string; clubId: string; start: string; end: string; active: boolean; image?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Administrators: promotions and promo codes with dates, for one club or the whole network. Switch off at any time. */
export function PromosEditor({ accent }: { accent: string }) {
  const { content, saveContent } = useApp();
  const { t } = useI18n();
  const [form, setForm] = useState<Form | null>(null);
  const list = content.promos ?? [];
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const open = (p: Promo) => setForm({ id: p.id, isNew: false, title: p.title, text: p.text, kind: p.kind, value: p.value ? String(p.value) : '', code: p.code ?? '', clubId: p.clubId, start: p.start, end: p.end, active: p.active, image: p.image });
  const ready = !!form && form.title.trim().length >= 2 && DAY.test(form.start) && DAY.test(form.end) && form.start <= form.end && (form.kind === 'info' || Number(form.value) > 0) && (form.kind !== 'percent' || Number(form.value) <= 100);

  const save = () => {
    if (!form || !ready) return;
    const item: Promo = {
      id: form.id,
      title: form.title.trim(),
      text: form.text.trim(),
      kind: form.kind,
      value: form.kind === 'info' ? 0 : Number(form.value),
      code: form.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || undefined,
      clubId: form.clubId,
      start: form.start,
      end: form.end,
      active: form.active,
      image: form.image,
    };
    saveContent('promos', form.isNew ? [...list, item] : list.map((p) => (p.id === form.id ? item : p)));
    setForm(null);
  };

  const remove = () => {
    if (!form || form.isNew) return;
    saveContent('promos', list.filter((p) => p.id !== form.id));
    setForm(null);
  };

  const today = toISODate(new Date());
  const state = (p: Promo) => (!p.active ? t('adm_promo_off') : p.end < today ? t('adm_promo_over') : p.start > today ? t('adm_promo_soon') : t('adm_promo_on'));

  return (
    <View style={{ gap: Spacing.two }}>
      {list.length === 0 && !form ? (
        <T type="small" color={Colors.textMuted}>
          {t('adm_promo_none')}
        </T>
      ) : null}
      {list.map((p) => (
        <Row key={p.id} gap={Spacing.two} style={styles.row}>
          <View style={{ flex: 1 }}>
            <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
              {p.title}
              {p.code ? ` • ${p.code}` : ''}
            </T>
            <T type="small" color={Colors.textMuted} numberOfLines={1}>
              {state(p)} • {formatDateLong(p.start)} — {formatDateLong(p.end)}
            </T>
          </View>
          <T type="small" color={accent} style={{ fontWeight: '700' }} onPress={() => open(p)}>
            {t('edit')}
          </T>
        </Row>
      ))}

      {form ? (
        <View style={{ gap: Spacing.two }}>
          <PhotoPicker url={form.image} onChange={(u) => set({ image: u })} accent={accent} />
          <Field label={t('adm_promo_title')} value={form.title} onChange={(v) => set({ title: v })} />
          <Field label={t('adm_promo_text')} value={form.text} onChange={(v) => set({ text: v })} multiline />
          <T type="small" color={Colors.textMuted}>
            {t('adm_promo_kind')}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip label={t('adm_promo_percent')} active={form.kind === 'percent'} onPress={() => set({ kind: 'percent' })} />
            <Chip label={t('adm_promo_amount')} active={form.kind === 'amount'} onPress={() => set({ kind: 'amount' })} />
            <Chip label={t('adm_promo_info')} active={form.kind === 'info'} onPress={() => set({ kind: 'info' })} />
          </Row>
          {form.kind !== 'info' ? (
            <Row gap={Spacing.two}>
              <View style={{ flex: 1 }}>
                <Field label={form.kind === 'percent' ? t('adm_promo_value_pct') : t('adm_promo_value_sum')} value={form.value} onChange={(v) => set({ value: v.replace(/\D/g, '') })} keyboard="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('adm_promo_code')} value={form.code} onChange={(v) => set({ code: v })} placeholder="SUMMER10" />
              </View>
            </Row>
          ) : null}
          <T type="small" color={Colors.textMuted}>
            {t('adm_cl_club')}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip label={t('adm_promo_all_clubs')} active={form.clubId === 'all'} onPress={() => set({ clubId: 'all' })} />
            {clubs.map((c) => (
              <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={form.clubId === c.id} onPress={() => set({ clubId: c.id })} />
            ))}
          </Row>
          <Row gap={Spacing.two}>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_promo_start')} value={form.start} onChange={(v) => set({ start: v })} placeholder="2026-11-01" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_promo_end')} value={form.end} onChange={(v) => set({ end: v })} placeholder="2026-11-30" />
            </View>
          </Row>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip label={t('adm_promo_week')} onPress={() => set({ start: today, end: toISODate(addDays(new Date(), 7)) })} />
            <Chip label={t('adm_promo_month')} onPress={() => set({ start: today, end: toISODate(addDays(new Date(), 30)) })} />
          </Row>
          <Toggle label={t('adm_promo_active')} value={form.active} onChange={(v) => set({ active: v })} accent={accent} />
          {!ready ? (
            <T type="small" color={Colors.textMuted}>
              {t('adm_promo_check')}
            </T>
          ) : null}
          <Row gap={Spacing.two}>
            <Button title={t('cancel')} variant="secondary" onPress={() => setForm(null)} style={{ flex: 1 }} />
            {!form.isNew ? <Button title={t('adm_delete')} variant="danger" onPress={remove} /> : null}
            <Button title={t('save')} icon="checkmark" onPress={save} disabled={!ready} style={{ flex: 1, backgroundColor: accent }} />
          </Row>
        </View>
      ) : (
        <Button
          title={t('adm_promo_new')}
          icon="add-circle-outline"
          variant="secondary"
          onPress={() => setForm({ id: `p${Date.now().toString(36)}`, isNew: true, title: '', text: '', kind: 'percent', value: '', code: '', clubId: 'all', start: today, end: toISODate(addDays(new Date(), 30)), active: true })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
