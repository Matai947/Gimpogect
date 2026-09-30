import Anthropic from '@anthropic-ai/sdk';

import { exercises, findExercise, type Exercise } from '@/data/exercises';
import { dailyTargets, goalByKey, levels, type FitnessProfile } from '@/data/fitness';
import { classTemplates, clubById, trainers } from '@/data/mock';
import { getLang, languageName } from '@/i18n';

/* ---------- types ---------- */

export type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; ts: number };

let seq = 0;
export function newMessage(role: ChatMessage['role'], text: string): ChatMessage {
  const ts = Date.now();
  seq += 1;
  return { id: `${role[0]}${ts}_${seq}`, role, text, ts };
}

export type PlanExercise = { name: string; sets: string; reps: string; rest?: string; note?: string };
export type PlanDay = { day: string; focus: string; durationMin: number; warmup: string; exercises: PlanExercise[]; cooldown: string };
export type WeekPlan = { title: string; summary: string; days: PlanDay[]; nutrition: string[]; createdAt: string; source: 'ai' | 'local' };

export type CoachContext = {
  name: string;
  profile: FitnessProfile;
  currentWeightKg: number;
  weightTrend: { date: string; kg: number }[];
  visitsThisWeek: number;
  homeClubId: string;
  upcoming: string[];
};

/* ---------- API key ---------- */

let runtimeKey: string | null = null;
export function setRuntimeApiKey(key: string | null) {
  runtimeKey = key?.trim() || null;
}
export function getApiKey(): string | null {
  return runtimeKey ?? process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.trim() ?? null;
}
export function hasApiKey() {
  return !!getApiKey();
}

function client() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');
  // The key lives on the device only for this demo; a production app should call Claude through its own backend.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 });
}

const MODEL = 'claude-opus-5-5';

/* ---------- prompts ---------- */

const levelTitle = (k: FitnessProfile['level']) => levels.find((l) => l.key === k)?.title ?? k;

export function buildSystemPrompt(ctx: CoachContext): string {
  const g = goalByKey(ctx.profile.goal);
  const lang = getLang();
  const langRule = lang === 'ru' ? 'Общаешься на русском' : `Клиент выбрал ${languageName(lang)} язык интерфейса: отвечай на ${languageName(lang)} языке, включая названия дней и упражнений в плане`;
  const targets = dailyTargets({ ...ctx.profile, weightKg: ctx.currentWeightKg });
  const club = clubById(ctx.homeClubId);
  const trend = ctx.weightTrend.slice(-6).map((w) => `${w.date}: ${w.kg} кг`).join(', ');
  const classes = classTemplates.map((c) => `${c.title} (${c.category}, ${c.level})`).join('; ');
  const coaches = trainers.map((t) => `${t.name} — ${t.specialties.join('/')}`).join('; ');
  const lib = exercises.map((e) => e.name).join(', ');

  return `Ты — ИИ-тренер приложения фитнес-сети Gym Project. ${langRule}, дружелюбно и по делу, как опытный персональный тренер. Отвечай коротко: 3–8 предложений или компактный список. Без markdown-заголовков и таблиц; для списков используй строки, начинающиеся с «•». Жирный текст не используй.

Клиент: ${ctx.name}, ${ctx.profile.gender === 'male' ? 'мужчина' : 'женщина'}, ${ctx.profile.age} лет, рост ${ctx.profile.heightCm} см, вес ${ctx.currentWeightKg} кг${ctx.profile.targetWeightKg ? `, целевой вес ${ctx.profile.targetWeightKg} кг` : ''}.
Цель: ${g.title} (${g.subtitle}). Уровень: ${levelTitle(ctx.profile.level)}. Готов тренироваться ${ctx.profile.daysPerWeek} раз в неделю.
Динамика веса: ${trend || 'нет данных'}. Тренировок на этой неделе: ${ctx.visitsThisWeek}. Ближайшие записи: ${ctx.upcoming.length ? ctx.upcoming.join('; ') : 'нет'}.
Ориентиры на день: ${targets.calories} ккал, ${targets.protein} г белка, ${targets.water} л воды.
Домашний клуб: ${club?.name ?? 'Gym Project'}: ${club?.amenities.join(', ') ?? ''}.
Групповые занятия сети: ${classes}.
Тренеры сети: ${coaches}.
Упражнения, технику которых приложение умеет показывать пошагово: ${lib}. Когда советуешь одно из них, называй его точно так же.

Правила:
• Адаптируй советы под цель, уровень, вес и динамику. Учитывай, что «сухое тело» = снижение жира с сохранением мышц: силовые + умеренный дефицит калорий + белок.
• Объясняя технику, давай 3–5 шагов и 1–2 типичные ошибки.
• Не ставь диагнозов и не назначай лекарства и добавки с рисками; при боли, травмах, беременности, давлении советуй врача.
• Упоминание части тела без слов о боли («укрепить спину», «накачать ноги») это запрос на упражнения, а не жалоба: сразу дай 4–6 упражнений с подходами и повторениями.
• Про боль говори только если клиент сам пишет, что болит. Тогда дай щадящий вариант и посоветуй врача при острой или долгой боли.
• Учитывай предыдущие сообщения: «план тренировки нужно» после вопроса про спину значит план с акцентом на спину.
• Если данных не хватает, задай один уточняющий вопрос, не больше.
• Можешь рекомендовать групповые занятия и тренеров сети из списка выше, если это уместно.`;
}

/* ---------- chat ---------- */

export async function askCoach(ctx: CoachContext, history: ChatMessage[], userText: string): Promise<string> {
  if (!hasApiKey()) return localAnswer(ctx, userText, history);

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.text }) as Anthropic.Beta.BetaMessageParam),
    { role: 'user', content: userText },
  ];

  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 2000, // chat replies are deliberately short
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: buildSystemPrompt(ctx), cache_control: { type: 'ephemeral' } }],
    messages,
  });

  if (response.stop_reason === 'refusal') {
    return 'Я не могу помочь с этим вопросом. Давайте вернёмся к тренировкам: спросите про план, технику или питание.';
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return text || 'Не получилось сформулировать ответ, попробуйте переспросить.';
}

/* ---------- weekly plan ---------- */

const planSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'days', 'nutrition'],
  properties: {
    title: { type: 'string', description: 'Короткое название плана, до 40 символов' },
    summary: { type: 'string', description: '2–3 предложения: логика плана под цель и уровень' },
    days: {
      type: 'array',
      minItems: 2,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'focus', 'durationMin', 'warmup', 'exercises', 'cooldown'],
        properties: {
          day: { type: 'string', description: 'Например «День 1 · Пн»' },
          focus: { type: 'string', description: 'Например «Ноги и ягодицы» или «Кардио + кор»' },
          durationMin: { type: 'integer' },
          warmup: { type: 'string' },
          exercises: {
            type: 'array',
            minItems: 3,
            maxItems: 8,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'sets', 'reps'],
              properties: {
                name: { type: 'string' },
                sets: { type: 'string', description: 'Например «3»' },
                reps: { type: 'string', description: 'Например «8–10» или «30 сек»' },
                rest: { type: 'string' },
                note: { type: 'string', description: 'Короткая подсказка по технике или весу' },
              },
            },
          },
          cooldown: { type: 'string' },
        },
      },
    },
    nutrition: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
  },
} as const;

export async function generatePlan(ctx: CoachContext, wish?: string): Promise<WeekPlan> {
  if (!hasApiKey()) return localPlan(ctx, wish);

  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 6000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: planSchema as unknown as Record<string, unknown> } },
    system: [{ type: 'text', text: buildSystemPrompt(ctx), cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Составь план тренировок на неделю: ровно ${ctx.profile.daysPerWeek} тренировочных дней. ${wish ? `Пожелание клиента: ${wish}. ` : ''}Используй оборудование обычного фитнес-клуба. Где возможно, называй упражнения из списка приложения. Для уровня «${levelTitle(ctx.profile.level)}» подбери адекватную сложность. Ответь строго в формате JSON по схеме.`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') return localPlan(ctx, wish);
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = JSON.parse(text) as Omit<WeekPlan, 'createdAt' | 'source'>;
  if (!Array.isArray(parsed.days) || parsed.days.length === 0) return localPlan(ctx, wish);
  return { ...parsed, createdAt: new Date().toISOString(), source: 'ai' };
}

/* ---------- local fallback (works without an API key) ---------- */

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function ex(id: string, sets: string, reps: string, rest?: string, note?: string): PlanExercise {
  const e = exercises.find((x) => x.id === id);
  return { name: e?.name ?? id, sets, reps, rest, note: note ?? e?.tip };
}

function pickDays(n: number): number[] {
  const map: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
  return map[Math.min(6, Math.max(2, n))];
}

export function localPlan(ctx: CoachContext, wish?: string): WeekPlan {
  const { goal, level, daysPerWeek } = ctx.profile;
  const beginner = level === 'beginner';
  const squat = beginner ? 'goblet-squat' : 'squat';
  const press = beginner ? 'db-press' : 'bench';
  const pull = beginner ? 'lat-pulldown' : 'pullup';
  const hinge = beginner ? 'rdl' : 'deadlift';
  const strengthReps = goal === 'strength' ? '5' : goal === 'gain' ? '8–10' : '10–12';
  const rest = goal === 'strength' ? '2–3 мин' : goal === 'gain' ? '90 сек' : '60 сек';

  const lower = (): PlanExercise[] => [ex(squat, '4', strengthReps, rest), ex(hinge, '3', strengthReps, rest), ex('hip-thrust', '3', '10–12', '60 сек'), ex('lunge', '3', '10 на ногу', '60 сек'), ex('plank', '3', '40 сек', '30 сек')];
  const upper = (): PlanExercise[] => [ex(press, '4', strengthReps, rest), ex(pull, '4', beginner ? '10–12' : '6–8', rest), ex('ohp', '3', '10', '60 сек'), ex('row', '3', '10 на руку', '60 сек'), ex('pushup', '2', 'до отказа', '60 сек')];
  const fullBody = (): PlanExercise[] => [ex(squat, '3', '10–12', '60 сек'), ex(press, '3', '10–12', '60 сек'), ex(pull, '3', '10–12', '60 сек'), ex('rdl', '3', '12', '60 сек'), ex('plank', '3', '30–45 сек', '30 сек')];
  const circuit = (): PlanExercise[] => [ex('kb-swing', '4', '15', '30 сек'), ex('goblet-squat', '4', '12', '30 сек'), ex('pushup', '4', '10–12', '30 сек'), ex('row', '4', '12 на руку', '30 сек'), ex('burpee', '4', '8', '60 сек', 'Круг без отдыха между упражнениями, отдых после круга.')];
  const cardio = (): PlanExercise[] => [ex('bike-intervals', '1', '8–10 интервалов', undefined), ex('walk-incline', '1', '20 мин', undefined), ex('plank', '3', '40 сек', '30 сек')];
  const steady = (): PlanExercise[] => [ex('rower', '1', '15 мин', undefined), ex('walk-incline', '1', '30 мин', undefined), ex('mobility', '1', '10 мин', undefined)];
  const mobility = (): PlanExercise[] => [ex('mobility', '1', '20 мин', undefined), ex('plank', '3', '30 сек', '30 сек'), ex('goblet-squat', '2', '12', '60 сек', 'Лёгкий вес, работаем на амплитуду.')];

  let sequence: { focus: string; make: () => PlanExercise[]; min: number }[];
  switch (goal) {
    case 'lose':
      sequence = [
        { focus: 'Силовая на всё тело', make: fullBody, min: 55 },
        { focus: 'Интервальное кардио', make: cardio, min: 40 },
        { focus: 'Круговая тренировка', make: circuit, min: 45 },
        { focus: 'Низ тела', make: lower, min: 55 },
        { focus: 'Спокойное кардио', make: steady, min: 50 },
        { focus: 'Верх тела', make: upper, min: 50 },
      ];
      break;
    case 'gain':
    case 'strength':
      sequence = [
        { focus: 'Низ тела', make: lower, min: 65 },
        { focus: 'Верх тела', make: upper, min: 60 },
        { focus: 'Ноги и ягодицы', make: lower, min: 65 },
        { focus: 'Грудь, спина, плечи', make: upper, min: 60 },
        { focus: 'Всё тело, лёгкий день', make: fullBody, min: 50 },
        { focus: 'Мобильность', make: mobility, min: 35 },
      ];
      break;
    case 'flex':
      sequence = [
        { focus: 'Мобильность и кор', make: mobility, min: 40 },
        { focus: 'Лёгкая силовая', make: fullBody, min: 45 },
        { focus: 'Спокойное кардио и растяжка', make: steady, min: 45 },
        { focus: 'Мобильность и кор', make: mobility, min: 40 },
        { focus: 'Лёгкая силовая', make: fullBody, min: 45 },
        { focus: 'Растяжка', make: mobility, min: 30 },
      ];
      break;
    default:
      sequence = [
        { focus: 'Силовая на всё тело', make: fullBody, min: 55 },
        { focus: 'Кардио и кор', make: cardio, min: 40 },
        { focus: 'Верх тела', make: upper, min: 55 },
        { focus: 'Низ тела', make: lower, min: 55 },
        { focus: 'Круговая', make: circuit, min: 45 },
        { focus: 'Мобильность', make: mobility, min: 35 },
      ];
  }

  const wishAreas = areasIn(wish ?? '');
  const dayIdx = pickDays(daysPerWeek);
  const days: PlanDay[] = dayIdx.map((wd, i) => {
    const s = sequence[i];
    return {
      day: `День ${i + 1} · ${weekdays[wd]}`,
      focus: s.focus,
      durationMin: s.min,
      warmup: '5–7 минут: лёгкое кардио и суставная разминка, 1–2 разминочных подхода с лёгким весом.',
      exercises: focusDay(s.make(), wishAreas, level, i),
      cooldown: '5 минут спокойной ходьбы и растяжка рабочих мышц.',
    };
  });

  const g = goalByKey(goal);
  const targets = dailyTargets({ ...ctx.profile, weightKg: ctx.currentWeightKg });
  const dry = wish?.toLowerCase().includes('сух') || wish?.toLowerCase().includes('рельеф');
  return {
    title: dry ? 'Сухое тело: сила + дефицит' : wishAreas.length ? `${g.title} + акцент на ${areaFocusLabel(wishAreas)}` : `${g.title}: ${daysPerWeek} дня в неделю`,
    summary: `${g.tip} План рассчитан на уровень «${levelTitle(level)}» и ${daysPerWeek} тренировок в неделю. Каждую неделю добавляйте 1 повторение или 2,5 кг там, где техника уверенная.${wishAreas.length ? ` В каждый день добавлены упражнения на ${areaFocusLabel(wishAreas)}.` : ''}${dry ? ' Для сухого тела держим силовые тяжёлыми, а жир убираем питанием и кардио.' : ''}`,
    days,
    nutrition: [
      `Калорийность около ${targets.calories} ккал в день, белок ${targets.protein} г.`,
      `Вода ${targets.water} л, овощи в каждый приём пищи.`,
      goal === 'lose' || dry ? 'Углеводы преимущественно вокруг тренировки, вечером белок и овощи.' : 'Порция белка каждые 3–4 часа, углеводы до и после тренировки.',
      'Сон 7–9 часов: без него ни жир не уходит, ни мышцы не растут.',
    ],
    createdAt: new Date().toISOString(),
    source: 'local',
  };
}

function formatTechnique(e: Exercise): string {
  return [
    `${e.name} (${e.muscles.join(', ')}; ${e.equipment}).`,
    ...e.steps.map((s, i) => `${i + 1}. ${s}`),
    `Частые ошибки: ${e.mistakes.join('; ').toLowerCase()}.`,
    `Совет: ${e.tip}`,
  ].join('\n');
}

/* ---------- offline understanding ---------- */

export type BodyArea = 'back' | 'legs' | 'glutes' | 'abs' | 'chest' | 'shoulders' | 'arms';

const areaPatterns: Record<BodyArea, RegExp> = {
  back: /спин|поясниц|осанк|сутул|широчайш|back|posture|арқа|бел(і|ім)/,
  legs: /ног(а|и|у|ам|ах)?\b|бедр|икр|квадрицепс|legs?\b|аяқ/,
  glutes: /ягодиц|попу|попа|glute|бөксе/,
  abs: /пресс|живот|кор\b|кубик|abs\b|core|іш/,
  chest: /груд|chest|кеуде/,
  shoulders: /плеч|дельт|shoulder|иық/,
  arms: /рук(и|у|ам)?\b|бицепс|трицепс|arms?\b|қол/,
};

const areaTitles: Record<BodyArea, string> = {
  back: 'спины',
  legs: 'ног',
  glutes: 'ягодиц',
  abs: 'пресса и кора',
  chest: 'груди',
  shoulders: 'плеч',
  arms: 'рук',
};

/** Exercises per area: [beginner-safe list, extra for intermediate/advanced]. */
const areaRoutines: Record<BodyArea, { base: string[]; strong: string[] }> = {
  back: { base: ['seated-row', 'lat-pulldown', 'hyperextension', 'bird-dog', 'face-pull'], strong: ['pullup', 'row', 'rdl'] },
  legs: { base: ['goblet-squat', 'leg-press', 'lunge', 'rdl'], strong: ['squat', 'deadlift'] },
  glutes: { base: ['glute-bridge', 'hip-thrust', 'rdl', 'lunge'], strong: ['squat', 'kb-swing'] },
  abs: { base: ['plank', 'dead-bug', 'bird-dog'], strong: ['kb-swing', 'burpee'] },
  chest: { base: ['pushup', 'db-press'], strong: ['bench'] },
  shoulders: { base: ['ohp', 'face-pull'], strong: ['pushup'] },
  arms: { base: ['pushup', 'row', 'seated-row'], strong: ['pullup', 'db-press'] },
};

/** Accusative form for «акцент на …». */
const areaAcc: Record<BodyArea, string> = { back: 'спину', legs: 'ноги', glutes: 'ягодицы', abs: 'пресс и кор', chest: 'грудь', shoulders: 'плечи', arms: 'руки' };
export function areaFocusLabel(areas: BodyArea[]) {
  return areas.map((a) => areaAcc[a]).join(' и ');
}

const exById = (id: string) => exercises.find((e) => e.id === id);

export function areasIn(text: string): BodyArea[] {
  const q = normalize(text);
  return (Object.keys(areaPatterns) as BodyArea[]).filter((a) => areaPatterns[a].test(q));
}

function normalize(text: string) {
  return text.toLowerCase().replace(/ё/g, 'е');
}

const PAIN = /бол(ь|и|ит|ят|ело)|травм|ноет|ныть|защемл|грыж|протруз|сколиоз|hurt|pain|injur|ауыр/;
const PLAN = /план|программ|расписан|тренировки?\s+на\s+недел|plan\b|program|жоспар|бағдарлама/;
const STRENGTHEN = /укреп|накач|прокач|развить|развивать|сильн|подтян|нарастить|strengthen|build|tone|нығайт/;
const TECHNIQUE = /как (делать|правильно|выполнять)|техник|how to|қалай/;

/** A request to build a plan (not a question about an existing one). */
export function isPlanRequest(text: string): boolean {
  const q = normalize(text);
  if (!PLAN.test(q)) return false;
  // "что в моём плане" / "где план" is a question, everything else we treat as "make one"
  return !/где|что в|покажи мой|what'?s in|қайда/.test(q);
}

function areaRoutineText(ctx: CoachContext, areas: BodyArea[], pain: boolean): string {
  const strong = ctx.profile.level !== 'beginner' && !pain;
  const ids = [...new Set(areas.flatMap((a) => [...areaRoutines[a].base, ...(strong ? areaRoutines[a].strong : [])]))];
  const safe = pain ? ids.filter((id) => !['deadlift', 'squat', 'kb-swing', 'burpee', 'bench', 'pullup'].includes(id)) : ids;
  const list = safe.slice(0, 6).map((id) => exById(id)).filter((e): e is Exercise => !!e);
  const reps = ctx.profile.goal === 'strength' ? '4 × 6–8' : ctx.profile.goal === 'gain' ? '3–4 × 8–12' : '3 × 12–15';
  const title = areas.map((a) => areaTitles[a]).join(' и ');
  const lines = list.map((e) => `• ${e.name}: ${e.id === 'plank' || e.id === 'bird-dog' || e.id === 'dead-bug' ? '3 × 30–45 сек' : reps}`);
  const freq = ctx.profile.daysPerWeek >= 4 ? '2 раза в неделю' : '1–2 раза в неделю';
  const parts = [
    pain
      ? `Если спина или сустав уже болит, начните со щадящего комплекса для ${title} и без веса. Острая боль, онемение или боль дольше 2–3 недель повод сначала показаться врачу или физиотерапевту.`
      : `Комплекс для ${title} под ваш уровень «${levelName(ctx.profile.level)}», ${freq}:`,
    ...lines,
    areas.includes('back')
      ? 'Главное для спины: сильные ягодицы и кор, ровная поясница во всех тягах, разминка 5–7 минут перед тренировкой.'
      : 'Добавляйте вес или повторения, когда последние 2 повторения даются уверенно.',
    'Нажмите на любое упражнение из этого списка в плане, и я покажу технику. Хотите, соберу неделю с упором на эту зону: напишите «составь план».',
  ];
  return parts.join('\n');
}

function levelName(l: FitnessProfile['level']) {
  return levels.find((x) => x.key === l)?.title ?? l;
}

export function localAnswer(ctx: CoachContext, question: string, history: ChatMessage[] = []): string {
  const q = normalize(question);
  const g = goalByKey(ctx.profile.goal);
  const targets = dailyTargets({ ...ctx.profile, weightKg: ctx.currentWeightKg });
  const areas = areasIn(q);
  const pain = PAIN.test(q);

  // 1) Body area: "укрепить спину", "болит поясница", "что делать для пресса"
  if (areas.length) return areaRoutineText(ctx, areas, pain);

  // 2) Pain without an area: ask where, don't guess
  if (pain) {
    return 'Через боль тренироваться нельзя. Напишите, что именно болит: спина, колено, плечо или другое, и я подберу щадящие упражнения. Если боль острая, есть онемение или она держится дольше 2–3 недель, сначала покажитесь врачу.';
  }

  // 3) Technique of a known exercise
  const exercise = findExercise(q);
  if (exercise && (TECHNIQUE.test(q) || q.length < 40)) return formatTechnique(exercise);

  // 4) "strengthen" without area: use the last area mentioned in the conversation
  if (STRENGTHEN.test(q)) {
    const recent = history.slice(-6).reverse().flatMap((m) => (m.role === 'user' ? areasIn(m.text) : []));
    if (recent.length) return areaRoutineText(ctx, [recent[0]], false);
    return 'Какую зону хотите укрепить: спину, ноги, ягодицы, пресс, грудь, плечи или руки? Подберу 4–6 упражнений под ваш уровень.';
  }

  if (/калори|питани|\bесть\b|\bеда|белок|диет|ужин|завтрак|перекус|nutrition|diet|protein|тамақ/.test(q)) {
    return `Ориентир для цели «${g.title}»: ${targets.calories} ккал и ${targets.protein} г белка в день, вода ${targets.water} л.\n• Белок в каждом приёме пищи: мясо, рыба, яйца, творог, протеин.\n• После тренировки в течение 1–2 часов: белок 25–40 г и углеводы, например курица с рисом или протеин с бананом.\n• ${g.tip}`;
  }
  if (/сух|рельеф|жир|lean|cut/.test(q)) {
    return `Сухое тело = сохраняем мышцы, убираем жир.\n• Силовые 3 раза в неделю с тяжёлыми базовыми упражнениями, повторения 6–10.\n• Дефицит 300–400 ккал: для вас около ${Math.round((targets.calories - (ctx.profile.goal === 'lose' ? 0 : 400)) / 10) * 10} ккал.\n• Белок ${Math.round(ctx.currentWeightKg * 2)} г в день.\n• 2 кардио по 30–40 минут или интервалы.\nНапишите «составь план для сухого тела», и я перестрою неделю.`;
  }
  if (/вес|похуд|набра|прогресс|плато|weight|progress/.test(q)) {
    const trend = ctx.weightTrend;
    const delta = trend.length > 1 ? (trend[trend.length - 1].kg - trend[0].kg).toFixed(1) : '0';
    return `Сейчас ${ctx.currentWeightKg} кг, за период наблюдения изменение ${delta} кг.${ctx.profile.targetWeightKg ? ` До цели ${Math.abs(ctx.currentWeightKg - ctx.profile.targetWeightKg).toFixed(1)} кг.` : ''}\n• Здоровый темп: 0,3–0,7 кг в неделю.\n• Прогресс в зале: каждую неделю +1 повторение или +2,5 кг в базовых упражнениях.\n• Сон 7–9 часов и белок ${targets.protein} г в день.\n• ${g.tip}`;
  }
  if (/разминк|заминк|растяж|warm|stretch/.test(q)) {
    const m = exById('mobility')!;
    return `Разминка: 5–7 минут лёгкого кардио и суставная гимнастика, затем 1–2 подхода первого упражнения с лёгким весом.\nЗаминка:\n${m.steps.map((s) => `• ${s}`).join('\n')}`;
  }
  if (/привет|здравств|салем|сәлем|\bhi\b|hello/.test(q)) {
    return `Привет, ${ctx.name}! Вижу цель «${g.title}», вес ${ctx.currentWeightKg} кг и ${ctx.profile.daysPerWeek} тренировки в неделю. Могу составить план, подобрать упражнения для любой зоны (например «укрепить спину») или объяснить технику.`;
  }
  if (exercise) return formatTechnique(exercise);
  return `Уточните, что нужно, и я помогу:\n• «Составь план на неделю»\n• «Упражнения для спины» (или ног, пресса, ягодиц)\n• «Как делать становую тягу»\n• «Что есть после тренировки»\nВаша цель «${g.title}»: ${g.tip}`;
}

/** Areas the user has been talking about recently, used to focus a generated plan. */
export function recentAreas(history: ChatMessage[], current = ''): BodyArea[] {
  const now = areasIn(current);
  if (now.length) return now;
  for (const m of [...history].reverse().slice(0, 8)) if (m.role === 'user') {
    const a = areasIn(m.text);
    if (a.length) return a;
  }
  return [];
}

export function areaWish(areas: BodyArea[]): string {
  return areas.length ? `акцент на укрепление ${areas.map((a) => areaTitles[a]).join(' и ')}` : '';
}

/** Weave area-focused exercises into an existing local plan day. */
export function focusDay(exs: PlanExercise[], areas: BodyArea[], level: FitnessProfile['level'], dayIndex: number): PlanExercise[] {
  if (!areas.length) return exs;
  const pool = [...new Set(areas.flatMap((a) => [...areaRoutines[a].base, ...(level !== 'beginner' ? areaRoutines[a].strong : [])]))];
  const picks = [pool[(dayIndex * 2) % pool.length], pool[(dayIndex * 2 + 1) % pool.length]]
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .map((id) => exById(id))
    .filter((e): e is Exercise => !!e && !exs.some((x) => x.name === e.name));
  const added = picks.map((e) => ({ name: e.name, sets: '3', reps: ['plank', 'bird-dog', 'dead-bug'].includes(e.id) ? '30–45 сек' : '10–12', rest: '60 сек', note: e.tip }));
  // replace the last non-core exercise(s) so the session length stays the same
  return [...exs.slice(0, Math.max(2, exs.length - added.length)), ...added];
}

export const quickPrompts = ['Составь план на неделю', 'Хочу сухое тело', 'Как делать присед?', 'Что есть после тренировки?', 'Как ускорить прогресс?', 'Разминка перед силовой'];
