import { members } from '@/data/members';
import { addDays, plans, toISODate } from '@/data/mock';

export const OWNER_DEMO_CODE = '1357';

export type PayMethod = 'kaspi' | 'card' | 'cash' | 'split' | 'desk';

export type Sale = {
  id: string;
  ts: number;
  memberId?: string;
  name: string; // client
  title: string; // plan name or product
  kind: 'plan' | 'shop';
  amount: number;
  clubId: string;
  method: PayMethod;
  staff: string;
};

const shopItems = [
  { title: 'Протеин Whey 900 г', amount: 24990 },
  { title: 'BCAA 300 г', amount: 12900 },
  { title: 'Шейкер Seven Gym', amount: 4500 },
  { title: 'Креатин 300 г', amount: 9900 },
  { title: 'Перчатки для зала', amount: 6900 },
];
const planPool = ['p1', 'p1', 'p3', 'p3', 'p6', 'p12', 'pd1'];
const clubPool = ['c1', 'c1', 'c2'];
const methodPool: PayMethod[] = ['kaspi', 'kaspi', 'kaspi', 'card', 'card', 'cash', 'split'];
const staffPool = ['Айбек', 'Динара', 'Руслан'];

/** Deterministic demo sales for the last 60 days, so the owner dashboard has history. */
function buildMockSales(): Sale[] {
  let seed = 20260101;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const out: Sale[] = [];
  const base = new Date();
  for (let d = 59; d >= 0; d--) {
    const day = addDays(base, -d);
    const dow = day.getDay();
    const n = 3 + Math.floor(rnd() * 5) + (dow === 1 ? 3 : 0) + (dow === 0 ? -1 : 0); // Mondays are busy
    for (let i = 0; i < n; i++) {
      const m = pick(members.filter((x) => x.planId));
      const when = new Date(day);
      when.setHours(9 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0);
      const shop = rnd() < 0.28;
      const planId = pick(planPool);
      const plan = plans.find((p) => p.id === planId)!;
      const item = pick(shopItems);
      out.push({
        id: `S${toISODate(day).replace(/-/g, '')}${i}`,
        ts: when.getTime(),
        memberId: m.id,
        name: m.name,
        title: shop ? item.title : plan.name,
        kind: shop ? 'shop' : 'plan',
        amount: shop ? item.amount : plan.price,
        clubId: pick(clubPool),
        method: pick(methodPool),
        staff: pick(staffPool),
      });
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export const mockSales: Sale[] = buildMockSales();
