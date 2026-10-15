import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/admin/fields';
import { Button, Chip, Row, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { categories, clubs, trainers, weekdayShort, type Category, type ClassTemplate } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

const LEVELS: ClassTemplate['level'][] = ['Все уровни', 'Начальный', 'Средний', 'Продвинутый'];
const COLORS = ['#7C5CFF', '#FF7A45', '#FF5C5C', '#3DDC84', '#4DA3FF', '#FFB347', '#FF4FA3'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

type Form = { id: string; isNew: boolean; title: string; category: Category; clubId: string; trainerId: string; time: string; duration: string; weekdays: number[]; capacity: string; level: ClassTemplate['level']; room: string; description: string; active: boolean };

/** Administrators: the group-class schedule. Each class repeats on its weekdays; clients book from the schedule tab. */
export function ClassesEditor({ accent }: { accent: string }) {
  const { content, saveContent } = useApp();
  const { t, td } = useI18n();
  const [form, setForm] = useState<Form | null>(null);
  const list = content.classes ?? [];
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const open = (c: ClassTemplate) =>
    setForm({ id: c.id, isNew: false, title: c.title, category: c.category, clubId: c.clubId, trainerId: c.trainerId, time: c.time, duration: String(c.durationMin), weekdays: c.weekdays, capacity: String(c.capacity), level: c.level, room: c.room, description: c.description, active: true });

  const validTime = form ? /^([01]\d|2[0-3]):[0-5]\d$/.test(form.time) : false;
  const ready = !!form && form.title.trim().length >= 2 && validTime && form.weekdays.length > 0 && !!form.clubId;

  const save = () => {
    if (!form || !ready) return;
    const item: ClassTemplate = {
      id: form.id,
      title: form.title.trim(),
      category: form.category,
      clubId: form.clubId,
      trainerId: form.trainerId,
      time: form.time,
      durationMin: Math.max(10, Number(form.duration) || 60),
      weekdays: form.weekdays,
      capacity: Math.max(1, Number(form.capacity) || 15),
      level: form.level,
      room: form.room.trim(),
      description: form.description.trim(),
      color: COLORS[Math.abs(form.category.length + form.title.length) % COLORS.length],
    };
    saveContent('classes', form.isNew ? [...list, item] : list.map((c) => (c.id === form.id ? item : c)));
    setForm(null);
  };

  const remove = () => {
    if (!form || form.isNew) return;
    saveContent('classes', list.filter((c) => c.id !== form.id));
    setForm(null);
  };

  return (
    <View style={{ gap: Spacing.two }}>
      {list.length === 0 && !form ? (
        <T type="small" color={Colors.textMuted}>
          {t('adm_classes_none')}
        </T>
      ) : null}
      {list.map((c) => (
        <Row key={c.id} gap={Spacing.two} style={styles.row}>
          <View style={{ width: 8, height: 34, borderRadius: 4, backgroundColor: c.color }} />
          <View style={{ flex: 1 }}>
            <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
              {c.title}
            </T>
            <T type="small" color={Colors.textMuted} numberOfLines={1}>
              {c.weekdays.map((d) => weekdayShort.get(d)).join(', ')} • {c.time} • {clubs.find((x) => x.id === c.clubId)?.name.replace('Seven Gym ', '')}
            </T>
          </View>
          <T type="small" color={accent} style={{ fontWeight: '700' }} onPress={() => open(c)}>
            {t('edit')}
          </T>
        </Row>
      ))}

      {form ? (
        <View style={{ gap: Spacing.two }}>
          <Field label={t('adm_cl_title')} value={form.title} onChange={(v) => set({ title: v })} />
          <T type="small" color={Colors.textMuted}>
            {t('adm_cl_category')}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {categories.filter((c): c is Category => c !== 'Все').map((c) => (
              <Chip key={c} label={td(c)} active={form.category === c} onPress={() => set({ category: c })} />
            ))}
          </Row>
          <T type="small" color={Colors.textMuted}>
            {t('adm_cl_club')}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {clubs.map((c) => (
              <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={form.clubId === c.id} onPress={() => set({ clubId: c.id })} />
            ))}
          </Row>
          <T type="small" color={Colors.textMuted}>
            {t('tl_trainer')}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip label={t('adm_cl_no_trainer')} active={form.trainerId === ''} onPress={() => set({ trainerId: '' })} />
            {trainers.map((tr) => (
              <Chip key={tr.id} label={tr.name.split(' ').slice(0, 2).join(' ')} active={form.trainerId === tr.id} onPress={() => set({ trainerId: tr.id })} />
            ))}
          </Row>
          <T type="small" color={Colors.textMuted}>
            {t('adm_cl_days')}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {WEEK.map((d) => (
              <Chip key={d} label={weekdayShort.get(d)} active={form.weekdays.includes(d)} onPress={() => set({ weekdays: form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d] })} />
            ))}
          </Row>
          <Row gap={Spacing.two}>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_cl_time')} value={form.time} onChange={(v) => set({ time: v })} placeholder="18:00" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_cl_duration')} value={form.duration} onChange={(v) => set({ duration: v.replace(/\D/g, '') })} keyboard="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('adm_cl_capacity')} value={form.capacity} onChange={(v) => set({ capacity: v.replace(/\D/g, '') })} keyboard="number-pad" />
            </View>
          </Row>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {LEVELS.map((l) => (
              <Chip key={l} label={td(l)} active={form.level === l} onPress={() => set({ level: l })} />
            ))}
          </Row>
          <Field label={t('adm_cl_room')} value={form.room} onChange={(v) => set({ room: v })} />
          <Field label={t('adm_promo_text')} value={form.description} onChange={(v) => set({ description: v })} multiline />
          {!validTime ? (
            <T type="small" color={Colors.danger}>
              {t('adm_cl_time_bad')}
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
          title={t('adm_cl_new')}
          icon="add-circle-outline"
          variant="secondary"
          onPress={() => setForm({ id: `k${Date.now().toString(36)}`, isNew: true, title: '', category: 'Сила', clubId: clubs[0]?.id ?? 'c1', trainerId: '', time: '18:00', duration: '60', weekdays: [1, 3, 5], capacity: '15', level: 'Все уровни', room: '', description: '', active: true })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
