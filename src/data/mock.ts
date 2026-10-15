import type { ImageSourcePropType } from 'react-native';

import { getLang, monthNames, translate, weekdayNames } from '@/i18n';

export type Club = {
  id: string;
  name: string;
  city: string;
  address: string;
  hours: string;
  is24h: boolean;
  occupancy: number; // 0..100
  rating: number;
  reviews: number;
  distanceKm: number;
  phone: string;
  photos: string[];
  amenities: string[];
  description: string;
  areaM2: number;
  machines: number;
  hoursDetail: string[]; // [Пн–Пт, Сб, Вс]
  liked: string[]; // what clients praise
  reviewsList: { name: string; when: string; text: string; stars: number }[];
};

export type Trainer = {
  id: string;
  name: string;
  clubId: string;
  specialties: string[];
  rating: number;
  reviews: number;
  experienceYears: number;
  pricePerSession: number;
  phone?: string;
  photo?: ImageSourcePropType;
  services?: string[]; // what the trainer helps with
  experience?: string;
  why?: string[]; // reasons to train with this trainer
  ages?: string; // client age range
  schedule?: string; // working days and hours
  bio: string; // qualifications, one per line
  pro?: boolean;
  audience: string;
};

export type Category = 'Йога' | 'Сила' | 'Кардио' | 'Бокс' | 'Танцы' | 'Аква' | 'Растяжка';

export type ClassTemplate = {
  id: string;
  title: string;
  category: Category;
  clubId: string;
  trainerId: string;
  time: string; // HH:mm
  durationMin: number;
  weekdays: number[]; // 0=Sun..6=Sat
  capacity: number;
  level: 'Все уровни' | 'Начальный' | 'Средний' | 'Продвинутый';
  room: string;
  description: string;
  color: string;
};

export type ClassSession = ClassTemplate & {
  sessionId: string;
  date: string; // YYYY-MM-DD
  booked: number;
};

export type Plan = {
  id: string;
  name: string;
  months: number;
  price: number;
  oldPrice?: number;
  perMonth: number;
  features: string[];
  popular?: boolean;
  dayOnly?: boolean;
  trial?: boolean; // free trial, hidden from the price list; 3 days
  days?: number; // fixed-length pass instead of months
  staffOnly?: boolean; // issued only at the front desk
  legacy?: boolean; // hidden from sale but still shown on members
  visits?: number; // visits included; unset = unlimited
  freezeDays?: number; // total freeze days given with the plan
};

export type NewsItem = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  date: string;
  body: string;
};

export const clubs: Club[] = [
  {
    id: 'c1',
    name: 'Seven Gym Akkent',
    city: 'Алматы',
    address: 'ул. Ш. Болтекулы, 1, 3 этаж',
    hours: '07:00 – 23:00',
    is24h: false,
    occupancy: 62,
    rating: 4.8,
    reviews: 1240,
    distanceKm: 1.2,
    phone: '+7 705 555 39 32',
    photos: [
      'https://images.unsplash.com/photo-1671970922029-0430d2ae122c?w=1200&q=80',
      'https://images.unsplash.com/photo-1597076537061-a6b58163aa45?w=1200&q=80',
      'https://images.unsplash.com/photo-1597076545399-91a3ff0e71b3?w=1200&q=80',
    ],
    amenities: ['Тренажёрный зал', 'Бассейн 25 м', 'Сауна и хаммам', 'Групповые залы', 'Кроссфит-зона', 'Парковка', 'Детская комната'],
    description: 'Тренажёрный зал Seven Gym Akkent.',
    areaM2: 4500,
    machines: 190,
    hoursDetail: ['07:00–23:00', '07:00–23:00', '07:00–23:00'],
    liked: ['Хороший набор тренажёров', 'Чистые раздевалки', 'Персонал на высшем уровне'],
    reviewsList: [{ name: 'Айдос Т.', when: '2 недели назад', text: 'Отличный зал, утром нет очередей на снаряды. Чисто, прохладно, душ всегда в порядке.', stars: 5 }, { name: 'Мария К.', when: '1 месяц назад', text: 'Супер персонал на рецепции, помогли с заморозкой за минуту. Бассейн чистый.', stars: 5 }, { name: 'Ерлан С.', when: '2 месяца назад', text: 'Много свободных весов и платформ, не нужно ждать. Паркинг вечером забит.', stars: 4 }],
  },
  {
    id: 'c2',
    name: 'Seven Gym Premier',
    city: 'Алматы',
    address: 'ул. Жуалы, 155, 2 этаж',
    hours: '07:00 – 23:00',
    is24h: false,
    occupancy: 38,
    rating: 4.9,
    reviews: 860,
    distanceKm: 4.7,
    phone: '+7 705 555 39 32',
    photos: [
      'https://images.unsplash.com/photo-1559369064-c4d65141e408?w=1200&q=80',
      'https://images.unsplash.com/photo-1758448756350-3d0eec02ba37?w=1200&q=80',
    ],
    amenities: ['Тренажёрный зал', 'Йога-студия', 'Сайкл-студия', 'Сауна', 'Фитнес-бар', 'Парковка'],
    description: 'Тренажёрный зал Seven Gym Premier.',
    areaM2: 2300,
    machines: 150,
    hoursDetail: ['07:00–23:00', '07:00–23:00', '07:00–23:00'],
    liked: ['Вид на горы', 'Новое оборудование', 'Тихо по утрам'],
    reviewsList: [{ name: 'Динара А.', when: '3 недели назад', text: 'Йога-студия с панорамой на Алатау, это лучшее утро в Алматы.', stars: 5 }, { name: 'Timur B.', when: '1 месяц назад', text: 'Премиальный уровень, сайкл-студия как в Европе.', stars: 5 }],
  },
];

export const trainers: Trainer[] = [
  {
    id: 't1',
    name: 'Буенбаев Аскар Адилханович',
    clubId: '', // works in both clubs
    specialties: ['Снижение веса', 'Набор массы', 'ЛФК', 'Функциональный тренинг', 'ОФП'],
    rating: 0,
    reviews: 0,
    experienceYears: 0,
    pricePerSession: 28000,
    photo: require('../../assets/images/trainers/askar.jpg'),
    phone: '+7 775 286 5723',
    bio: 'Фитнес-тренер клуба\nДипломированный и сертифицированный фитнес-тренер',
    services: [
      'Индивидуальные занятия для мужчин и женщин',
      'Снижение лишнего веса',
      'Набор мышечной массы',
      'ЛФК (лечебная физкультура)',
      'Функциональный тренинг',
      'ОФП',
      'Построение красивого и атлетичного тела',
    ],
    experience: 'Тренерский стаж 8 лет',
    ages: 'Девушки от 12 до 60 лет • Мужчины от 8 до 60 лет',
    audience: '',
  },
  {
    id: 't2',
    name: 'Мамыт Ерсін',
    clubId: '', // works in both clubs
    specialties: ['Снижение веса', 'Набор массы', 'Вольная борьба', 'Пауэрлифтинг', 'Жим лёжа'],
    rating: 0,
    reviews: 0,
    experienceYears: 0,
    pricePerSession: 25000,
    photo: require('../../assets/images/trainers/ersin.jpg'),
    phone: '+7 747 038 5849',
    bio: 'Профессиональный фитнес-тренер\nКМС по вольной борьбе\nМС по пауэрлифтингу и жиму лёжа',
    services: [
      'Снижение веса и сжигание жира',
      'Набор мышечной массы',
      'Развитие силы и выносливости',
      'Коррекция фигуры',
      'Развитие физических качеств',
      'Составление индивидуальных программ тренировок',
    ],
    why: [
      'Индивидуальный подход к каждому клиенту',
      'Индивидуальная программа под ваши цели',
      'Контроль техники выполнения упражнений',
      'Постепенное увеличение нагрузок',
      'Контроль прогресса и результата',
    ],
    experience: 'Стаж работы более 7 лет',
    audience: '',
  },
  {
    id: 't3',
    name: 'Повчун Никита',
    clubId: '', // works in both clubs
    specialties: ['Жим лёжа', 'Армрестлинг', 'Снижение веса', 'Набор массы'],
    rating: 0,
    reviews: 0,
    experienceYears: 0,
    pricePerSession: 25000,
    photo: require('../../assets/images/trainers/nikita.jpg'),
    phone: '+7 747 255 55 08',
    bio: 'МС по жиму лёжа (WRPF, WPC, НАП)\nМС по жиму лёжа в софт экипировке\nМСМК по подъёму на бицепс\nКМС по армрестлингу\nКМС по дзюдо',
    services: [
      'Снижение веса и коррекция фигуры',
      'Набор мышечной массы и развитие силовых показателей',
      'Индивидуальные программы тренировок с учётом целей и физической подготовки',
      'Подготовка к соревнованиям',
      'Подготовка к сдаче спортивных нормативов',
      'ЛФК',
      'Развитие силы, выносливости, гибкости и общей физической подготовки',
      'Работа с мужчинами и женщинами любого возраста и уровня подготовки',
    ],
    experience: 'Более 20 лет личного тренировочного стажа и более 10 лет тренерской практики',
    audience: '',
  },
];

export const classTemplates: ClassTemplate[] = [];

export const plans: Plan[] = [
  { id: 'trial', name: 'Пробный', months: 0, price: 0, perMonth: 0, features: ['3 дня тренировок', 'Без обязательств', 'Можно без тренера'], trial: true, days: 3 },
  { id: 'guest', name: 'Гостевой', months: 0, days: 1, price: 0, perMonth: 0, features: ['Разовый вход на сегодня'], trial: true, staffOnly: true },
  { id: 'i9', name: 'Разовая тренировка', months: 0, days: 1, price: 3500, perMonth: 3500, visits: 1, features: ['1 посещение','Срок: 1 день'] },
  { id: 'i3', name: 'Дневной абонемент 12 посещений', months: 1, days: 31, price: 15000, perMonth: 15000, visits: 12, freezeDays: 5, dayOnly: true, features: ['12 посещений','Срок: 31 дн.','Вход с 07:00 до 17:00','Заморозка: 1 раз, 5 дн.'] },
  { id: 'i4', name: 'Дневной абонемент Безлимитный', months: 1, days: 31, price: 17000, perMonth: 17000, freezeDays: 5, dayOnly: true, features: ['Безлимит','Срок: 31 дн.','Вход с 07:00 до 17:00','Заморозка: 1 раз, 5 дн.'] },
  { id: 'i1', name: 'Полный день 12 посещений', months: 1, days: 31, price: 17000, perMonth: 17000, visits: 12, freezeDays: 5, features: ['12 посещений','Срок: 31 дн.','Заморозка: 1 раз, 5 дн.'] },
  { id: 'i2', name: 'Полный день Безлимитный', months: 1, days: 31, price: 19000, perMonth: 19000, freezeDays: 5, features: ['Безлимит','Срок: 31 дн.','Заморозка: 1 раз, 5 дн.'] },
  { id: 'i5', name: 'Абонемент безлимитный', months: 1, days: 31, price: 19000, perMonth: 19000, freezeDays: 5, features: ['Безлимит','Срок: 31 дн.','Заморозка: 1 раз, 5 дн.'] },
  { id: 'i6', name: '3 Месяца Безлимитный', months: 3, days: 90, price: 50000, perMonth: 16667, freezeDays: 7, features: ['Безлимит','Срок: 90 дн.','Заморозка: 1 раз, 7 дн.'] },
  { id: 'i7', name: '6 Месяцев Безлимитный', months: 6, days: 180, price: 90000, perMonth: 15000, freezeDays: 10, features: ['Безлимит','Срок: 180 дн.','Заморозка: 1 раз, 10 дн.'] },
  { id: 'i8', name: '12 Месяцев Безлимитный', months: 12, days: 365, price: 170000, perMonth: 14167, freezeDays: 14, features: ['Безлимит','Срок: 365 дн.','Заморозка: 2 раза по 7 дн.'] },
];

export const news: NewsItem[] = [
  {
    id: 'n1',
    title: 'Открытие клуба на Сейфуллина',
    subtitle: '15 октября • Алматы',
    image: 'https://images.unsplash.com/photo-1741156229623-da94e6d7977d?w=1200&q=80',
    date: '2026-09-25',
    body: 'Пятый клуб сети в Алматы откроется 15 октября. Действующим членам клуба — неделя бесплатных тренировок в новом зале и скидка 20% на продление.',
  },
  {
    id: 'n2',
    title: 'Марафон «30 дней силы»',
    subtitle: 'Старт 1 октября • Призы от партнёров',
    image: 'https://images.unsplash.com/photo-1607962837359-5e7e89f86776?w=1200&q=80',
    date: '2026-09-20',
    body: 'Отмечайте тренировки в приложении 30 дней подряд и получите месяц абонемента в подарок. Лучшие результаты — призы от партнёров.',
  },
  {
    id: 'n3',
    title: 'Новые групповые: Mobility Flow',
    subtitle: 'Каждый вторник и четверг',
    image: 'https://images.unsplash.com/photo-1758448756350-3d0eec02ba37?w=1200&q=80',
    date: '2026-09-12',
    body: 'Программа для суставов и мобильности, идеально сочетается с силовыми тренировками. Запись открыта в расписании.',
  },
];

export const categories: ('Все' | Category)[] = ['Все', 'Йога', 'Сила', 'Кардио', 'Бокс', 'Танцы', 'Аква', 'Растяжка'];

/* ---------- helpers ---------- */

/** Localized short names; read the current UI language from the i18n module. */
export const weekdayShort = {
  get: (i: number) => weekdayNames()[i],
};
export const monthShort = {
  get: (i: number) => monthNames()[i],
};

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateHuman(iso: string): string {
  const d = parseISODate(iso);
  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));
  const lang = getLang();
  if (iso === today) return translate(lang, 'today');
  if (iso === tomorrow) return translate(lang, 'tomorrow');
  return `${weekdayShort.get(d.getDay())}, ${d.getDate()} ${monthShort.get(d.getMonth())}`;
}

export function formatDateLong(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} ${monthShort.get(d.getMonth())} ${d.getFullYear()}`;
}

export function formatPrice(n: number): string {
  if (!n) return translate(getLang(), 'price_tba');
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;
}

function seededBooked(key: string, capacity: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % (capacity + 1);
}

export function sessionsForDate(iso: string): ClassSession[] {
  const weekday = parseISODate(iso).getDay();
  return classTemplates
    .filter((t) => t.weekdays.includes(weekday))
    .map((t) => ({ ...t, sessionId: `${t.id}_${iso}`, date: iso, booked: seededBooked(`${t.id}${iso}`, t.capacity) }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function sessionById(sessionId: string): ClassSession | undefined {
  const idx = sessionId.indexOf('_');
  if (idx < 0) return undefined;
  const templateId = sessionId.slice(0, idx);
  const date = sessionId.slice(idx + 1);
  return sessionsForDate(date).find((s) => s.id === templateId);
}

export function sessionStart(s: ClassSession): Date {
  const d = parseISODate(s.date);
  const [h, m] = s.time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function clubById(id: string) {
  return clubs.find((c) => c.id === id);
}

export function trainerById(id: string) {
  return trainers.find((t) => t.id === id);
}

/** "3 мес" for monthly plans, "1 день" for single visits. */
export function planLength(p: Plan): string {
  const lang = getLang();
  return p.months ? `${p.months} ${translate(lang, 'months_short')}` : translate(lang, 'days_n', { n: p.days ?? 1 });
}

export function planById(id: string) {
  return plans.find((p) => p.id === id);
}

export function occupancyLabel(p: number): { label: string; color: string } {
  const lang = getLang();
  if (p < 45) return { label: translate(lang, 'occ_free'), color: '#3DDC84' };
  if (p < 70) return { label: translate(lang, 'occ_mid'), color: '#FFB347' };
  return { label: translate(lang, 'occ_busy'), color: '#FF5C5C' };
}

/** Club hours with the 24/7 label localized. */
export function clubHours(c: Club): string {
  return c.is24h ? translate(getLang(), 'allday') : c.hours;
}
