import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ProgressBar, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { bmi, bmiLabel, goals, levels, type FitnessProfile, type Gender, type Goal, type Level } from '@/data/fitness';
import { useApp } from '@/store/app-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const STEPS = 4;

export default function OnboardingScreen() {
  const { user, completeOnboarding } = useApp();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === '1' && !!user?.profile;
  const initial = user?.profile;

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(initial?.goal ?? null);
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'male');
  const [age, setAge] = useState(String(initial?.age ?? ''));
  const [height, setHeight] = useState(String(initial?.heightCm ?? ''));
  const [weight, setWeight] = useState(String(initial?.weightKg ?? ''));
  const [target, setTarget] = useState(initial?.targetWeightKg !== undefined ? String(initial.targetWeightKg) : '');
  const [level, setLevel] = useState<Level>(initial?.level ?? 'beginner');
  const [days, setDays] = useState(initial?.daysPerWeek ?? 3);

  const ageN = parseInt(age, 10);
  const heightN = parseFloat(height.replace(',', '.'));
  const weightN = parseFloat(weight.replace(',', '.'));
  const targetN = parseFloat(target.replace(',', '.'));
  const needsTarget = goal === 'lose' || goal === 'gain';

  const valid = [
    goal !== null,
    ageN >= 12 && ageN <= 90,
    heightN >= 120 && heightN <= 230 && weightN >= 30 && weightN <= 250 && (!needsTarget || !target || (targetN >= 30 && targetN <= 250)),
    true,
  ][step];

  const next = () => {
    Haptics.selectionAsync().catch(() => {});
    if (step < STEPS - 1) {
      setStep(step + 1);
      return;
    }
    const profile: FitnessProfile = {
      gender,
      age: ageN,
      heightCm: Math.round(heightN),
      weightKg: Math.round(weightN * 10) / 10,
      targetWeightKg: needsTarget && target ? Math.round(targetN * 10) / 10 : undefined,
      goal: goal!,
      level,
      daysPerWeek: days,
    };
    completeOnboarding(profile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (isEdit) router.back();
    else router.replace('/(tabs)');
  };

  const back = () => (step > 0 ? setStep(step - 1) : isEdit ? router.back() : null);

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.top}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pressable onPress={back} hitSlop={10} style={{ opacity: step === 0 && !isEdit ? 0 : 1 }}>
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
            <T type="small" color={Colors.textSecondary}>
              Шаг {step + 1} из {STEPS}
            </T>
            {isEdit ? (
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            ) : (
              <View style={{ width: 24 }} />
            )}
          </Row>
          <ProgressBar value={(step + 1) / STEPS} height={4} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <>
              <T type="title">{isEdit ? 'Ваша цель' : `${user?.name ?? 'Привет'}, какая у вас цель?`}</T>
              <T type="caption" style={{ marginBottom: Spacing.two }}>
                Подберём занятия, тренера и спортпит под неё
              </T>
              {goals.map((g) => {
                const active = goal === g.key;
                return (
                  <Pressable key={g.key} onPress={() => setGoal(g.key)} style={[styles.option, active && styles.optionActive]}>
                    <View style={[styles.optionIcon, active && { backgroundColor: Colors.accent }]}>
                      <Ionicons name={g.icon as IconName} size={22} color={active ? Colors.onAccent : Colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T type="subheading">{g.title}</T>
                      <T type="small" color={Colors.textSecondary}>
                        {g.subtitle}
                      </T>
                    </View>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? Colors.accent : Colors.textMuted} />
                  </Pressable>
                );
              })}
            </>
          )}

          {step === 1 && (
            <>
              <T type="title">Немного о вас</T>
              <T type="caption" style={{ marginBottom: Spacing.two }}>
                Нужно для расчёта нормы калорий и нагрузки
              </T>
              <T type="label" style={{ marginBottom: Spacing.two }}>
                Пол
              </T>
              <Row gap={Spacing.two}>
                {(
                  [
                    ['male', 'Мужской', 'male'],
                    ['female', 'Женский', 'female'],
                  ] as [Gender, string, IconName][]
                ).map(([key, label, icon]) => (
                  <Pressable key={key} onPress={() => setGender(key)} style={[styles.segment, gender === key && styles.segmentActive]}>
                    <Ionicons name={icon} size={20} color={gender === key ? Colors.onAccent : Colors.text} />
                    <T type="label" color={gender === key ? Colors.onAccent : Colors.text}>
                      {label}
                    </T>
                  </Pressable>
                ))}
              </Row>
              <NumberField label="Возраст" value={age} onChange={setAge} unit="лет" step={1} min={12} max={90} autoFocus />
            </>
          )}

          {step === 2 && (
            <>
              <T type="title">Рост и вес</T>
              <T type="caption" style={{ marginBottom: Spacing.two }}>
                Вес будем отслеживать в разделе «Прогресс»
              </T>
              <NumberField label="Рост" value={height} onChange={setHeight} unit="см" step={1} min={120} max={230} autoFocus />
              <NumberField label="Вес сейчас" value={weight} onChange={setWeight} unit="кг" step={0.5} min={30} max={250} decimals />
              {needsTarget ? <NumberField label={goal === 'lose' ? 'Желаемый вес' : 'Целевой вес'} value={target} onChange={setTarget} unit="кг" step={0.5} min={30} max={250} decimals optional /> : null}
              {heightN >= 120 && weightN >= 30 ? (
                <View style={styles.bmiCard}>
                  <View style={{ flex: 1 }}>
                    <T type="small" color={Colors.textSecondary}>
                      Индекс массы тела
                    </T>
                    <T type="heading">{bmi(weightN, heightN).toFixed(1)}</T>
                  </View>
                  <T type="label" color={bmiLabel(bmi(weightN, heightN)).color}>
                    {bmiLabel(bmi(weightN, heightN)).label}
                  </T>
                </View>
              ) : null}
            </>
          )}

          {step === 3 && (
            <>
              <T type="title">Уровень и график</T>
              <T type="caption" style={{ marginBottom: Spacing.two }}>
                Чтобы расписание и нагрузка были по силам
              </T>
              {levels.map((l) => {
                const active = level === l.key;
                return (
                  <Pressable key={l.key} onPress={() => setLevel(l.key)} style={[styles.option, active && styles.optionActive]}>
                    <View style={{ flex: 1 }}>
                      <T type="subheading">{l.title}</T>
                      <T type="small" color={Colors.textSecondary}>
                        {l.subtitle}
                      </T>
                    </View>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? Colors.accent : Colors.textMuted} />
                  </Pressable>
                );
              })}
              <T type="label" style={{ marginTop: Spacing.three, marginBottom: Spacing.two }}>
                Тренировок в неделю
              </T>
              <Row gap={Spacing.two}>
                {[2, 3, 4, 5, 6].map((d) => (
                  <Pressable key={d} onPress={() => setDays(d)} style={[styles.day, days === d && styles.segmentActive]}>
                    <T type="heading" color={days === d ? Colors.onAccent : Colors.text}>
                      {d}
                    </T>
                  </Pressable>
                ))}
              </Row>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button title={step === STEPS - 1 ? (isEdit ? 'Сохранить' : 'Готово') : 'Далее'} icon={step === STEPS - 1 ? 'checkmark' : 'arrow-forward'} onPress={next} disabled={!valid} size="lg" />
          {!isEdit && step === 0 ? (
            <Pressable
              onPress={() => {
                completeOnboarding({ gender: 'male', age: 30, heightCm: 175, weightKg: 75, goal: 'tone', level: 'beginner', daysPerWeek: 3 });
                router.replace('/(tabs)');
              }}
              hitSlop={8}
              style={{ alignSelf: 'center', marginTop: Spacing.two }}>
              <T type="small" color={Colors.textMuted}>
                Заполнить позже
              </T>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  step,
  min,
  max,
  decimals,
  autoFocus,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  step: number;
  min: number;
  max: number;
  decimals?: boolean;
  autoFocus?: boolean;
  optional?: boolean;
}) {
  const n = parseFloat(value.replace(',', '.'));
  const bump = (d: number) => {
    const base = isNaN(n) ? (min + max) / 2 : n;
    const v = Math.min(max, Math.max(min, base + d));
    onChange(decimals ? String(Math.round(v * 10) / 10) : String(Math.round(v)));
  };
  return (
    <View style={{ marginTop: Spacing.three }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <T type="label">{label}</T>
        {optional ? (
          <T type="small" color={Colors.textMuted}>
            необязательно
          </T>
        ) : null}
      </Row>
      <View style={styles.numField}>
        <Pressable onPress={() => bump(-step)} hitSlop={8} style={styles.numBtn}>
          <Ionicons name="remove" size={20} color={Colors.text} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^\d.,]/g, '').slice(0, 5))}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          style={styles.numInput}
          placeholder="—"
          placeholderTextColor={Colors.textMuted}
          autoFocus={autoFocus}
          textAlign="center"
        />
        <T type="body" color={Colors.textSecondary} style={{ width: 36 }}>
          {unit}
        </T>
        <Pressable onPress={() => bump(step)} hitSlop={8} style={styles.numBtn}>
          <Ionicons name="add" size={20} color={Colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  top: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two },
  content: { padding: Spacing.three, paddingTop: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.five },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  optionActive: { borderColor: Colors.accent, backgroundColor: 'rgba(198,255,61,0.06)' },
  optionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(198,255,61,0.12)', alignItems: 'center', justifyContent: 'center' },
  segment: { flex: 1, height: 52, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  segmentActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  day: { flex: 1, height: 56, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  numField: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, height: 60, paddingHorizontal: 8 },
  numBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  numInput: { flex: 1, color: Colors.text, fontSize: 26, fontWeight: '800' },
  bmiCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three, padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  footer: { padding: Spacing.three, paddingBottom: Spacing.three, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
});
