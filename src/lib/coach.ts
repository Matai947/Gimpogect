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
• Если данных не хватает, задай один уточняющий вопрос, не больше.
• Можешь рекомендовать групповые занятия и тренеров сети из списка выше, если это уместно.`;
}

/* ---------- chat ---------- */

export async function askCoach(ctx: CoachContext, history: ChatMessage[], userText: string): Promise<string> {
  if (!hasApiKey()) return localAnswer(ctx, userText);

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

  const dayIdx = pickDays(daysPerWeek);
  const days: PlanDay[] = dayIdx.map((wd, i) => {
    const s = sequence[i];
    return {
      day: `День ${i + 1} · ${weekdays[wd]}`,
      focus: s.focus,
      durationMin: s.min,
      warmup: '5–7 минут: лёгкое кардио и суставная разминка, 1–2 разминочных подхода с лёгким весом.',
      exercises: s.make(),
      cooldown: '5 минут спокойной ходьбы и растяжка рабочих мышц.',
    };
  });

  const g = goalByKey(goal);
  const targets = dailyTargets({ ...ctx.profile, weightKg: ctx.currentWeightKg });
  const dry = wish?.toLowerCase().includes('сух') || wish?.toLowerCase().includes('рельеф');
  return {
    title: dry ? 'Сухое тело: сила + дефицит' : `${g.title}: ${daysPerWeek} дня в неделю`,
    summary: `${g.tip} План рассчитан на уровень «${levelTitle(level)}» и ${daysPerWeek} тренировок в неделю. Каждую неделю добавляйте 1 повторение или 2,5 кг там, где техника уверенная.${dry ? ' Для сухого тела держим силовые тяжёлыми, а жир убираем питанием и кардио.' : ''}`,
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

export function localAnswer(ctx: CoachContext, question: string): string {
  const q = question.toLowerCase();
  const g = goalByKey(ctx.profile.goal);
  const targets = dailyTargets({ ...ctx.profile, weightKg: ctx.currentWeightKg });

  const exercise = findExercise(q);
  if (exercise && /как|техник|правильно|делать|выполн/.test(q)) return formatTechnique(exercise);
  if (exercise) return formatTechnique(exercise);

  if (/калори|питани|есть|еда|белок|диет|ужин|завтрак/.test(q)) {
    return `Ориентир для цели «${g.title}»: ${targets.calories} ккал и ${targets.protein} г белка в день, вода ${targets.water} л.\n• Белок в каждом приёме пищи: мясо, рыба, яйца, творог, протеин.\n• Углеводы ставьте до и после тренировки.\n• ${g.tip}`;
  }
  if (/сух|рельеф|жир/.test(q)) {
    return `Сухое тело = сохраняем мышцы, убираем жир.\n• Силовые 3 раза в неделю с тяжёлыми базовыми упражнениями, повторения 6–10.\n• Дефицит 300–400 ккал: для вас около ${Math.round((targets.calories - (ctx.profile.goal === 'lose' ? 0 : 400)) / 10) * 10} ккал.\n• Белок ${Math.round(ctx.currentWeightKg * 2)} г в день.\n• 2 кардио по 30–40 минут или интервалы.\nНажмите «Обновить план» и напишите «сухое тело», я перестрою неделю.`;
  }
  if (/план|программ|недел/.test(q)) {
    return `План на неделю лежит во вкладке «План»: ${ctx.profile.daysPerWeek} тренировки под цель «${g.title}». Хотите его изменить, нажмите «Обновить план» и опишите пожелание, например «больше ног» или «без прыжков».`;
  }
  if (/вес|похуд|набра|прогресс/.test(q)) {
    const trend = ctx.weightTrend;
    const delta = trend.length > 1 ? (trend[trend.length - 1].kg - trend[0].kg).toFixed(1) : '0';
    return `Сейчас ${ctx.currentWeightKg} кг, за период наблюдения изменение ${delta} кг.${ctx.profile.targetWeightKg ? ` До цели ${Math.abs(ctx.currentWeightKg - ctx.profile.targetWeightKg).toFixed(1)} кг.` : ''}\n• Здоровый темп: 0,3–0,7 кг в неделю.\n• Взвешивайтесь утром натощак 2–3 раза в неделю и смотрите на среднее.\n• ${g.tip}`;
  }
  if (/боль|болит|травм|колен|спин|поясниц/.test(q)) {
    return 'При боли тренироваться через неё нельзя. Снизьте нагрузку, замените упражнение на безболезненный вариант и, если боль держится больше 2–3 дней, обратитесь к врачу или физиотерапевту. Я могу подобрать щадящий вариант тренировки, напишите, что именно болит.';
  }
  if (/разминк|заминк|растяж/.test(q)) {
    const m = exercises.find((e) => e.id === 'mobility')!;
    return `Разминка: 5–7 минут лёгкого кардио и суставная гимнастика, затем 1–2 подхода первого упражнения с лёгким весом.\nЗаминка:\n${m.steps.map((s) => `• ${s}`).join('\n')}`;
  }
  if (/привет|здравств|hi|hello/.test(q)) {
    return `Привет, ${ctx.name}! Я ваш ИИ-тренер. Вижу цель «${g.title}», вес ${ctx.currentWeightKg} кг и ${ctx.profile.daysPerWeek} тренировки в неделю. Спросите про план, технику упражнения или питание.`;
  }
  return `Я работаю в офлайн-режиме и лучше всего отвечаю на вопросы о технике упражнений (например «как делать присед»), питании, весе и плане на неделю. Ваша цель «${g.title}»: ${g.tip}`;
}

export const quickPrompts = ['Составь план на неделю', 'Хочу сухое тело', 'Как делать присед?', 'Что есть после тренировки?', 'Как ускорить прогресс?', 'Разминка перед силовой'];
