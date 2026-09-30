import Anthropic from '@anthropic-ai/sdk';

import { exercises, findExercise, type Exercise } from '@/data/exercises';
import { dailyTargets, goalByKey, levels, type FitnessProfile } from '@/data/fitness';
import { classTemplates, clubById, trainers } from '@/data/mock';
import { getLang, languageName, pluralForm } from '@/i18n';

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
  back: /спин|поясниц|осанк|сутул|широчайш|back|posture|арқа/,
  legs: /(^|[^а-яё])ног(и|у|ам|ах|ами)?([^а-яё]|$)|бедр|икр|квадрицепс|legs?([^a-z]|$)|аяқ/,
  glutes: /ягодиц|попу|попа|glute|бөксе/,
  abs: /пресс|живот|(^|[^а-яё])кор([^а-яё]|$)|кубик|abs([^a-z]|$)|core/,
  chest: /(^|[^а-яё])груд|chest|кеуде/,
  shoulders: /плеч|дельт|shoulder|иық/,
  arms: /(^|[^а-яё])рук(и|у|ам|ами)?([^а-яё]|$)|бицепс|трицепс|arms?([^a-z]|$)|қол/,
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
const PLAN = /план|программ|расписан|тренировки?\s+на\s+недел|plan|program|жоспар|бағдарлама/;
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

/* ---------- offline "thinking" answers ---------- */

type Topic = 'nutrition' | 'protein' | 'supplements' | 'recovery' | 'cardio' | 'progress' | 'frequency' | 'water' | 'motivation' | 'dry' | 'warmup' | 'greeting';

// JS `\b` treats Cyrillic as non-word characters, so stems are matched without it.
const topicPatterns: Record<Topic, RegExp> = {
  protein: /белк|белок|протеин(?!ов)|protein|ақуыз/,
  nutrition: /(^|[^а-яё])есть([^а-яё]|$)|ем |съесть|кушать|питани|рацион|еда|еды|меню|калори|диет|завтрак|обед|ужин|перекус|продукт|nutrition|diet|meal|food|eat|тамақ/,
  supplements: /креатин|bcaa|добавк|витамин|омега|гейнер|предтрен|спортпит|supplement|creatine/,
  recovery: /сон|спать|высып|восстанов|отдых|крепатур|болят мышцы|мышцы болят|устал|recover|sleep|rest day|демалыс|ұйқы/,
  cardio: /кардио|бег|бегать|дорожк|велосипед|сжечь|жир|пульс|cardio|run/,
  progress: /прогресс|плато|стоит вес|не расту|не худею|не уходит|результат|progress|plateau|stuck/,
  frequency: /сколько раз|как часто|сколько трен|каждый день|частота|how often|times a week/,
  water: /вод[аыу]|пить|water|hydrat|су ішу/,
  motivation: /мотивац|лень|не хочу|бросил|сорвал|motivat|lazy/,
  dry: /сух|рельеф|lean|cut|shred/,
  warmup: /разминк|заминк|растяж|warm.?up|stretch/,
  greeting: /^(привет|здравств|салем|сәлем|hi|hello)/,
};

function gramsFor(proteinG: number, per100: number) {
  return Math.max(50, Math.round(((proteinG / per100) * 100) / 10) * 10);
}

function proteinWhy(ctx: CoachContext) {
  const targets = dailyTargets({ ...ctx.profile, weightKg: ctx.currentWeightKg });
  const perKg = Math.round((targets.protein / ctx.currentWeightKg) * 10) / 10;
  return { targets, perKg };
}

/** A day of food that actually adds up to the user's protein target. */
function proteinDay(ctx: CoachContext): string {
  const { targets, perKg } = proteinWhy(ctx);
  const P = targets.protein;
  const b = Math.round(P * 0.25);
  const l = Math.round(P * 0.3);
  const s = Math.round(P * 0.15);
  const d = P - b - l - s;
  const eggs = Math.min(4, Math.max(2, Math.round((b * 0.5) / 6.3)));
  const cottage = gramsFor(b - eggs * 6.3, 17);
  const chicken = gramsFor(l, 23);
  const yogurt = gramsFor(s, 10);
  const fish = gramsFor(d, 20);
  const g = goalByKey(ctx.profile.goal);
  return [
    `Считаю под вас: ${ctx.currentWeightKg} кг × ${perKg} г/кг при цели «${g.title}» = около ${P} г белка в день. Проще всего набрать это за 4 приёма пищи примерно по ${Math.round(P / 4)} г:`,
    `• Завтрак (~${b} г): ${eggs} яйца и ${cottage} г творога 5%, плюс овсянка.`,
    `• Обед (~${l} г): ${chicken} г куриной грудки или говядины, рис или гречка, овощи.`,
    `• Перекус (~${s} г): ${yogurt} г греческого йогурта или порция протеина (24 г).`,
    `• Ужин (~${d} г): ${fish} г рыбы или курицы, овощи.`,
    `Калорийность дня держите около ${targets.calories} ккал: ${ctx.profile.goal === 'lose' ? 'гарнир в ужин можно убрать' : ctx.profile.goal === 'gain' ? 'добавьте к каждому приёму крупу и орехи' : 'гарнир оставляйте в обед, в ужин меньше'}.`,
    'Если сложно добирать едой, один шейк протеина в день закрывает 20–25% нормы.',
  ].join('\n');
}

function nutritionAnswer(ctx: CoachContext, q: string): string {
  const { targets } = proteinWhy(ctx);
  if (/после трен|after/.test(q)) {
    return `После тренировки в течение 1–2 часов нужны белок и углеводы. Для вас это примерно ${Math.round(targets.protein * 0.25)} г белка:\n• курица 150 г с рисом;\n• или творог 200 г с бананом;\n• или шейк протеина и фрукт.\nВода: выпейте 0,5 л в течение часа.`;
  }
  if (/до трен|перед трен|before/.test(q)) {
    return 'За 1,5–2 часа до тренировки: сложные углеводы и немного белка, например овсянка с йогуртом или рис с курицей. За 30–40 минут, если голодны: банан. Жирное и много клетчатки перед залом лучше не есть.';
  }
  return proteinDay(ctx);
}

/** One proactive hint based on the user's current state. */
function nudge(ctx: CoachContext): string | null {
  const t = ctx.weightTrend;
  if (ctx.visitsThisWeek < Math.min(2, ctx.profile.daysPerWeek)) return `Подсказка: на этой неделе у вас ${ctx.visitsThisWeek} из ${ctx.profile.daysPerWeek} тренировок. Запишитесь на занятие во вкладке «Занятия», так проще не пропустить.`;
  if (t.length >= 3) {
    const delta = t[t.length - 1].kg - t[t.length - 3].kg;
    if (ctx.profile.goal === 'lose' && delta >= 0) return 'Подсказка: вес за последние недели не снижается. Проверьте калорийность и добавьте 2 000 шагов в день.';
    if (ctx.profile.goal === 'gain' && delta <= 0) return 'Подсказка: вес не растёт. Добавьте 200–300 ккал в день, например орехи или второй шейк.';
  }
  return null;
}

function withNudge(ctx: CoachContext, text: string) {
  const n = nudge(ctx);
  return n ? `${text}\n\n${n}` : text;
}

function topicAnswer(ctx: CoachContext, topic: Topic, q: string): string | null {
  const g = goalByKey(ctx.profile.goal);
  const targets = dailyTargets({ ...ctx.profile, weightKg: ctx.currentWeightKg });
  switch (topic) {
    case 'protein':
    case 'nutrition':
      return nutritionAnswer(ctx, q);
    case 'supplements':
      return `Добавки только дополняют еду, но три действительно работают:\n• Креатин 3–5 г в день каждый день: сила и объём, безопасен для здоровых людей.\n• Протеин, если не добираете ${targets.protein} г белка едой.\n• Омега-3 и витамин D, если мало рыбы и солнца.\nBCAA при достаточном белке почти ничего не дают. Предтренировочные комплексы с кофеином не пейте после 17:00, иначе испортите сон. Всё это есть в магазине приложения.`;
    case 'recovery':
      return `Мышцы растут на отдыхе, а не в зале:\n• Сон 7–9 часов, это главный фактор.\n• Между тренировками одной группы мышц 48 часов.\n• Крепатура на 1–2 день нормальна: помогает лёгкая активность, прогулка, растяжка.\n• Если усталость держится неделю, сделайте разгрузочную неделю: те же упражнения с весом на 40% меньше.\nПри ${ctx.profile.daysPerWeek} тренировках в неделю оставляйте минимум один полный день отдыха подряд.`;
    case 'cardio':
      return `Для цели «${g.title}» кардио работает так:\n• ${ctx.profile.goal === 'lose' ? '3–4 раза по 30–45 минут, пульс 120–140, плюс 8 000+ шагов' : ctx.profile.goal === 'gain' ? '1–2 раза по 20–30 минут, чтобы не мешать набору' : '2 раза по 30 минут'}.\n• Интервалы (30 сек быстро / 90 сек спокойно) эффективнее по времени, но не чаще 2 раз в неделю.\n• Кардио лучше после силовой или в отдельный день.\nЖир уходит в первую очередь от питания: держите ${targets.calories} ккал.`;
    case 'progress':
      return `Разберём, почему прогресс может стоять:\n1. Нагрузка не растёт: каждую неделю +1 повтор или +2,5 кг.\n2. Питание: ${ctx.profile.goal === 'gain' ? 'для набора нужен профицит, а не норма' : `калорийность ${targets.calories} ккал и белок ${targets.protein} г`}.\n3. Сон меньше 7 часов тормозит всё.\n4. Регулярность: у вас ${ctx.visitsThisWeek} ${pluralForm('ru', ctx.visitsThisWeek, 'workouts_pl')} на этой неделе при плане ${ctx.profile.daysPerWeek}.\nНачните с того пункта, где слабее всего.`;
    case 'frequency':
      return `Для вашего уровня «${levelName(ctx.profile.level)}» и цели «${g.title}» оптимально ${ctx.profile.level === 'beginner' ? '3' : '3–5'} тренировок в неделю. Каждую группу мышц тренируйте 2 раза в неделю. Вы указали ${ctx.profile.daysPerWeek}, это ${ctx.profile.daysPerWeek >= 3 ? 'хорошая частота' : 'маловато для заметного результата, попробуйте 3'}.`;
    case 'water':
      return `Ваша норма воды около ${targets.water} л в день (33 мл на кг). В дни тренировок добавьте ещё 0,5–1 л. Признак, что пьёте достаточно: светлая моча и нет жажды во время тренировки.`;
    case 'motivation':
      return `Мотивация приходит после действия, а не до него. Что помогает:\n• Записаться на занятие заранее: пропускать сложнее.\n• Маленькая цель на неделю: ${ctx.profile.daysPerWeek} тренировки, не больше.\n• Смотреть на прогресс: график веса и посещений в разделе «Прогресс».\n• Правило двух дней: можно пропустить один день, но не два подряд.`;
    case 'dry':
      return `Сухое тело = сохраняем мышцы, убираем жир.\n• Силовые 3 раза в неделю с тяжёлыми базовыми упражнениями, повторения 6–10.\n• Дефицит 300–400 ккал: для вас около ${Math.round((targets.calories - (ctx.profile.goal === 'lose' ? 0 : 400)) / 10) * 10} ккал.\n• Белок ${Math.round(ctx.currentWeightKg * 2)} г в день.\n• 2 кардио по 30–40 минут или интервалы.\nНапишите «составь план для сухого тела», и я перестрою неделю.`;
    case 'warmup': {
      const m = exById('mobility')!;
      return `Разминка: 5–7 минут лёгкого кардио и суставная гимнастика, затем 1–2 подхода первого упражнения с лёгким весом.\nЗаминка:\n${m.steps.map((s) => `• ${s}`).join('\n')}`;
    }
    case 'greeting':
      return `Привет, ${ctx.name}! Вижу цель «${g.title}», вес ${ctx.currentWeightKg} кг и ${ctx.profile.daysPerWeek} тренировки в неделю. Спросите про питание, упражнения для любой зоны, технику или попросите составить план.`;
  }
  return null;
}

export function localAnswer(ctx: CoachContext, question: string, history: ChatMessage[] = []): string {
  const q = normalize(question);
  const areas = areasIn(q);
  const pain = PAIN.test(q);

  if (areas.length) return withNudge(ctx, areaRoutineText(ctx, areas, pain));
  if (pain) {
    return 'Через боль тренироваться нельзя. Напишите, что именно болит: спина, колено, плечо или другое, и я подберу щадящие упражнения. Если боль острая, есть онемение или она держится дольше 2–3 недель, сначала покажитесь врачу.';
  }

  const exercise = findExercise(q);
  if (exercise && TECHNIQUE.test(q)) return formatTechnique(exercise);

  // Pick the topic with the earliest match in the sentence; ties resolved by list order.
  const hits = (Object.keys(topicPatterns) as Topic[])
    .map((tp) => ({ tp, at: q.search(topicPatterns[tp]) }))
    .filter((h) => h.at >= 0)
    .sort((a, b) => a.at - b.at);
  // Protein beats generic nutrition when both appear.
  const topic = hits.find((h) => h.tp === 'protein')?.tp ?? hits[0]?.tp;
  if (topic) {
    const text = topicAnswer(ctx, topic, q);
    if (text) return topic === 'greeting' ? text : withNudge(ctx, text);
  }

  if (STRENGTHEN.test(q)) {
    const recent = history.slice(-6).reverse().flatMap((m) => (m.role === 'user' ? areasIn(m.text) : []));
    if (recent.length) return areaRoutineText(ctx, [recent[0]], false);
    return 'Какую зону хотите укрепить: спину, ноги, ягодицы, пресс, грудь, плечи или руки? Подберу 4–6 упражнений под ваш уровень.';
  }
  if (exercise) return formatTechnique(exercise);

  // Follow-up questions ("а сколько?", "а если...") inherit the previous topic.
  const prevUser = [...history].reverse().find((m) => m.role === 'user' && m.text !== question);
  if (prevUser && q.split(/\s+/).length <= 6) {
    const prev = normalize(prevUser.text);
    const prevTopic = (Object.keys(topicPatterns) as Topic[]).find((tp) => topicPatterns[tp].test(prev));
    if (prevTopic) {
      const text = topicAnswer(ctx, prevTopic, `${prev} ${q}`);
      if (text) return text;
    }
  }

  return `Не до конца понял вопрос. Я могу:\n• рассчитать питание и белок под ваш вес;\n• подобрать упражнения для спины, ног, пресса и других зон;\n• объяснить технику, например «как делать становую тягу»;\n• составить план на неделю.\nПереформулируйте, и я отвечу подробно.`;
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
