import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { clockTime } from '@/components/shift-bar';
import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs } from '@/data/mock';
import { fetchShifts, type Shift } from '@/lib/api';
import { useApp, useI18n, useNow } from '@/store/app-context';

const ALMATY = 5 * 3600000;
const dayOf = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10);

/** Owner: who came to work today, when, at which club, and who is still on shift. Refreshes with the clock. */
export function StaffToday({ accent }: { accent: string }) {
  const { t } = useI18n();
  const { staffCode } = useApp();
  const now = useNow();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const minute = Math.floor(now / 60000);

  useEffect(() => {
    let live = true;
    fetchShifts(staffCode, 2).then((l) => live && l && setShifts(l));
    return () => {
      live = false;
    };
  }, [staffCode, minute]);

  const today = dayOf(now);
  // a shift begun yesterday evening and still running counts too
  const list = (shifts ?? []).filter((s) => dayOf(s.start) === today || !s.end).sort((a, b) => a.start - b.start);
  const hours = (ms: number) => `${Math.floor(ms / 3600000)} ${t('st_h')} ${Math.floor((ms % 3600000) / 60000)} ${t('st_min')}`;

  return (
    <View style={styles.card}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T type="subheading">{t('st_title')}</T>
        <T type="small" color={Colors.textMuted}>
          {t('st_on_now', { n: list.filter((s) => !s.end).length })}
        </T>
      </Row>
      {shifts === null ? null : list.length === 0 ? (
        <T type="small" color={Colors.textMuted}>
          {t('st_none')}
        </T>
      ) : (
        list.map((s) => (
          <Row key={s.id} style={styles.line}>
            <View style={[styles.dot, { backgroundColor: s.end ? Colors.textMuted : Colors.success }]} />
            <View style={{ flex: 1 }}>
              <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                {s.staff}
              </T>
              <T type="small" color={Colors.textMuted} numberOfLines={1}>
                {clubs.find((c) => c.id === s.clubId)?.name.replace('Seven Gym ', '')} • {t('st_came', { time: clockTime(s.start) })}
                {s.end ? ` • ${t('st_left', { time: clockTime(s.end) })}` : ''}
              </T>
            </View>
            <T type="small" color={s.end ? Colors.text : accent} style={{ fontWeight: '700' }}>
              {s.end ? hours(s.end - s.start) : t('rep_shift_now')}
            </T>
          </Row>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  line: { gap: Spacing.two, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
