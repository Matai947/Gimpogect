import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/admin/fields';
import { Avatar, Button, Chip, Row, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { addDays, clubs, formatDateHuman, toISODate, trainerById, trainers, weekdayShort } from '@/data/mock';
import { deleteAppt, fetchAppts, saveAppt, type Appointment } from '@/lib/api';
import { useApp, useI18n, useMembers } from '@/store/app-context';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Front desk: give a trainer a client and a time (every week on some days, or one date). The trainer sees it in their cabinet. */
export function AppointmentsEditor({ accent }: { accent: string }) {
  const { staff, staffCode } = useApp();
  const { t } = useI18n();
  const { list: members } = useMembers();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [trainerId, setTrainerId] = useState(trainers[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<'weekly' | 'once'>('weekly');
  const [weekdays, setWeekdays] = useState<number[]>([1, 3]);
  const [date, setDate] = useState(toISODate(new Date()));
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('60');
  const [clubId, setClubId] = useState(staff?.clubId ?? clubs[0]?.id ?? 'c1');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<'ok' | 'fail' | null>(null);

  useEffect(() => {
    let live = true;
    if (staffCode) fetchAppts(staffCode).then((r) => live && r && setAppts(r));
    return () => {
      live = false;
    };
  }, [staffCode]);

  const reload = useCallback(async () => {
    if (!staffCode) return;
    const r = await fetchAppts(staffCode);
    if (r) setAppts(r);
  }, [staffCode]);

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const matches = q.length >= 2 ? members.filter((m) => m.name.toLowerCase().includes(q) || (digits.length >= 3 && m.phone.replace(/\D/g, '').includes(digits))).slice(0, 5) : [];

  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const ready = name.trim().length >= 2 && validTime && !!trainerId && (kind === 'weekly' ? weekdays.length > 0 : /^\d{4}-\d{2}-\d{2}$/.test(date));

  const add = async () => {
    if (!staffCode || !ready) return;
    const r = await saveAppt(staffCode, { trainerId, clubId, clientId, clientName: name.trim(), clientPhone: phone.trim(), kind, weekdays, date, time, durationMin: Number(duration) || 60, note: note.trim() });
    setMsg(r ? 'ok' : 'fail');
    if (r) {
      setClientId('');
      setName('');
      setPhone('');
      setQuery('');
      setNote('');
      void reload();
    }
  };

  const remove = async (id: string) => {
    if (staffCode && (await deleteAppt(staffCode, id))) void reload();
  };

  const when = (a: Appointment) => (a.kind === 'weekly' ? `${[...a.weekdays].sort((x, y) => WEEK.indexOf(x) - WEEK.indexOf(y)).map((d) => weekdayShort.get(d)).join(', ')} • ${t('appt_every')}` : formatDateHuman(a.date));

  return (
    <View style={{ gap: Spacing.two }}>
      <T type="small" color={Colors.textSecondary}>
        {t('appt_hint')}
      </T>

      <T type="label" color={Colors.textSecondary}>
        {t('tl_trainer')}
      </T>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {trainers.map((tr) => (
          <Chip key={tr.id} label={tr.name.split(' ').slice(0, 2).join(' ')} active={trainerId === tr.id} onPress={() => setTrainerId(tr.id)} />
        ))}
      </Row>

      <Field label={t('appt_search')} value={query} onChange={setQuery} />
      {matches.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => {
            setClientId(m.id);
            setName(m.name);
            setPhone(m.phone);
            setQuery('');
          }}
          style={styles.match}>
          <Avatar name={m.name} size={30} />
          <T type="small" style={{ flex: 1 }} numberOfLines={1}>
            {m.name} • {m.phone}
          </T>
        </Pressable>
      ))}
      <Row gap={Spacing.two}>
        <View style={{ flex: 1 }}>
          <Field label={t('appt_name')} value={name} onChange={setName} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('appt_phone')} value={phone} onChange={setPhone} keyboard="phone-pad" />
        </View>
      </Row>

      <Row gap={6}>
        <Chip label={t('appt_weekly')} active={kind === 'weekly'} onPress={() => setKind('weekly')} />
        <Chip label={t('appt_once')} active={kind === 'once'} onPress={() => setKind('once')} />
      </Row>
      {kind === 'weekly' ? (
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {WEEK.map((d) => (
            <Chip key={d} label={weekdayShort.get(d)} active={weekdays.includes(d)} onPress={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))} />
          ))}
        </Row>
      ) : (
        <View style={{ gap: Spacing.two }}>
          <Field label={t('appt_date')} value={date} onChange={setDate} />
          <Row gap={6}>
            <Chip label={formatDateHuman(toISODate(new Date()))} onPress={() => setDate(toISODate(new Date()))} />
            <Chip label={formatDateHuman(toISODate(addDays(new Date(), 1)))} onPress={() => setDate(toISODate(addDays(new Date(), 1)))} />
          </Row>
        </View>
      )}

      <Row gap={Spacing.two}>
        <View style={{ flex: 1 }}>
          <Field label={t('adm_cl_time')} value={time} onChange={setTime} placeholder="18:00" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('adm_cl_duration')} value={duration} onChange={(v) => setDuration(v.replace(/\D/g, ''))} keyboard="number-pad" />
        </View>
      </Row>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {clubs.map((c) => (
          <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={clubId === c.id} onPress={() => setClubId(c.id)} />
        ))}
      </Row>
      <Field label={t('appt_note')} value={note} onChange={setNote} />
      {msg ? (
        <T type="small" color={msg === 'ok' ? Colors.success : Colors.danger} style={{ fontWeight: '700' }}>
          {msg === 'ok' ? t('appt_saved') : t('appt_failed')}
        </T>
      ) : null}
      <Button title={t('appt_add')} icon="add-circle-outline" onPress={() => void add()} disabled={!ready} style={{ backgroundColor: accent }} />

      {trainers.map((tr) => {
        const mine = appts.filter((a) => a.trainerId === tr.id);
        return (
          <View key={tr.id} style={{ gap: 4, marginTop: Spacing.two }}>
            <T type="small" style={{ fontWeight: '800' }}>
              {trainerById(tr.id)?.name}
            </T>
            {mine.length === 0 ? (
              <T type="small" color={Colors.textMuted}>
                {t('appt_none')}
              </T>
            ) : (
              mine.map((a) => (
                <Row key={a.id} gap={Spacing.two} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                      {a.clientName}
                      {a.clientPhone ? ` • ${a.clientPhone}` : ''}
                    </T>
                    <T type="small" color={Colors.textMuted} numberOfLines={1}>
                      {when(a)} • {a.time} • {clubs.find((c) => c.id === a.clubId)?.name.replace('Seven Gym ', '')}
                      {a.note ? ` • ${a.note}` : ''}
                    </T>
                  </View>
                  <Ionicons name="trash-outline" size={20} color={Colors.textMuted} onPress={() => void remove(a.id)} />
                </Row>
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  match: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  row: { alignItems: 'center', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
