import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, ProgressBar, Row, Screen, SectionHeader, StatTile, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { goalTitle } from '@/data/fitness';
import { addDays, clubById, formatDateHuman, monthShort, parseISODate, toISODate, weekdayShort } from '@/data/mock';
import { useApp, useFitnessProfile, useI18n, useVisitStats } from '@/store/app-context';

export default function ProgressScreen() {
  const { weightLog, logWeight, visits } = useApp();
  const { t } = useI18n();
  const stats = useVisitStats();
  const fitness = useFitnessProfile();
  const [input, setInput] = useState('');
  const targetProgress =
    fitness && fitness.targetWeightKg !== undefined && fitness.weightKg !== fitness.targetWeightKg
      ? Math.min(1, Math.max(0, (fitness.weightKg - fitness.currentWeightKg) / (fitness.weightKg - fitness.targetWeightKg)))
      : 0;

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
  const rowLabels = [1, 2, 3, 4, 5, 6, 0].map((i) => weekdayShort.get(i));

  const save = () => {
    const kg = parseFloat(input.replace(',', '.'));
    if (!kg || kg < 30 || kg > 250) {
      Alert.alert(t('check_value'), t('check_value_body'));
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
        {fitness ? (
          <Card style={{ gap: Spacing.three, marginBottom: Spacing.three }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T type="small" color={Colors.textSecondary}>
                  {t('goal_label', { g: goalTitle(fitness.goal) })}
                </T>
                {fitness.targetWeightKg !== undefined && fitness.toTarget !== undefined ? (
                  <T type="heading">{Math.abs(fitness.toTarget) < 0.3 ? t('goal_reached') : fitness.toTarget > 0 ? t('lose_more', { n: Math.abs(fitness.toTarget) }) : t('gain_more', { n: Math.abs(fitness.toTarget) })}</T>
                ) : (
                  <T type="heading">
                    {t('bmi')} {fitness.bmi} • {fitness.bmiInfo.label}
                  </T>
                )}
              </View>
              <Pressable onPress={() => router.push('/onboarding?edit=1')} hitSlop={8}>
                <Ionicons name="create-outline" size={20} color={Colors.textMuted} />
              </Pressable>
            </Row>
            {fitness.targetWeightKg !== undefined ? (
              <View style={{ gap: 6 }}>
                <ProgressBar value={targetProgress} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <T type="small" color={Colors.textMuted}>
                    {t('start_kg', { n: fitness.weightKg })}
                  </T>
                  <T type="small" color={Colors.textMuted}>
                    {t('target_kg', { n: fitness.targetWeightKg })}
                  </T>
                </Row>
              </View>
            ) : null}
            <Row gap={Spacing.two}>
              <View style={styles.target}>
                <Ionicons name="flame-outline" size={16} color={Colors.warning} />
                <T type="subheading">{fitness.targets.calories}</T>
                <T type="small" color={Colors.textMuted} style={{ fontSize: 11 }}>
                  {t('kcal_day')}
                </T>
              </View>
              <View style={styles.target}>
                <Ionicons name="egg-outline" size={16} color={Colors.accent} />
                <T type="subheading">
                  {fitness.targets.protein} {t('g')}
                </T>
                <T type="small" color={Colors.textMuted} style={{ fontSize: 11 }}>
                  {t('protein_day')}
                </T>
              </View>
              <View style={styles.target}>
                <Ionicons name="water-outline" size={16} color={Colors.info} />
                <T type="subheading">
                  {fitness.targets.water} {t('l')}
                </T>
                <T type="small" color={Colors.textMuted} style={{ fontSize: 11 }}>
                  {t('water_day')}
                </T>
              </View>
            </Row>
          </Card>
        ) : null}

        <Row gap={Spacing.two}>
          <StatTile value={stats.total} label={t('total_workouts')} icon="barbell-outline" />
          <StatTile value={stats.thisMonth} label={t('last_30')} icon="calendar-outline" color={Colors.info} />
          <StatTile value={stats.weekStreak} label={t('weeks_streak')} icon="flame-outline" color={Colors.warning} />
        </Row>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('visits_8w')} />
          <Card>
            <Row gap={4} style={{ alignItems: 'flex-start' }}>
              <View style={{ gap: 4, marginRight: 4 }}>
                {rowLabels.map((d) => (
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
                {monthShort.get(parseISODate(grid[0][0]).getMonth())}
              </T>
              <T type="small" color={Colors.textMuted}>
                {t('today').toLowerCase()}
              </T>
            </Row>
          </Card>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('weight')} />
          <Card style={{ gap: Spacing.three }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T type="display" style={{ fontSize: 36 }}>
                  {last !== undefined ? last.toFixed(1) : '—'}{' '}
                  <T type="body" color={Colors.textSecondary}>
                    {t('kg')}
                  </T>
                </T>
                <T type="small" color={Colors.textSecondary}>
                  {weights.length ? t('last_record', { date: formatDateHuman(weights[weights.length - 1].date).toLowerCase() }) : ''}
                </T>
              </View>
              {weights.length > 1 ? (
                <View style={[styles.delta, { backgroundColor: delta <= 0 ? 'rgba(61,220,132,0.15)' : 'rgba(255,92,92,0.15)' }]}>
                  <Ionicons name={delta <= 0 ? 'trending-down' : 'trending-up'} size={16} color={delta <= 0 ? Colors.success : Colors.danger} />
                  <T type="label" color={delta <= 0 ? Colors.success : Colors.danger}>
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(1)} {t('kg')}
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
                <TextInput value={input} onChangeText={setInput} placeholder={t('weight_ph')} placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" style={styles.inputText} />
                <T type="small" color={Colors.textMuted}>
                  {t('kg')}
                </T>
              </View>
              <Button title={t('record')} onPress={save} disabled={!input} />
            </Row>
          </Card>
        </View>

        <View style={{ marginTop: Spacing.four }}>
          <SectionHeader title={t('recent_visits')} />
          <Card padded={false}>
            {recent.map((v, i) => (
              <View key={v.date} style={[styles.visit, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border }]}>
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
              </View>
            ))}
            {recent.length === 0 ? (
              <T type="caption" style={{ padding: Spacing.three }}>
                {t('no_visits')}
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
  target: { flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 10, gap: 2 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: Radius.pill },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 4 },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 48, borderWidth: 1, borderColor: Colors.border },
  inputText: { flex: 1, color: Colors.text, fontSize: 16 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  visitIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(198,255,61,0.12)', alignItems: 'center', justifyContent: 'center' },
});
