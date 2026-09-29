import type { Category } from '@/data/mock';

export type Goal = 'lose' | 'gain' | 'tone' | 'strength' | 'flex';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Gender = 'male' | 'female';

export type FitnessProfile = {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  goal: Goal;
  level: Level;
  daysPerWeek: number;
};

export const goals: { key: Goal; title: string; subtitle: string; icon: string; categories: Category[]; specialties: string[]; productIds: string[]; tip: string }[] = [
  {
    key: 'lose',
    title: 'Похудеть',
    subtitle: 'Сжечь жир и подтянуть тело',
    icon: 'flame-outline',
    categories: ['Кардио', 'Танцы', 'Аква'],
    specialties: ['Похудение', 'Кардио', 'Питание'],
    productIds: ['s2', 's12', 's9', 's14'],
    tip: 'Дефицит 300–500 ккал, 3–4 кардио и 2 силовые в неделю, шаги 8 000+ в день.',
  },
  {
    key: 'gain',
    title: 'Набрать массу',
    subtitle: 'Больше мышц и силы',
    icon: 'barbell-outline',
    categories: ['Сила'],
    specialties: ['Набор массы', 'Силовые', 'Кроссфит'],
    productIds: ['s4', 's1', 's5', 's13'],
    tip: 'Профицит 300 ккал, 1,8–2 г белка на кг веса, базовые упражнения 3–4 раза в неделю.',
  },
  {
    key: 'tone',
    title: 'Держать форму',
    subtitle: 'Тонус, рельеф и энергия',
    icon: 'fitness-outline',
    categories: ['Сила', 'Кардио', 'Растяжка'],
    specialties: ['Функциональный', 'Кардио', 'Силовые'],
    productIds: ['s1', 's10', 's12', 's16'],
    tip: 'Баланс: 2 силовые, 1–2 кардио и растяжка. Держите калорийность на уровне нормы.',
  },
  {
    key: 'strength',
    title: 'Стать сильнее',
    subtitle: 'Рост рабочих весов',
    icon: 'trophy-outline',
    categories: ['Сила', 'Бокс'],
    specialties: ['Силовые', 'Кроссфит', 'Бокс'],
    productIds: ['s5', 's7', 's1', 's17'],
    tip: 'Прогрессия нагрузки, 3–5 повторений в базовых движениях, отдых 48 часов между группами мышц.',
  },
  {
    key: 'flex',
    title: 'Гибкость и здоровье',
    subtitle: 'Осанка, суставы, спина',
    icon: 'leaf-outline',
    categories: ['Йога', 'Растяжка', 'Аква'],
    specialties: ['Йога', 'Пилатес', 'Растяжка'],
    productIds: ['s9', 's11', 's20', 's18'],
    tip: 'Йога или пилатес 2–3 раза в неделю, ежедневная растяжка 10 минут, омега-3 для суставов.',
  },
];

export const levels: { key: Level; title: string; subtitle: string }[] = [
  { key: 'beginner', title: 'Новичок', subtitle: 'Не тренировался или давно не занимался' },
  { key: 'intermediate', title: 'Средний', subtitle: 'Занимаюсь регулярно от полугода' },
  { key: 'advanced', title: 'Продвинутый', subtitle: 'Опыт больше 2 лет, знаю технику' },
];

export function goalByKey(key: Goal) {
  return goals.find((g) => g.key === key)!;
}

export function bmi(weightKg: number, heightCm: number) {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export function bmiLabel(v: number): { label: string; color: string } {
  if (v < 18.5) return { label: 'Ниже нормы', color: '#4DA3FF' };
  if (v < 25) return { label: 'Норма', color: '#3DDC84' };
  if (v < 30) return { label: 'Избыточный вес', color: '#FFB347' };
  return { label: 'Ожирение', color: '#FF5C5C' };
}

/** Mifflin–St Jeor BMR × activity factor, adjusted for the goal. */
export function dailyTargets(p: FitnessProfile) {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.gender === 'male' ? 5 : -161);
  const activity = p.daysPerWeek <= 2 ? 1.375 : p.daysPerWeek <= 4 ? 1.55 : 1.725;
  const maintenance = bmr * activity;
  const calories = p.goal === 'lose' ? maintenance - 400 : p.goal === 'gain' ? maintenance + 300 : maintenance;
  const proteinPerKg = p.goal === 'gain' || p.goal === 'strength' ? 1.9 : p.goal === 'lose' ? 1.7 : 1.5;
  const protein = p.weightKg * proteinPerKg;
  const water = p.weightKg * 0.033;
  return {
    calories: Math.round(calories / 10) * 10,
    protein: Math.round(protein),
    water: Math.round(water * 10) / 10,
  };
}
