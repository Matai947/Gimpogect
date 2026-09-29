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
  avatar: string;
  bio: string;
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
    name: 'Gym Project Достык',
    city: 'Алматы',
    address: 'пр. Достык, 97 (БЦ «Достык Плаза»)',
    hours: 'Круглосуточно',
    is24h: true,
    occupancy: 62,
    rating: 4.8,
    reviews: 1240,
    distanceKm: 1.2,
    phone: '+7 727 300 00 01',
    photos: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80',
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&q=80',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1200&q=80',
    ],
    amenities: ['Тренажёрный зал', 'Бассейн 25 м', 'Сауна и хаммам', 'Групповые залы', 'Кроссфит-зона', 'Парковка', 'Детская комната'],
    description:
      'Флагманский клуб сети площадью 4 500 м². Три этажа тренажёрных зон, 25-метровый бассейн, термальная зона и четыре зала групповых программ.',
  },
  {
    id: 'c2',
    name: 'Gym Project Esentai',
    city: 'Алматы',
    address: 'пр. Аль-Фараби, 77/8 (Esentai Mall)',
    hours: '06:00 – 24:00',
    is24h: false,
    occupancy: 38,
    rating: 4.9,
    reviews: 860,
    distanceKm: 4.7,
    phone: '+7 727 300 00 02',
    photos: [
      'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=1200&q=80',
      'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1200&q=80',
    ],
    amenities: ['Тренажёрный зал', 'Йога-студия', 'Сайкл-студия', 'Сауна', 'Фитнес-бар', 'Парковка'],
    description:
      'Премиальный клуб в Esentai Mall с панорамными окнами на горы. Отдельные студии йоги и сайкла, зона функционального тренинга.',
  },
  {
    id: 'c3',
    name: 'Gym Project Абая',
    city: 'Алматы',
    address: 'пр. Абая, 150/230',
    hours: '07:00 – 23:00',
    is24h: false,
    occupancy: 81,
    rating: 4.6,
    reviews: 530,
    distanceKm: 2.9,
    phone: '+7 727 300 00 03',
    photos: [
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80',
      'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80',
    ],
    amenities: ['Тренажёрный зал', 'Бокс-зона', 'Групповые залы', 'Сауна', 'Раздевалки с сейфами'],
    description:
      'Компактный клуб рядом с метро «Абая» с сильной боксёрской и силовой зоной. Идеален для тренировок до или после работы.',
  },
  {
    id: 'c4',
    name: 'Gym Project Astana Mega',
    city: 'Астана',
    address: 'ул. Коргалжын, 1 (ТРЦ «Mega Silk Way»)',
    hours: 'Круглосуточно',
    is24h: true,
    occupancy: 45,
    rating: 4.7,
    reviews: 710,
    distanceKm: 1180,
    phone: '+7 717 200 00 04',
    photos: [
      'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=1200&q=80',
      'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=1200&q=80',
    ],
    amenities: ['Тренажёрный зал', 'Бассейн', 'Кроссфит-зона', 'Групповые залы', 'Сауна', 'Парковка'],
    description: 'Самый большой клуб сети в столице: 5 000 м², бассейн, кроссфит-бокс и восемь групповых программ ежедневно.',
  },
];

export const trainers: Trainer[] = [
  {
    id: 't1',
    name: 'Айдар Сериков',
    clubId: 'c1',
    specialties: ['Силовые', 'Кроссфит', 'Набор массы'],
    rating: 4.9,
    reviews: 212,
    experienceYears: 8,
    pricePerSession: 12000,
    avatar: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400&q=80',
    bio: 'Мастер спорта по тяжёлой атлетике, сертифицированный тренер CrossFit L2. Помогаю выстроить технику базовых движений и безопасно прогрессировать в весах.',
  },
  {
    id: 't2',
    name: 'Динара Ахметова',
    clubId: 'c2',
    specialties: ['Йога', 'Пилатес', 'Растяжка'],
    rating: 5.0,
    reviews: 178,
    experienceYears: 10,
    pricePerSession: 10000,
    avatar: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400&q=80',
    bio: 'Преподаватель хатха- и виньяса-йоги (RYT-500). Работаю с осанкой, мобильностью и восстановлением после травм.',
  },
  {
    id: 't3',
    name: 'Руслан Бекжанов',
    clubId: 'c3',
    specialties: ['Бокс', 'Кикбоксинг', 'Функциональный'],
    rating: 4.8,
    reviews: 143,
    experienceYears: 12,
    pricePerSession: 11000,
    avatar: 'https://images.unsplash.com/photo-1583468982228-19f19164aee2?w=400&q=80',
    bio: 'КМС по боксу, чемпион Казахстана среди юниоров. Ставлю ударную технику с нуля и готовлю к любительским турнирам.',
  },
  {
    id: 't4',
    name: 'Алина Ким',
    clubId: 'c1',
    specialties: ['Похудение', 'Кардио', 'Питание'],
    rating: 4.9,
    reviews: 264,
    experienceYears: 6,
    pricePerSession: 10000,
    avatar: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=400&q=80',
    bio: 'Нутрициолог и персональный тренер. Составляю программу тренировок и питания под ваш ритм жизни, веду к результату без жёстких диет.',
  },
  {
    id: 't5',
    name: 'Ерлан Нурланов',
    clubId: 'c4',
    specialties: ['Плавание', 'Аква', 'Триатлон'],
    rating: 4.7,
    reviews: 96,
    experienceYears: 9,
    pricePerSession: 9000,
    avatar: 'https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=400&q=80',
    bio: 'Тренер по плаванию, действующий триатлет. Учу плавать взрослых с нуля и ставлю технику кроля для стайеров.',
  },
  {
    id: 't6',
    name: 'Мадина Оспанова',
    clubId: 'c2',
    specialties: ['Танцы', 'Zumba', 'Сайкл'],
    rating: 4.8,
    reviews: 121,
    experienceYears: 5,
    pricePerSession: 8000,
    avatar: 'https://images.unsplash.com/photo-1609899537878-88d5ba429bdb?w=400&q=80',
    bio: 'Хореограф и инструктор групповых программ. Мои занятия — это кардио, которое не чувствуется как тренировка.',
  },
];

export const classTemplates: ClassTemplate[] = [
  { id: 'k1', title: 'Утренняя йога', category: 'Йога', clubId: 'c2', trainerId: 't2', time: '07:30', durationMin: 60, weekdays: [1, 3, 5], capacity: 20, level: 'Все уровни', room: 'Йога-студия', description: 'Мягкая практика для пробуждения тела: дыхание, суставная гимнастика, базовые асаны.', color: '#7C5CFF' },
  { id: 'k2', title: 'CrossFit WOD', category: 'Сила', clubId: 'c1', trainerId: 't1', time: '19:00', durationMin: 60, weekdays: [1, 2, 3, 4, 5], capacity: 16, level: 'Средний', room: 'Кроссфит-зона', description: 'Тренировка дня: силовая часть и метаболический комплекс. Масштабируется под ваш уровень.', color: '#FF7A45' },
  { id: 'k3', title: 'Бокс', category: 'Бокс', clubId: 'c3', trainerId: 't3', time: '20:00', durationMin: 75, weekdays: [2, 4, 6], capacity: 14, level: 'Все уровни', room: 'Бокс-зона', description: 'Работа на лапах и мешках, школа бокса, спарринги по желанию.', color: '#FF5C5C' },
  { id: 'k4', title: 'Пилатес', category: 'Растяжка', clubId: 'c2', trainerId: 't2', time: '10:00', durationMin: 55, weekdays: [2, 4, 6, 0], capacity: 18, level: 'Начальный', room: 'Зал 2', description: 'Укрепляем центр тела, работаем над осанкой и гибкостью.', color: '#4DA3FF' },
  { id: 'k5', title: 'Zumba', category: 'Танцы', clubId: 'c2', trainerId: 't6', time: '18:00', durationMin: 55, weekdays: [1, 3, 5], capacity: 30, level: 'Все уровни', room: 'Зал 1', description: 'Танцевальное кардио под латино-хиты. Сжигаем до 600 ккал.', color: '#FF4FA3' },
  { id: 'k6', title: 'Стретчинг', category: 'Растяжка', clubId: 'c1', trainerId: 't4', time: '12:00', durationMin: 45, weekdays: [1, 2, 3, 4, 5, 6, 0], capacity: 22, level: 'Все уровни', room: 'Зал 3', description: 'Глубокая растяжка всех групп мышц. Отлично после силовой.', color: '#3DDC84' },
  { id: 'k7', title: 'Сайкл', category: 'Кардио', clubId: 'c2', trainerId: 't6', time: '19:30', durationMin: 45, weekdays: [1, 2, 3, 4, 5], capacity: 24, level: 'Средний', room: 'Сайкл-студия', description: 'Интервальная езда под музыку с контролем пульса.', color: '#FFB347' },
  { id: 'k8', title: 'TRX Total Body', category: 'Сила', clubId: 'c1', trainerId: 't4', time: '08:00', durationMin: 50, weekdays: [6, 0], capacity: 16, level: 'Все уровни', room: 'Зал 3', description: 'Функциональная тренировка с петлями TRX на всё тело.', color: '#C6FF3D' },
  { id: 'k9', title: 'Аква-аэробика', category: 'Аква', clubId: 'c1', trainerId: 't5', time: '11:00', durationMin: 45, weekdays: [2, 4, 6], capacity: 15, level: 'Все уровни', room: 'Бассейн', description: 'Кардио в воде без нагрузки на суставы.', color: '#33C9DC' },
  { id: 'k10', title: 'Силовой класс', category: 'Сила', clubId: 'c4', trainerId: 't1', time: '18:30', durationMin: 60, weekdays: [1, 3, 5], capacity: 20, level: 'Начальный', room: 'Зал 1', description: 'Базовые упражнения со штангой и гантелями под контролем тренера.', color: '#FF7A45' },
  { id: 'k11', title: 'Вечерняя йога', category: 'Йога', clubId: 'c1', trainerId: 't2', time: '20:30', durationMin: 60, weekdays: [2, 4], capacity: 20, level: 'Все уровни', room: 'Зал 2', description: 'Расслабляющая практика в конце дня: инь-йога и медитация.', color: '#7C5CFF' },
  { id: 'k12', title: 'HIIT', category: 'Кардио', clubId: 'c3', trainerId: 't4', time: '07:00', durationMin: 40, weekdays: [1, 3, 5], capacity: 18, level: 'Продвинутый', room: 'Зал 1', description: 'Высокоинтенсивные интервалы. Максимум результата за 40 минут.', color: '#FFB347' },
];

export const plans: Plan[] = [
  { id: 'p1', name: 'Старт', months: 1, price: 25000, perMonth: 25000, features: ['Все клубы сети', 'Групповые занятия', 'Заморозка 7 дней'] },
  { id: 'p3', name: 'Формула', months: 3, price: 60000, oldPrice: 75000, perMonth: 20000, features: ['Все клубы сети', 'Групповые занятия', 'Заморозка 14 дней', '1 гостевой визит'] },
  { id: 'p6', name: 'Прогресс', months: 6, price: 105000, oldPrice: 150000, perMonth: 17500, features: ['Все клубы сети', 'Групповые занятия', 'Заморозка 30 дней', '3 гостевых визита', 'Анализ состава тела'], popular: true },
  { id: 'p12', name: 'Чемпион', months: 12, price: 180000, oldPrice: 300000, perMonth: 15000, features: ['Все клубы сети', 'Групповые занятия', 'Заморозка 90 дней', '6 гостевых визитов', 'Анализ состава тела', '2 персональные тренировки'] },
  { id: 'pd1', name: 'Дневной', months: 1, price: 15000, perMonth: 15000, features: ['Вход с 07:00 до 17:00', 'Все клубы сети', 'Групповые занятия днём'], dayOnly: true },
];

export const news: NewsItem[] = [
  {
    id: 'n1',
    title: 'Открытие клуба на Сейфуллина',
    subtitle: '15 октября • Алматы',
    image: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1200&q=80',
    date: '2026-09-25',
    body: 'Пятый клуб сети в Алматы откроется 15 октября. Действующим членам клуба — неделя бесплатных тренировок в новом зале и скидка 20% на продление.',
  },
  {
    id: 'n2',
    title: 'Марафон «30 дней силы»',
    subtitle: 'Старт 1 октября • Призы от партнёров',
    image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1200&q=80',
    date: '2026-09-20',
    body: 'Отмечайте тренировки в приложении 30 дней подряд и получите месяц абонемента в подарок. Лучшие результаты — призы от партнёров.',
  },
  {
    id: 'n3',
    title: 'Новые групповые: Mobility Flow',
    subtitle: 'Каждый вторник и четверг',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80',
    date: '2026-09-12',
    body: 'Программа для суставов и мобильности, идеально сочетается с силовыми тренировками. Запись открыта в расписании.',
  },
];

export const categories: ('Все' | Category)[] = ['Все', 'Йога', 'Сила', 'Кардио', 'Бокс', 'Танцы', 'Аква', 'Растяжка'];

/* ---------- helpers ---------- */

export const weekdayShort = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const monthShort = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

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
  if (iso === today) return 'Сегодня';
  if (iso === tomorrow) return 'Завтра';
  return `${weekdayShort[d.getDay()]}, ${d.getDate()} ${monthShort[d.getMonth()]}`;
}

export function formatDateLong(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} ${monthShort[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatPrice(n: number): string {
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

export function planById(id: string) {
  return plans.find((p) => p.id === id);
}

export function occupancyLabel(p: number): { label: string; color: string } {
  if (p < 45) return { label: 'Свободно', color: '#3DDC84' };
  if (p < 70) return { label: 'Средняя загрузка', color: '#FFB347' };
  return { label: 'Много людей', color: '#FF5C5C' };
}
