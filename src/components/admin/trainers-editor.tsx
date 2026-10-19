import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, fromLines, PhotoPicker, toLines, Toggle } from '@/components/admin/fields';
import { Button, Row, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { trainerCatalog, type TrainerCfg } from '@/data/content';
import { clearTrainerPin, fetchTrainerPins, setTrainerPin } from '@/lib/api';
import { formatPrice } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

type Form = {
  id: string;
  isNew: boolean;
  name: string;
  specialties: string;
  quals: string;
  services: string;
  why: string;
  experience: string;
  ages: string;
  schedule: string;
  price: string;
  photoUrl?: string;
  visible: boolean;
};

/** Administrators: trainers, their photo, qualifications, services, price and working hours. */
export function TrainersEditor({ accent }: { accent: string }) {
  const { content, saveContent } = useApp();
  const { t } = useI18n();
  const { staffCode } = useApp();
  const [form, setForm] = useState<Form | null>(null);
  const [pinsSet, setPinsSet] = useState<string[]>([]);
  const [pin, setPin] = useState('');
  const [pinMsg, setPinMsg] = useState<'ok' | 'fail' | null>(null);
  const list = trainerCatalog(content);

  useEffect(() => {
    let live = true;
    if (staffCode) fetchTrainerPins(staffCode).then((p) => live && p && setPinsSet(p));
    return () => {
      live = false;
    };
  }, [staffCode]);

  const removePin = async () => {
    if (!form || !staffCode) return;
    const ok = await clearTrainerPin(staffCode, form.id);
    setPinMsg(ok ? 'ok' : 'fail');
    if (ok) setPinsSet((p) => p.filter((x) => x !== form.id));
  };

  const savePin = async () => {
    if (!form || !staffCode || !/^\d{6,8}$/.test(pin)) return;
    const ok = await setTrainerPin(staffCode, form.id, pin);
    setPinMsg(ok ? 'ok' : 'fail');
    if (ok) {
      setPin('');
      setPinsSet((p) => (p.includes(form.id) ? p : [...p, form.id]));
    }
  };
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const open = (tr: TrainerCfg & { hidden: boolean }) =>
    setForm({
      id: tr.id,
      isNew: false,
      name: tr.name,
      specialties: tr.specialties.join(', '),
      quals: tr.bio,
      services: fromLines(tr.services),
      why: fromLines(tr.why),
      experience: tr.experience ?? '',
      ages: tr.ages ?? '',
      schedule: tr.schedule ?? '',
      price: tr.pricePerSession ? String(tr.pricePerSession) : '',
      photoUrl: tr.photoUrl,
      visible: !tr.hidden,
    });

  const save = () => {
    if (!form || form.name.trim().length < 2) return;
    const fields = {
      name: form.name.trim(),
      specialties: form.specialties.split(',').map((s) => s.trim()).filter(Boolean),
      bio: toLines(form.quals).join('\n'),
      services: toLines(form.services),
      why: toLines(form.why),
      experience: form.experience.trim(),
      ages: form.ages.trim(),
      schedule: form.schedule.trim(),
      pricePerSession: Number(form.price.replace(/\D/g, '')) || 0,
      photoUrl: form.photoUrl ?? '',
    };
    const cur = content.trainers ?? { overrides: {}, custom: [], hidden: [] };
    const isCustom = form.isNew || cur.custom.some((x) => x.id === form.id);
    const next = form.isNew
      ? { ...cur, custom: [...cur.custom, { id: form.id, clubId: '', rating: 0, reviews: 0, experienceYears: 0, audience: '', ...fields } as TrainerCfg] }
      : isCustom
        ? { ...cur, custom: cur.custom.map((x) => (x.id === form.id ? ({ ...x, ...fields } as TrainerCfg) : x)) }
        : { ...cur, overrides: { ...cur.overrides, [form.id]: { ...cur.overrides[form.id], ...fields } } };
    const hidden = form.visible ? next.hidden.filter((h) => h !== form.id) : [...new Set([...next.hidden, form.id])];
    saveContent('trainers', { ...next, hidden });
    setForm(null);
  };

  // Server ids must look like t<number> (the trainer-load log relies on it).
  const nextId = () => `t${Math.max(0, ...list.map((x) => Number(x.id.slice(1)) || 0)) + 1}`;

  return (
    <View style={{ gap: Spacing.two }}>
      {list.map((tr) => (
        <Row key={tr.id} gap={Spacing.two} style={styles.row}>
          <View style={{ flex: 1 }}>
            <T type="small" style={{ fontWeight: '700' }} numberOfLines={2}>
              {tr.name}
              {tr.hidden ? ` • ${t('adm_hidden')}` : ''}
            </T>
            <T type="small" color={Colors.textMuted}>
              {tr.pricePerSession ? `${formatPrice(tr.pricePerSession)} ${t('pos_per_month')}` : '—'}
            </T>
          </View>
          <T type="small" color={accent} style={{ fontWeight: '700' }} onPress={() => open(tr)}>
            {t('edit')}
          </T>
        </Row>
      ))}

      {form ? (
        <View style={{ gap: Spacing.two }}>
          <PhotoPicker url={form.photoUrl} onChange={(u) => set({ photoUrl: u })} accent={accent} />
          <Field label={t('adm_tr_name')} value={form.name} onChange={(v) => set({ name: v })} />
          <Field label={t('adm_tr_specs')} value={form.specialties} onChange={(v) => set({ specialties: v })} />
          <Field label={t('trainer_quals')} value={form.quals} onChange={(v) => set({ quals: v })} multiline />
          <Field label={t('trainer_services')} value={form.services} onChange={(v) => set({ services: v })} multiline />
          <Field label={t('trainer_why')} value={form.why} onChange={(v) => set({ why: v })} multiline />
          <Field label={t('trainer_experience')} value={form.experience} onChange={(v) => set({ experience: v })} />
          <Field label={t('trainer_ages')} value={form.ages} onChange={(v) => set({ ages: v })} />
          <Field label={t('trainer_schedule')} value={form.schedule} onChange={(v) => set({ schedule: v })} placeholder="Вт Чт Сб 18:00-22:00" />
          <Field label={t('trainer_price')} value={form.price} onChange={(v) => set({ price: v.replace(/\D/g, '') })} keyboard="number-pad" />
          <Toggle label={t('adm_shown')} value={form.visible} onChange={(v) => set({ visible: v })} accent={accent} />
          {!form.isNew ? (
            <View style={{ gap: Spacing.two }}>
              <Field label={`${t('tm_pin_label')} (${pinsSet.includes(form.id) ? t('tm_pin_set') : t('tm_pin_unset')})`} value={pin} onChange={(v) => { setPin(v.replace(/\D/g, '').slice(0, 8)); setPinMsg(null); }} keyboard="number-pad" placeholder="••••" />
              <Button title={t('tm_pin_save')} icon="key-outline" variant="secondary" size="sm" onPress={() => void savePin()} disabled={!/^\d{6,8}$/.test(pin)} />
              {pinsSet.includes(form.id) ? <Button title={t('tm_pin_clear')} variant="ghost" size="sm" onPress={() => void removePin()} /> : null}
              {pinMsg ? (
                <T type="small" color={pinMsg === 'ok' ? Colors.success : Colors.danger} style={{ fontWeight: '700' }}>
                  {pinMsg === 'ok' ? t('tm_pin_saved') : t('tm_pin_failed')}
                </T>
              ) : null}
            </View>
          ) : (
            <T type="small" color={Colors.textMuted}>
              {t('tm_pin_after_save')}
            </T>
          )}
          <Row gap={Spacing.two}>
            <Button title={t('cancel')} variant="secondary" onPress={() => setForm(null)} style={{ flex: 1 }} />
            <Button title={t('save')} icon="checkmark" onPress={save} disabled={form.name.trim().length < 2} style={{ flex: 1, backgroundColor: accent }} />
          </Row>
        </View>
      ) : (
        <Button
          title={t('adm_tr_new')}
          icon="add-circle-outline"
          variant="secondary"
          onPress={() => setForm({ id: nextId(), isNew: true, name: '', specialties: '', quals: '', services: '', why: '', experience: '', ages: '', schedule: '', price: '', visible: true })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
