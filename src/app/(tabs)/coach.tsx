import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, IconButton, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { findExercise } from '@/data/exercises';
import { goalTitle } from '@/data/fitness';
import { areaWish, askCoach, generatePlan, hasApiKey, isPlanRequest, newMessage, recentAreas, type PlanDay } from '@/lib/coach';
import { useApp, useCoachContext, useI18n } from '@/store/app-context';

type Tab = 'chat' | 'plan';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const promptIcons: IconName[] = ['calendar-outline', 'flash-outline', 'barbell-outline', 'nutrition-outline', 'trending-up-outline', 'flame-outline'];

export default function CoachScreen() {
  const ctx = useCoachContext();
  const { t } = useI18n();
  const { coachMessages, coachPlan, coachApiKey, addCoachMessage, clearCoachChat, setCoachPlan, setCoachApiKey } = useApp();
  const [tab, setTab] = useState<Tab>(coachPlan ? 'plan' : 'chat');
  const [input, setInput] = useState('');
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(coachApiKey ?? '');
  const listRef = useRef<ScrollView>(null);
  const online = hasApiKey();

  const quickPrompts = [t('qp_1'), t('qp_2'), t('qp_3'), t('qp_4'), t('qp_5'), t('qp_6')];
  const wishes = [t('wish_1'), t('wish_2'), t('wish_3'), t('wish_4'), t('wish_5')];

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [coachMessages.length, busy, tab]);

  if (!ctx) {
    return (
      <SafeAreaView style={styles.root}>
        <EmptyState icon="sparkles-outline" title={t('fill_first')} subtitle={t('fill_first_sub')} action={t('fill')} onAction={() => router.push('/onboarding')} />
      </SafeAreaView>
    );
  }

  const goal = goalTitle(ctx.profile.goal);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput('');
    addCoachMessage(newMessage('user', clean));
    setBusy(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      if (isPlanRequest(clean)) {
        const plan = await generatePlan(ctx, [clean, areaWish(recentAreas(coachMessages, clean))].filter(Boolean).join('. '));
        setCoachPlan(plan);
        addCoachMessage(newMessage('assistant', t('plan_ready', { title: plan.title, summary: plan.summary, n: plan.days.length })));
      } else {
        const answer = await askCoach(ctx, coachMessages, clean);
        addCoachMessage(newMessage('assistant', answer));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addCoachMessage(newMessage('assistant', t('coach_error', { msg: msg.slice(0, 140) })));
    } finally {
      setBusy(false);
    }
  };

  const buildPlan = async (w?: string) => {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      const plan = await generatePlan(ctx, w?.trim() || undefined);
      setCoachPlan(plan);
      setWish('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTab('plan');
    } catch (e) {
      Alert.alert(t('failed'), e instanceof Error ? e.message : String(e));
    } finally {
      setPlanBusy(false);
    }
  };

  const askTechnique = (name: string) => {
    setTab('chat');
    void send(t('how_to', { name }));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Hero */}
      <LinearGradient colors={['#241538', '#141414', Colors.background]} locations={[0, 0.7, 1]} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.orbOuter}>
            <View style={styles.orbMid}>
              <View style={styles.orbCore}>
                <Ionicons name="sparkles" size={22} color={Colors.onAccent} />
              </View>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <T type="title" style={{ fontSize: 22, lineHeight: 26 }}>
              {t('coach_title')}
            </T>
            <Row gap={6} style={{ marginTop: 2 }}>
              <View style={[styles.dot, { backgroundColor: online ? Colors.success : Colors.warning }]} />
              <T type="small" color={Colors.textSecondary}>
                {online ? t('coach_online') : t('coach_offline')}
              </T>
            </Row>
          </View>
          <Row gap={2}>
            <IconButton icon="key-outline" bg="rgba(0,0,0,0.25)" color={online ? Colors.accent : Colors.text} onPress={() => setShowKey((v) => !v)} />
            {tab === 'chat' && coachMessages.length > 0 ? <IconButton icon="trash-outline" bg="rgba(0,0,0,0.25)" onPress={() => Alert.alert(t('clear_chat_q'), undefined, [{ text: t('cancel'), style: 'cancel' }, { text: t('clear'), style: 'destructive', onPress: clearCoachChat }])} /> : null}
          </Row>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: Spacing.three }}>
          <Stat label={t('st_goal')} value={goal} />
          <Stat label={t('st_weight')} value={`${ctx.currentWeightKg} ${t('kg')}`} />
          {ctx.profile.targetWeightKg ? <Stat label={t('st_target')} value={`${ctx.profile.targetWeightKg} ${t('kg')}`} /> : null}
          <Stat label={t('st_height')} value={`${ctx.profile.heightCm} ${t('cm')}`} />
          <Stat label={t('st_week')} value={t('st_week_v', { n: ctx.profile.daysPerWeek })} />
        </ScrollView>
      </LinearGradient>

      {showKey ? (
        <View style={styles.keyBox}>
          <T type="small" color={Colors.textSecondary}>
            {t('key_note')}
          </T>
          <Row gap={Spacing.two}>
            <TextInput value={keyDraft} onChangeText={setKeyDraft} placeholder="sk-ant-…" placeholderTextColor={Colors.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.keyInput} />
            <Button
              title={t('save')}
              size="sm"
              onPress={() => {
                setCoachApiKey(keyDraft);
                setShowKey(false);
              }}
            />
          </Row>
          {coachApiKey ? (
            <Pressable
              onPress={() => {
                setCoachApiKey(null);
                setKeyDraft('');
              }}
              hitSlop={8}>
              <T type="small" color={Colors.danger} style={{ fontWeight: '600' }}>
                {t('remove_key')}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Underline tabs */}
      <View style={styles.tabs}>
        {(['chat', 'plan'] as Tab[]).map((tb) => {
          const active = tab === tb;
          return (
            <Pressable key={tb} onPress={() => setTab(tb)} style={styles.tab}>
              <T type="label" color={active ? Colors.text : Colors.textMuted}>
                {tb === 'chat' ? t('tab_chat') : t('tab_plan')}
              </T>
              {tb === 'plan' && coachPlan ? <View style={styles.tabDot} /> : null}
              <View style={[styles.tabLine, active && { backgroundColor: Colors.accent }]} />
            </Pressable>
          );
        })}
      </View>

      {tab === 'chat' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
          <ScrollView ref={listRef} contentContainerStyle={styles.chat} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <AiLine text={t('coach_greeting', { name: ctx.name, goal, h: ctx.profile.heightCm, w: ctx.currentWeightKg })} />
            {coachMessages.length === 0 ? (
              <View style={styles.promptGrid}>
                {quickPrompts.map((p, i) => (
                  <Pressable key={p} onPress={() => void send(p)} style={({ pressed }) => [styles.promptCard, pressed && { opacity: 0.8 }]}>
                    <Ionicons name={promptIcons[i % promptIcons.length]} size={18} color={Colors.accent} />
                    <T type="small" style={{ fontWeight: '600', marginTop: 8 }}>
                      {p}
                    </T>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {coachMessages.map((m) => (m.role === 'assistant' ? <AiLine key={m.id} text={m.text} onExercise={askTechnique} /> : <UserLine key={m.id} text={m.text} />))}
            {busy ? (
              <Row gap={10} style={styles.aiLine}>
                <View style={styles.aiBar} />
                <ActivityIndicator color={Colors.accent} size="small" />
                <T type="small" color={Colors.textSecondary}>
                  {t('thinking')}
                </T>
              </Row>
            ) : null}
          </ScrollView>

          {coachMessages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two }} style={{ flexGrow: 0 }}>
              {quickPrompts.map((p) => (
                <Pressable key={p} onPress={() => void send(p)} style={styles.quick} disabled={busy}>
                  <T type="small" style={{ fontWeight: '600' }}>
                    {p}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('ask_ph')}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              multiline
              maxLength={600}
              onSubmitEditing={() => void send(input)}
              blurOnSubmit
              returnKeyType="send"
            />
            <Pressable onPress={() => void send(input)} disabled={!input.trim() || busy} style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}>
              <Ionicons name="arrow-up" size={20} color={Colors.onAccent} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.planBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.wishBox}>
            <T type="small" color={Colors.textSecondary}>
              {coachPlan ? t('wish_rebuild') : t('wish_label')}
            </T>
            <Row gap={Spacing.two}>
              <TextInput value={wish} onChangeText={setWish} placeholder={t('wish_ph')} placeholderTextColor={Colors.textMuted} style={styles.wishInput} />
              <Pressable onPress={() => void buildPlan(wish)} disabled={planBusy} style={[styles.wishBtn, planBusy && { opacity: 0.5 }]}>
                {planBusy ? <ActivityIndicator color={Colors.onAccent} size="small" /> : <Ionicons name={coachPlan ? 'refresh' : 'sparkles'} size={20} color={Colors.onAccent} />}
              </Pressable>
            </Row>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {wishes.map((w) => (
                <Pressable key={w} onPress={() => setWish(w)} style={styles.wishChip}>
                  <T type="small" color={Colors.textSecondary}>
                    {w}
                  </T>
                </Pressable>
              ))}
            </Row>
          </View>

          {!coachPlan ? (
            <EmptyState icon="calendar-outline" title={t('no_plan_title')} subtitle={t('no_plan_sub', { n: ctx.profile.daysPerWeek })} action={planBusy ? t('making') : t('make_plan')} onAction={planBusy ? undefined : () => void buildPlan(wish)} />
          ) : (
            <>
              <View style={styles.planHead}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T type="title" style={{ flex: 1, fontSize: 22, lineHeight: 26 }}>
                    {coachPlan.title}
                  </T>
                  <View style={[styles.sourceTag, coachPlan.source === 'ai' && { borderColor: Colors.accent }]}>
                    <T type="small" color={coachPlan.source === 'ai' ? Colors.accent : Colors.textMuted} style={{ fontWeight: '700', fontSize: 11 }}>
                      {coachPlan.source === 'ai' ? t('src_ai') : t('src_local')}
                    </T>
                  </View>
                </Row>
                <T type="small" color={Colors.textSecondary} style={{ lineHeight: 19 }}>
                  {coachPlan.summary}
                </T>
              </View>

              {coachPlan.days.map((d, i) => (
                <DayBlock key={`${d.day}-${i}`} day={d} index={i} last={i === coachPlan.days.length - 1} onExercise={askTechnique} />
              ))}

              <View style={styles.nutrition}>
                <Row gap={8}>
                  <Ionicons name="nutrition-outline" size={18} color={Colors.accent} />
                  <T type="subheading">{t('nutrition_plan')}</T>
                </Row>
                {coachPlan.nutrition.map((n) => (
                  <Row key={n} gap={8} style={{ alignItems: 'flex-start' }}>
                    <View style={[styles.dot, { marginTop: 7 }]} />
                    <T type="small" color={Colors.textSecondary} style={{ flex: 1, lineHeight: 18 }}>
                      {n}
                    </T>
                  </Row>
                ))}
              </View>
              <T type="small" color={Colors.textMuted} style={{ textAlign: 'center', paddingHorizontal: Spacing.three }}>
                {t('disclaimer')}
              </T>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <T type="small" color={Colors.textMuted} style={{ fontSize: 11 }}>
        {label}
      </T>
      <T type="small" style={{ fontWeight: '700' }}>
        {value}
      </T>
    </View>
  );
}

function AiLine({ text, onExercise }: { text: string; onExercise?: (name: string) => void }) {
  const { t } = useI18n();
  const ex = onExercise ? findExercise(text.split('\n')[0].toLowerCase()) : undefined;
  return (
    <View style={styles.aiLine}>
      <View style={styles.aiBar} />
      <View style={{ flex: 1 }}>
        <T type="body" style={{ lineHeight: 23 }}>
          {text}
        </T>
        {ex && onExercise ? (
          <Pressable onPress={() => onExercise(ex.name)} hitSlop={6} style={{ marginTop: 6 }}>
            <T type="small" color={Colors.accent} style={{ fontWeight: '700' }}>
              {t('show_technique', { name: ex.name })}
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function UserLine({ text }: { text: string }) {
  return (
    <View style={styles.userLine}>
      <T type="body" style={{ lineHeight: 22 }}>
        {text}
      </T>
    </View>
  );
}

function DayBlock({ day, index, last, onExercise }: { day: PlanDay; index: number; last: boolean; onExercise: (name: string) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(index === 0);
  const [wd, ...rest] = day.day.includes('·') ? [day.day.split('·')[1].trim(), day.day.split('·')[0].trim()] : [day.day, ''];
  return (
    <View style={styles.dayRow}>
      <View style={styles.timeline}>
        <View style={styles.dayBadge}>
          <T type="label" color={Colors.onAccent} style={{ fontSize: 13 }}>
            {wd.slice(0, 2)}
          </T>
        </View>
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : Spacing.three }}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.dayHead}>
          <View style={{ flex: 1 }}>
            <T type="small" color={Colors.textMuted}>
              {rest[0] || t('day_n', { n: index + 1 })} • {day.durationMin} {t('min')}
            </T>
            <T type="subheading">{day.focus}</T>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </Pressable>
        {open ? (
          <View style={{ gap: 6, marginTop: 6 }}>
            <T type="small" color={Colors.textMuted} style={{ lineHeight: 17 }}>
              {t('warmup')}: {day.warmup}
            </T>
            {day.exercises.map((e, i) => {
              const known = !!findExercise(e.name.toLowerCase());
              return (
                <Pressable key={`${e.name}-${i}`} onPress={() => onExercise(e.name)} style={({ pressed }) => [styles.exercise, pressed && { backgroundColor: Colors.surfaceAlt }]}>
                  <View style={{ flex: 1 }}>
                    <T type="body" style={{ fontWeight: '600' }}>
                      {e.name}
                    </T>
                    {e.note ? (
                      <T type="small" color={Colors.textMuted} numberOfLines={2}>
                        {e.note}
                      </T>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T type="label" color={Colors.accent} style={{ fontSize: 14 }}>
                      {e.sets} × {e.reps}
                    </T>
                    <Row gap={4}>
                      {e.rest ? (
                        <T type="small" color={Colors.textMuted} style={{ fontSize: 11 }}>
                          {e.rest}
                        </T>
                      ) : null}
                      {known ? <Ionicons name="school-outline" size={12} color={Colors.accent} /> : null}
                    </Row>
                  </View>
                </Pressable>
              );
            })}
            <T type="small" color={Colors.textMuted} style={{ lineHeight: 17 }}>
              {t('cooldown')}: {day.cooldown}
            </T>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  hero: { paddingTop: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  orbOuter: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(154,61,205,0.25)', alignItems: 'center', justifyContent: 'center' },
  orbMid: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: 'rgba(154,61,205,0.5)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(154,61,205,0.08)' },
  orbCore: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  stat: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  keyBox: { marginHorizontal: Spacing.three, marginTop: Spacing.two, padding: Spacing.three, gap: Spacing.two, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  keyInput: { flex: 1, height: 42, borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, color: Colors.text, fontSize: 14 },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.three, marginTop: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { paddingVertical: 12, marginRight: Spacing.four, alignItems: 'center', flexDirection: 'row', gap: 6 },
  tabLine: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, borderRadius: 1, backgroundColor: 'transparent' },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  chat: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.three },
  aiLine: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  aiBar: { width: 3, alignSelf: 'stretch', minHeight: 20, borderRadius: 2, backgroundColor: Colors.accent },
  userLine: { alignSelf: 'flex-end', maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.lg, borderBottomRightRadius: 4, backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(154,61,205,0.35)' },
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  promptCard: { width: '48%', flexGrow: 1, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  quick: { paddingHorizontal: 12, height: 34, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, padding: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: 15 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  planBody: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  wishBox: { gap: Spacing.two },
  wishInput: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, color: Colors.text, fontSize: 14 },
  wishBtn: { width: 46, height: 46, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  wishChip: { paddingHorizontal: 10, height: 28, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  planHead: { gap: 6, paddingBottom: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sourceTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  dayRow: { flexDirection: 'row', gap: Spacing.two },
  timeline: { width: 36, alignItems: 'center' },
  dayBadge: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 36 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 8, paddingHorizontal: 10, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  nutrition: { gap: 8, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: 'rgba(154,61,205,0.06)', borderWidth: 1, borderColor: 'rgba(154,61,205,0.2)' },
});
