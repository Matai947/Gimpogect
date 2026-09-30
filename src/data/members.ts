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
};

const d = (n: number) => toISODate(addDays(new Date(), n));

export const members: Member[] = [
  { id: 'u_77012223344', name: 'Айгерим Нурланова', phone: '+7 701 222 33 44', planId: 'p12', endDate: d(210), homeClubId: 'c1', visitsThisMonth: 14 },
  { id: 'u_77015556677', name: 'Данияр Сагынтаев', phone: '+7 701 555 66 77', planId: 'p3', endDate: d(23), homeClubId: 'c1', visitsThisMonth: 9 },
  { id: 'u_77078889900', name: 'Мария Ким', phone: '+7 707 888 99 00', planId: 'p6', endDate: d(96), homeClubId: 'c2', visitsThisMonth: 11 },
  { id: 'u_77021112233', name: 'Тимур Абдуллин', phone: '+7 702 111 22 33', planId: 'p1', endDate: d(-3), homeClubId: 'c1', visitsThisMonth: 6, note: 'Абонемент истёк 3 дня назад' },
  { id: 'u_77054445566', name: 'Алия Бекова', phone: '+7 705 444 55 66', planId: 'p6', endDate: d(140), frozenUntil: d(12), homeClubId: 'c3', visitsThisMonth: 2 },
  { id: 'u_77779990011', name: 'Ерасыл Жумабеков', phone: '+7 777 999 00 11', planId: 'pd1', endDate: d(18), homeClubId: 'c1', visitsThisMonth: 8 },
  { id: 'u_77083334455', name: 'Виктория Ли', phone: '+7 708 333 44 55', planId: 'p3', endDate: d(2), homeClubId: 'c2', visitsThisMonth: 12, note: 'Скоро окончание, предложить продление' },
  { id: 'u_77016667788', name: 'Арман Досжанов', phone: '+7 701 666 77 88', homeClubId: 'c1', visitsThisMonth: 0, note: 'Гостевой визит, абонемента нет' },
  { id: 'u_77752221133', name: 'Сабина Оразбекова', phone: '+7 775 222 11 33', planId: 'p12', endDate: d(330), homeClubId: 'c4', visitsThisMonth: 16 },
  { id: 'u_77019998877', name: 'Нурлан Естаев', phone: '+7 701 999 88 77', planId: 'p6', endDate: d(60), homeClubId: 'c1', visitsThisMonth: 4 },
];

/** Pending shop orders visible at the reception, on top of the device user's own orders. */
export const mockOrders = [
  { id: 'GP-481203', memberId: 'u_77012223344', clubId: 'c1', date: toISODate(new Date()), items: [{ key: 's1::Ваниль', productId: 's1', option: 'Ваниль', qty: 1 }], subtotal: 24990, discount: 2499, total: 22491, status: 'Готов к выдаче' as const },
  { id: 'GP-481177', memberId: 'u_77078889900', clubId: 'c2', date: toISODate(addDays(new Date(), -1)), items: [{ key: 's12::Ассорти', productId: 's12', option: 'Ассорти', qty: 2 }, { key: 's16::Лайм', productId: 's16', option: 'Лайм', qty: 1 }], subtotal: 23100, discount: 2310, total: 20790, status: 'Готовится' as const },
  { id: 'GP-480950', memberId: 'u_77015556677', clubId: 'c1', date: toISODate(addDays(new Date(), -2)), items: [{ key: 's5', productId: 's5', qty: 1 }], subtotal: 8900, discount: 890, total: 8010, status: 'Готов к выдаче' as const },
];

export const STAFF_DEMO_CODE = '2468';
