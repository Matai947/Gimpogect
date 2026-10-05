import { type Goal } from '@/data/fitness';
import { addDays, toISODate } from '@/data/mock';

/** Members of the club as the reception sees them. The signed-in device user is merged in at runtime. */
export type Member = {
  id: string; // matches the QR payload uid: u_<phone digits>
  name: string;
  phone: string;
  planId?: string;
  endDate?: string;
  frozenUntil?: string;
  homeClubId: string;
  visitsThisMonth: number;
  note?: string;
  since: string; // registration date
  lastVisit?: string;
  visitsTotal: number;
  age: number;
  goal: Goal;
  trainerId?: string;
  freezeDaysLeft: number;
};

const d = (n: number) => toISODate(addDays(new Date(), n));

export const members: Member[] = [
  { id: 'u_77012223344', name: 'Айгерим Нурланова', phone: '+7 701 222 33 44', planId: 'p12', endDate: d(210), homeClubId: 'c1', visitsThisMonth: 14, since: d(-520), lastVisit: d(-1), visitsTotal: 212, age: 29, goal: 'tone', trainerId: 't2', freezeDaysLeft: 60 },
  { id: 'u_77015556677', name: 'Данияр Сагынтаев', phone: '+7 701 555 66 77', planId: 'p3', endDate: d(23), homeClubId: 'c1', visitsThisMonth: 9, since: d(-70), lastVisit: d(-2), visitsTotal: 31, age: 34, goal: 'gain', trainerId: 't1', freezeDaysLeft: 14 },
  { id: 'u_77078889900', name: 'Мария Ким', phone: '+7 707 888 99 00', planId: 'p6', endDate: d(96), homeClubId: 'c2', visitsThisMonth: 11, since: d(-260), lastVisit: d(-3), visitsTotal: 98, age: 26, goal: 'lose', trainerId: 't3', freezeDaysLeft: 12 },
  { id: 'u_77021112233', name: 'Тимур Абдуллин', phone: '+7 702 111 22 33', planId: 'p1', endDate: d(-3), homeClubId: 'c1', visitsThisMonth: 6, note: 'Абонемент истёк 3 дня назад', since: d(-33), lastVisit: d(-9), visitsTotal: 6, age: 41, goal: 'strength', freezeDaysLeft: 0 },
  { id: 'u_77054445566', name: 'Алия Бекова', phone: '+7 705 444 55 66', planId: 'p6', endDate: d(140), frozenUntil: d(12), homeClubId: 'c3', visitsThisMonth: 2, since: d(-400), lastVisit: d(-20), visitsTotal: 140, age: 31, goal: 'flex', trainerId: 't5', freezeDaysLeft: 0 },
  { id: 'u_77779990011', name: 'Ерасыл Жумабеков', phone: '+7 777 999 00 11', planId: 'pd1', endDate: d(18), homeClubId: 'c1', visitsThisMonth: 8, since: d(-12), lastVisit: d(-1), visitsTotal: 8, age: 22, goal: 'gain', freezeDaysLeft: 7 },
  { id: 'u_77083334455', name: 'Виктория Ли', phone: '+7 708 333 44 55', planId: 'p3', endDate: d(2), homeClubId: 'c2', visitsThisMonth: 12, note: 'Скоро окончание, предложить продление', since: d(-88), lastVisit: d(-1), visitsTotal: 36, age: 27, goal: 'lose', trainerId: 't3', freezeDaysLeft: 4 },
  { id: 'u_77016667788', name: 'Арман Досжанов', phone: '+7 701 666 77 88', homeClubId: 'c1', visitsThisMonth: 0, note: 'Гостевой визит, абонемента нет', since: d(0), visitsTotal: 0, age: 30, goal: 'tone', freezeDaysLeft: 0 },
  { id: 'u_77752221133', name: 'Сабина Оразбекова', phone: '+7 775 222 11 33', planId: 'p12', endDate: d(330), homeClubId: 'c4', visitsThisMonth: 16, since: d(-900), lastVisit: d(-2), visitsTotal: 410, age: 36, goal: 'strength', trainerId: 't4', freezeDaysLeft: 90 },
  { id: 'u_77019998877', name: 'Нурлан Естаев', phone: '+7 701 999 88 77', planId: 'p6', endDate: d(60), homeClubId: 'c1', visitsThisMonth: 4, since: d(-125), lastVisit: d(-6), visitsTotal: 22, age: 45, goal: 'tone', freezeDaysLeft: 30 },
];

/** Pending shop orders visible at the reception, on top of the device user's own orders. */
export const mockOrders = [
  { id: 'GP-481203', memberId: 'u_77012223344', clubId: 'c1', date: toISODate(new Date()), items: [{ key: 's1::Ваниль', productId: 's1', option: 'Ваниль', qty: 1 }], subtotal: 24990, discount: 2499, total: 22491, status: 'Готов к выдаче' as const },
  { id: 'GP-481177', memberId: 'u_77078889900', clubId: 'c2', date: toISODate(addDays(new Date(), -1)), items: [{ key: 's12::Ассорти', productId: 's12', option: 'Ассорти', qty: 2 }, { key: 's16::Лайм', productId: 's16', option: 'Лайм', qty: 1 }], subtotal: 23100, discount: 2310, total: 20790, status: 'Готовится' as const },
  { id: 'GP-480950', memberId: 'u_77015556677', clubId: 'c1', date: toISODate(addDays(new Date(), -2)), items: [{ key: 's5', productId: 's5', qty: 1 }], subtotal: 8900, discount: 890, total: 8010, status: 'Готов к выдаче' as const },
];

export const STAFF_DEMO_CODE = '2468';
