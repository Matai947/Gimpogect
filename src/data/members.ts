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
  goal?: Goal;
  trainerId?: string;
  freezeDaysLeft: number;
};


export const members: Member[] = [];

/** Pending shop orders visible at the reception, on top of the device user's own orders. */
export const mockOrders: { id: string; memberId: string; clubId: string; date: string; items: { key: string; productId: string; option?: string; qty: number }[]; subtotal: number; discount: number; total: number; status: "Готов к выдаче" | "Готовится" }[] = [];

export const STAFF_DEMO_CODE = '2468';
