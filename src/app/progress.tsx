import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Row, Screen, SectionHeader, StatTile, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, clubById, formatDateHuman, monthShort, parseISODate, toISODate } from '@/data/mock';
import { useApp, useVisitStats } from '@/store/app-context';

export default function ProgressScreen() {
  const { weightLog, logWeight, visits } = useApp();
  const stats = useVisitStats();
  const [input, setInput] = useState('');

  const weights = useMemo(() => [...weightLog].sort((a, b) => a.date.localeCompare(b.date)).slice(-10), [weightLog]);
  const min = Math.min(...weights.map((w) => w.kg), Infinity);
  const max = Math.max(...weights.map((w) => w.kg), -Infinity);
  const first = weights[0]?.kg;
  const last = weights[weights.length - 1]?.kg;
  const delta = first !== undefined && last !== undefined ? last - first : 0;

  // 8-week grid, columns = weeks, rows = weekdays (Mon..Sun)
  const grid = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // Mon=0
    const start = addDays(today, -(7 * 7 + dow));
    return Array.from({ length: 8 }, (_, w) => Array.from({ length: 7 }, (_, d) => toISODate(addDays(start, w * 7 + d))));
  }, []);

  const save = () => {
    const kg = parseFloat(input.replace(',', '.'));
    if (!kg || kg < 30 || kg > 250) {
      Alert.alert('Проверьте значение', 'Введите вес от 30 до 250 кг');
      return;
    }
    logWeight(Math.round(kg * 10) / 10);
    setInput('');
  };

  const recent = [...visits].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const todayIso = toISODate(new Date());

  return (
    <Screen edges={[]}>
      <View style={styles.body}>
        <Row gap={Spacing.two}>
          <StatTile value={stats.total} label="тренировок всего" icon="barbell-outline" />
          <StatTile value={stats.thisMonth} label="за 30 дней" icon="calendar-outline" color={Colors.info} />
          <StatTile value={stats.weekStreak} label="недель подряд" icon="flame-outline" color={Colors.warning} />
        </Row>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title="Посещения за 8 недель" />
          <Card>
            <Row gap={4} style={{ alignItems: 'flex-start' }}>
              <View style={{ gap: 4, marginRight: 4 }}>
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                  <T key={d} type="small" color={Colors.textMuted} style={{ height: 22, lineHeight: 22, fontSize: 10 }}>
                    {d}
                  </T>
                ))}
              </View>
              {grid.map((week, wi) => (
                <View key={wi} style={{ gap: 4, flex: 1 }}>
                  {week.map((iso) => {
                    const hit = stats.dates.has(iso);
                    const future = iso > todayIso;
                    return <View key={iso} style={[styles.cell, hit && { backgroundColor: Colors.accent }, future && { opacity: 0.25 }, iso === todayIso && { borderWidth: 1.5, borderColor: Colors.text }]} />;
                  })}
                </View>
              ))}
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: Spacing.two }}>
              <T type="small" color={Colors.textMuted}>
                {monthShort[parseISODate(grid[0][0]).getMonth()]}
              </T>
              <T type="small" color={Colors.textMuted}>
                сегодня
              </T>
            </Row>
          </Card>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title="Вес" />
          <Card style={{ gap: Spacing.three }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T type="display" style={{ fontSize: 36 }}>
                  {last !== undefined ? last.toFixed(1) : '—'} <T type="body" color={Colors.textSecondary}>кг</T>
                </T>
                <T type="small" color={Colors.textSecondary}>
                  Последняя запись {weights.length ? formatDateHuman(weights[weights.length - 1].date).toLowerCase() : ''}
                </T>
              </View>
              {weights.length > 1 ? (
                <View style={[styles.delta, { backgroundColor: delta <= 0 ? 'rgba(61,220,132,0.15)' : 'rgba(255,92,92,0.15)' }]}>
                  <Ionicons name={delta <= 0 ? 'trending-down' : 'trending-up'} size={16} color={delta <= 0 ? Colors.success : Colors.danger} />
                  <T type="label" color={delta <= 0 ? Colors.success : Colors.danger}>
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(1)} кг
                  </T>
                </View>
              ) : null}
            </Row>

            {weights.length > 1 ? (
              <View style={styles.chart}>
                {weights.map((w) => {
                  const range = max - min || 1;
                  const h = 30 + ((w.kg - min) / range) * 90;
                  const d = parseISODate(w.date);
                  return (
                    <View key={w.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <T type="small" color={Colors.textSecondary} style={{ fontSize: 10 }}>
                        {w.kg.toFixed(1)}
                      </T>
                      <View style={{ width: '70%', height: h, borderRadius: 6, backgroundColor: w.date === weights[weights.length - 1].date ? Colors.accent : Colors.surfaceAlt }} />
                      <T type="small" color={Colors.textMuted} style={{ fontSize: 10 }}>
                        {d.getDate()}.{String(d.getMonth() + 1).padStart(2, '0')}
                      </T>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Row gap={Spacing.two}>
              <View style={styles.input}>
                <TextInput value={input} onChangeText={setInput} placeholder="Например, 79.5" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" style={styles.inputText} />
                <T type="small" color={Colors.textMuted}>
                  кг
                </T>
              </View>
              <Button title="Записать" onPress={save} disabled={!input} />
            </Row>
          </Card>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title="Последние визиты" />
          <Card padded={false}>
            {recent.map((v, i) => (
              <Pressable key={v.date} style={[styles.visit, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border }]}>
                <View style={styles.visitIcon}>
                  <Ionicons name="checkmark" size={16} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <T type="body" style={{ fontWeight: '600' }}>
                    {formatDateHuman(v.date)}
                  </T>
                  <T type="small" color={Colors.textSecondary}>
                    {clubById(v.clubId)?.name}
                  </T>
                </View>
              </Pressable>
            ))}
            {recent.length === 0 ? (
              <T type="caption" style={{ padding: Spacing.three }}>
                Пока нет посещений
              </T>
            ) : null}
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.three },
  cell: { height: 22, borderRadius: 6, backgroundColor: Colors.surfaceAlt },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: Radius.pill },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 4 },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 48, borderWidth: 1, borderColor: Colors.border },
  inputText: { flex: 1, color: Colors.text, fontSize: 16 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  visitIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(198,255,61,0.12)', alignItems: 'center', justifyContent: 'center' },
});
