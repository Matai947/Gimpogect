import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useI18n, useNow } from '@/store/app-context';

const ALMATY = 5 * 3600000;

/** A month of the calendar with the days the person came marked; arrows go back through the months. Monday first. */
export function VisitCalendar({ days, accent, oneFit }: { days: string[]; accent: string; oneFit?: Set<string> }) {
  const { t } = useI18n();
  const now = useNow();
  const today = new Date(now + ALMATY).toISOString().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7));
  const came = useMemo(() => new Set(days), [days]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const inMonth = days.filter((d) => d.startsWith(month)).length;
  const shift = (d: number) => setMonth(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7));
  const earliest = days.length ? days.reduce((a, b) => (a < b ? a : b)).slice(0, 7) : month;

  return (
    <View style={{ gap: Spacing.two }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={() => shift(-1)} disabled={month <= earliest} hitSlop={8} style={[styles.arrow, month <= earliest && { opacity: 0.3 }]}>
          <Ionicons name="chevron-back" size={18} color={accent} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <T type="small" style={{ fontWeight: '700' }}>
            {t('ex_months').split('|')[m - 1]} {y}
          </T>
          <T type="small" color={Colors.textMuted}>
            {t('vc_month', { n: inMonth })}
          </T>
        </View>
        <Pressable onPress={() => shift(1)} disabled={month >= today.slice(0, 7)} hitSlop={8} style={[styles.arrow, month >= today.slice(0, 7) && { opacity: 0.3 }]}>
          <Ionicons name="chevron-forward" size={18} color={accent} />
        </Pressable>
      </Row>
      <View style={styles.grid}>
        {t('vc_week')
          .split('|')
          .map((w) => (
            <View key={w} style={styles.cell}>
              <T type="small" color={Colors.textMuted} style={{ fontSize: 11 }}>
                {w}
              </T>
            </View>
          ))}
        {cells.map((d, i) =>
          d ? (
            <View key={d} style={styles.cell}>
              <View style={[styles.day, came.has(d) && { backgroundColor: oneFit?.has(d) ? Colors.info : accent }, d === today && !came.has(d) && { borderWidth: 1.5, borderColor: accent }]}>
                <T type="small" color={came.has(d) ? '#FFFFFF' : d > today ? Colors.textMuted : Colors.text} style={{ fontWeight: came.has(d) ? '800' : '500' }}>
                  {Number(d.slice(8))}
                </T>
              </View>
            </View>
          ) : (
            <View key={'e' + i} style={styles.cell} />
          ),
        )}
      </View>
      {oneFit?.size ? (
        <Row gap={Spacing.three} style={{ justifyContent: 'center' }}>
          <Row gap={6} style={{ alignItems: 'center' }}>
            <View style={[styles.swatch, { backgroundColor: accent }]} />
            <T type="small" color={Colors.textMuted}>
              {t('vc_plan')}
            </T>
          </Row>
          <Row gap={6} style={{ alignItems: 'center' }}>
            <View style={[styles.swatch, { backgroundColor: Colors.info }]} />
            <T type="small" color={Colors.textMuted}>
              1Fit
            </T>
          </Row>
        </Row>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: { padding: 4, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  day: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 10, height: 10, borderRadius: 5 },
});
