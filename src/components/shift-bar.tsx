import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { endShift, fetchShifts, startShift, type Shift } from '@/lib/api';
import { useApp, useI18n, useNow } from '@/store/app-context';

const ALMATY = 5 * 3600000; // the clubs' clock: UTC+5

/** The administrator's open shift, shared by every staff screen. undefined = not loaded yet. */
let current: Shift | null | undefined;
let loadedFor = '';
const listeners = new Set<() => void>();
const set = (s: Shift | null | undefined) => {
  current = s;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** "09:12" on the clubs' clock. */
export const clockTime = (ts: number) => new Date(ts + ALMATY).toISOString().slice(11, 16);

/** The shift is found again after a restart or on another phone: the server keeps it, matched by the administrator's name. */
export function useShift() {
  const { staff, staffCode } = useApp();
  const open = useSyncExternalStore(subscribe, () => current);
  const name = staff?.name.trim() ?? '';

  useEffect(() => {
    if (!staffCode || !name || loadedFor === name.toLowerCase()) return;
    loadedFor = name.toLowerCase();
    set(undefined); // another person signed in on this phone
    fetchShifts(staffCode, 3).then((list) => {
      if (!list) {
        loadedFor = '';
        return;
      }
      set(list.find((s) => !s.end && !s.auto && s.staff.toLowerCase() === name.toLowerCase()) ?? null);
    });
  }, [staffCode, name]);

  const begin = useCallback(async () => {
    if (!staff) return false;
    const r = await startShift(staffCode, { staff: name, clubId: staff.clubId });
    if (r) set({ id: r.id, staff: name, clubId: staff.clubId, start: r.start, end: null });
    return !!r;
  }, [staff, staffCode, name]);

  const finish = useCallback(async () => {
    if (!current) return null;
    const r = await endShift(staffCode, current.id);
    if (!r) return null;
    const worked = r.end - current.start;
    set(null);
    return worked;
  }, [staffCode]);

  return { open: open ?? null, ready: open !== undefined, begin, finish };
}

/** "8 ч 12 мин" */
export function useDuration() {
  const { t } = useI18n();
  return (ms: number) => t('shift_dur', { h: Math.floor(ms / 3600000), m: Math.floor((ms % 3600000) / 60000) });
}

/** One big button for the start of the shift, one for the end. Ending asks for a second tap. */
export function ShiftBar() {
  const { t } = useI18n();
  const { open, ready, begin, finish } = useShift();
  const dur = useDuration();
  const now = useNow();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!ready) return null;

  const tapStart = async () => {
    setBusy(true);
    setNote((await begin()) ? '' : t('shift_fail'));
    setBusy(false);
  };

  const tapEnd = async () => {
    if (!sure) {
      setSure(true);
      timer.current = setTimeout(() => setSure(false), 4000);
      return;
    }
    clearTimeout(timer.current);
    setSure(false);
    setBusy(true);
    const worked = await finish();
    setNote(worked == null ? t('shift_fail') : t('shift_done', { dur: dur(worked) }));
    setBusy(false);
  };

  if (!open) {
    return (
      <View style={{ gap: 4, marginTop: Spacing.two }}>
        <Pressable onPress={tapStart} disabled={busy} style={({ pressed }) => [styles.arrive, pressed && { opacity: 0.8 }]}>
          <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
          <T type="body" color="#FFFFFF" style={{ fontWeight: '800' }}>
            {t('shift_arrive')}
          </T>
        </Pressable>
        {note ? (
          <T type="small" color={note === t('shift_fail') ? Colors.danger : Colors.success}>
            {note}
          </T>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 4, marginTop: Spacing.two }}>
      <View style={styles.on}>
        <View style={{ flex: 1 }}>
          <T type="small" style={{ fontWeight: '700' }}>
            {t('shift_on', { time: clockTime(open.start) })}
          </T>
          <T type="small" color={Colors.textSecondary}>
            {dur(Math.max(0, now - open.start))}
          </T>
        </View>
        <Pressable onPress={tapEnd} disabled={busy} style={({ pressed }) => [styles.end, sure && styles.endSure, pressed && { opacity: 0.8 }]}>
          <T type="small" color={sure ? '#FFFFFF' : Colors.danger} style={{ fontWeight: '800' }}>
            {sure ? t('shift_finish_sure') : t('shift_finish')}
          </T>
        </Pressable>
      </View>
      {note ? (
        <T type="small" color={Colors.danger}>
          {note}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  arrive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: Radius.md, backgroundColor: Colors.success },
  on: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 10, borderRadius: Radius.md, backgroundColor: 'rgba(52,168,83,0.10)', borderWidth: 1, borderColor: 'rgba(52,168,83,0.35)' },
  end: { minHeight: 44, paddingHorizontal: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.danger, alignItems: 'center', justifyContent: 'center', maxWidth: 190 },
  endSure: { backgroundColor: Colors.danger },
});
