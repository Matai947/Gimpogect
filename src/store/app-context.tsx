import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { bmi, bmiLabel, dailyTargets, goalByKey, type FitnessProfile, type Goal } from '@/data/fitness';
import { members, mockOrders, type Member } from '@/data/members';
import { mockSales, type Sale } from '@/data/owner';
import { addDays, planById, plans, sessionById, toISODate } from '@/data/mock';
import { MEMBER_DISCOUNT, PROMO_CODES, products as baseProducts, type Product } from '@/data/shop';
import { pluralForm, setCurrentLang, tData, translate, type Lang, type TKey } from '@/i18n';
import { checkinRemote, checkoutRemote, fetchClients, fetchMyMembership, grantRemote, loginClient, registerClient, type RemoteClient } from '@/lib/api';
import { setRuntimeApiKey, type ChatMessage, type WeekPlan } from '@/lib/coach';

export type Membership = {
  planId: string;
  startDate: string;
  endDate: string;
  frozenUntil?: string;
  freezeDaysLeft: number;
};

export type User = {
  id: string;
  name: string;
  phone: string;
  homeClubId: string;
  profile?: FitnessProfile;
};

export type Visit = { date: string; clubId: string };

export type CartItem = { key: string; productId: string; option?: string; qty: number };

export type OrderStatus = 'Готовится' | 'Готов к выдаче' | 'Выдан';

export type Order = {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  clubId: string;
  status: OrderStatus;
  memberId?: string;
};

export type StaffSession = { name: string; clubId: string; since: string };
/** A visit lasts 3 hours from the entry, unless staff mark the exit earlier. */
export const SESSION_MS = 2 * 60 * 60 * 1000;

export type CheckinEntry = { ts: number; memberId: string; name: string; ok: boolean; reason?: string; clubId: string; leftTs?: number };

type State = {
  user: User | null;
  membership: Membership | null;
  bookings: string[]; // sessionIds
  favorites: string[]; // clubIds
  visits: Visit[];
  weightLog: { date: string; kg: number }[];
  cart: CartItem[];
  orders: Order[];
  coachMessages: ChatMessage[];
  coachPlan: WeekPlan | null;
  coachApiKey: string | null;
  lang: Lang;
  trialUsed: boolean;
  staff: StaffSession | null;
  owner: boolean; // owner (CRM) session, separate code from staff
  staffCode: string; // code typed at staff/owner login, sent to the API to read the client list
  token: string; // the client's own access token from the server (password sign-in)
  remote: RemoteClient[]; // clients registered from any device, fetched while staff or owner is signed in
  sales: Sale[]; // payments recorded on this device when staff issue plans
  staffLog: CheckinEntry[];
  attendance: Record<string, string[]>; // sessionId -> memberIds marked present
  orderStatusOverrides: Record<string, OrderStatus>;
  customProducts: Product[]; // products created by staff
  productOverrides: Record<string, Product>; // staff edits of base products
  planPrices: Record<string, { price: number; oldPrice?: number }>; // staff edits of membership prices
  hiddenProducts: string[]; // base products removed by staff
  memberGrants: Record<string, { planId: string; endDate: string }>; // plans issued by staff to mock members
  hydrated: boolean;
};

/** Catalog = base products with staff edits, plus staff-created ones. */
function catalogOf(s: Pick<State, 'customProducts' | 'productOverrides' | 'hiddenProducts'>) {
  const base = baseProducts.map((p) => s.productOverrides[p.id] ?? p);
  const all = [...s.customProducts, ...base];
  const visible = all.filter((p) => !s.hiddenProducts.includes(p.id));
  return { all, visible, byId: (id: string) => all.find((p) => p.id === id) };
}

type Actions = {
  /** Create a new account: the password is set on the server, which answers with the access token. */
  login: (phone: string, name: string, password: string) => Promise<boolean>;
  /** Sign in with an account the server already knows: name, questionnaire and plan come back without re-registering. Returns false if unknown. */
  restore: (phone: string, password: string) => Promise<'ok' | 'unknown' | 'wrong' | 'offline'>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  completeOnboarding: (profile: FitnessProfile) => void;
  grantPlan: (memberId: string, planId: string) => void;
  recordSale: (sale: Omit<Sale, 'id' | 'ts' | 'clubId' | 'staff'>) => void;
  setPlanPrice: (planId: string, price: number, oldPrice?: number) => void;
  freezeMembership: (days: number) => void;
  unfreezeMembership: () => void;
  book: (sessionId: string) => void;
  cancelBooking: (sessionId: string) => void;
  isBooked: (sessionId: string) => boolean;
  toggleFavorite: (clubId: string) => void;
  checkIn: (clubId: string) => void;
  logWeight: (kg: number) => void;
  addToCart: (productId: string, option?: string, qty?: number) => void;
  setCartQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  placeOrder: (clubId: string, promo?: string) => Order | null;
  addCoachMessage: (msg: ChatMessage) => void;
  clearCoachChat: () => void;
  setCoachPlan: (plan: WeekPlan | null) => void;
  setCoachApiKey: (key: string | null) => void;
  setLang: (lang: Lang) => void;
  staffLogin: (name: string, clubId: string, code: string) => void;
  staffLogout: () => void;
  ownerLogin: (code: string) => void;
  ownerLogout: () => void;
  setStaffClub: (clubId: string) => void;
  logCheckin: (entry: Omit<CheckinEntry, 'ts'>) => void;
  checkoutMember: (memberId: string) => void;
  toggleAttendance: (sessionId: string, memberId: string) => void;
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  restoreProduct: (id: string) => void;
};

const STORAGE_KEY = 'gym-project-state-v1';

const initialState: State = {
  user: null,
  membership: null,
  bookings: [],
  favorites: [],
  visits: [],
  weightLog: [],
  cart: [],
  orders: [],
  coachMessages: [],
  coachPlan: null,
  coachApiKey: null,
  lang: 'ru',
  trialUsed: false,
  staff: null,
  owner: false,
  staffCode: '',
  token: '',
  remote: [],
  sales: [],
  staffLog: [],
  attendance: {},
  orderStatusOverrides: {},
  customProducts: [],
  productOverrides: {},
  planPrices: {},
  hiddenProducts: [],
  memberGrants: {},
  hydrated: false,
};

/** Adds a plan to the current membership: extends if still active, otherwise starts today. Trial = 3 days. */
function extendMembership(cur: Membership | null, planId: string): Membership {
  const plan = planById(planId)!;
  const today = toISODate(new Date());
  const stillActive = !!cur && cur.endDate >= today;
  // A front-desk guest pass on an active (e.g. frozen) plan only lifts the freeze.
  if (plan.staffOnly && stillActive) return { ...cur!, frozenUntil: undefined };
  const end = stillActive ? new Date(cur!.endDate) : new Date();
  if (plan.days) end.setDate(end.getDate() + plan.days);
  else end.setMonth(end.getMonth() + plan.months);
  const freezeDays = plan.trial ? 0 : plan.months >= 12 ? 90 : plan.months >= 6 ? 30 : plan.months >= 3 ? 14 : 7;
  return { planId, startDate: stillActive ? cur!.startDate : today, endDate: toISODate(end), freezeDaysLeft: (stillActive ? cur!.freezeDaysLeft : 0) + freezeDays };
}

const AppContext = createContext<(State & Actions) | null>(null);

function demoVisits(): Visit[] {
  const today = new Date();
  const offsets = [1, 3, 4, 6, 8, 10, 11, 13, 15, 17, 18, 20, 22, 24, 27, 29, 31, 34, 36, 38, 41, 43, 45, 48];
  return offsets.map((o) => ({ date: toISODate(addDays(today, -o)), clubId: o % 3 === 0 ? 'c2' : 'c1' }));
}

/** 8 weekly points ending at the current weight, trending according to the goal. */
function demoWeights(current = 80.1, goal: FitnessProfile['goal'] = 'lose') {
  const today = new Date();
  const slope = goal === 'lose' ? 0.55 : goal === 'gain' ? -0.35 : 0.08; // kg per week going back in time
  const wobble = [0.2, -0.1, 0.15, -0.2, 0.1, -0.15, 0.05, 0];
  return Array.from({ length: 8 }, (_, i) => {
    const weeksAgo = 7 - i;
    const kg = Math.round((current + slope * weeksAgo + wobble[i]) * 10) / 10;
    return { date: toISODate(addDays(today, -weeksAgo * 7)), kg };
  });
}

export function cartKey(productId: string, option?: string) {
  return option ? `${productId}::${option}` : productId;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initialState);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<State>;
          setRuntimeApiKey(saved.coachApiKey ?? null);
          setCurrentLang(saved.lang ?? 'ru');
          setState({ ...initialState, ...saved, hydrated: true });
          return;
        }
      } catch {
        // ignore corrupt storage
      }
      setState((s) => ({ ...s, hydrated: true }));
    })();
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    // The client registry is fetched live and never kept on the device.
    const { hydrated: _h, remote: _r, ...persist } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persist)).catch(() => {});
  }, [state]);

  // Register this client in the shared registry whenever the account or profile changes.
  const user = state.user;
  useEffect(() => {
    if (!state.hydrated || !user || !state.token) return;
    const p = user.profile;
    registerClient({ id: user.id, name: user.name, phone: user.phone, homeClubId: user.homeClubId, profile: p ? { age: p.age, goal: p.goal, heightCm: p.heightCm, weightKg: p.weightKg, targetWeightKg: p.targetWeightKg, gender: p.gender, level: p.level, daysPerWeek: p.daysPerWeek } : undefined }, state.token);
  }, [state.hydrated, user, state.token]);

  // Staff and owner see the registry live; a client picks up a plan issued at the front desk.
  const hydrated = state.hydrated;
  const staffSignedIn = !!(state.staff || state.owner);
  const staffCode = state.staffCode;
  const uid = state.user?.id;
  const token = state.token;
  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    const tick = async () => {
      if (staffSignedIn && staffCode) {
        const clients = await fetchClients(staffCode);
        if (live && clients) setState((s) => ({ ...s, remote: clients }));
      }
      if (uid && token) {
        const m = (await fetchMyMembership(uid, token))?.membership;
        if (live && m && planById(m.planId)) setState((s) => (!s.membership || m.endDate > s.membership.endDate ? { ...s, membership: m } : s));
      }
    };
    tick();
    const iv = setInterval(tick, 8000);
    return () => {
      live = false;
      clearInterval(iv);
    };
  }, [hydrated, staffSignedIn, staffCode, uid, token]);

  const login = useCallback(async (phone: string, name: string, password: string) => {
    const id = `u_${phone.replace(/\D/g, '')}`;
    const user = { id, name: name.trim() || 'Гость', phone, homeClubId: 'c1' };
    const r = await registerClient({ ...user, password });
    if (!r?.token) return false;
    const token = r.token;
    setState((s) => ({
      ...s,
      user,
      token,
      // A new client has no plan: the administrator issues it at the front desk after payment, and only then the QR appears.
      membership: s.membership,
      visits: s.visits.length ? s.visits : demoVisits(),
      weightLog: s.weightLog.length ? s.weightLog : demoWeights(),
    }));
    return true;
  }, []);

  const restore = useCallback(async (phone: string, password: string) => {
    const id = `u_${phone.replace(/\D/g, '')}`;
    const r = await loginClient(id, password);
    if (r.status === 404) return 'unknown';
    if (r.status === 401) return 'wrong';
    if (!r.data) return 'offline';
    const me = r.data.account;
    const token = r.data.token;
    const p = me.profile;
    const full = p && p.goal && p.heightCm && p.weightKg && p.age ? ({ gender: (p.gender as FitnessProfile['gender']) ?? 'male', age: p.age, heightCm: p.heightCm, weightKg: p.weightKg, targetWeightKg: p.targetWeightKg, goal: p.goal as FitnessProfile['goal'], level: (p.level as FitnessProfile['level']) ?? 'beginner', daysPerWeek: p.daysPerWeek ?? 3 } satisfies FitnessProfile) : undefined;
    setState((s) => ({
      ...s,
      user: { id, name: me.name ?? 'Гость', phone, homeClubId: me.homeClubId ?? 'c1', profile: full },
      token,
      membership: me.membership ?? s.membership,
      visits: s.visits.length ? s.visits : demoVisits(),
      weightLog: full ? demoWeights(full.weightKg, full.goal) : s.weightLog,
    }));
    return 'ok';
  }, []);

  const logout = useCallback(() => {
    setRuntimeApiKey(null);
    // Keep the chosen language across logout.
    setState((s) => ({ ...initialState, lang: s.lang, hydrated: true }));
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const setLang = useCallback((lang: Lang) => {
    setCurrentLang(lang);
    setState((s) => ({ ...s, lang }));
  }, []);

  /* ---------- staff mode ---------- */

  const staffLogin = useCallback((name: string, clubId: string, code: string) => {
    setState((s) => ({ ...s, staffCode: code, staff: { name, clubId, since: toISODate(new Date()) } }));
  }, []);

  const staffLogout = useCallback(() => setState((s) => ({ ...s, staff: null, staffCode: s.owner ? s.staffCode : '' })), []);
  const ownerLogin = useCallback((code: string) => setState((s) => ({ ...s, owner: true, staffCode: code })), []);
  const ownerLogout = useCallback(() => setState((s) => ({ ...s, owner: false, staffCode: s.staff ? s.staffCode : '' })), []);

  const setStaffClub = useCallback((clubId: string) => setState((s) => (s.staff ? { ...s, staff: { ...s.staff, clubId } } : s)), []);

  const logCheckin = useCallback(
    (entry: Omit<CheckinEntry, 'ts'>) => {
    const ts = Date.now();
    const today = toISODate(new Date());
    if (entry.ok && state.staffCode && state.remote.some((r) => r.id === entry.memberId)) checkinRemote(state.staffCode, entry.memberId, entry.clubId);
    setState((s) => {
      // A successful check-in of the device user also counts as their visit.
      const isSelf = s.user && entry.memberId === s.user.id && entry.ok;
      const visits = isSelf && !s.visits.some((v) => v.date === today) ? [{ date: today, clubId: entry.clubId }, ...s.visits] : s.visits;
      return { ...s, visits, staffLog: [{ ...entry, ts }, ...s.staffLog].slice(0, 200) };
    });
    },
    [state.staffCode, state.remote],
  );

  /** Staff mark that a client has left before the 3 hours are over. */
  const checkoutMember = useCallback(
    (memberId: string) => {
      const now = Date.now();
      if (state.staffCode && state.remote.some((r) => r.id === memberId)) checkoutRemote(state.staffCode, memberId);
      setState((s) => {
        const i = s.staffLog.findIndex((e) => e.memberId === memberId && e.ok && !e.leftTs && now < e.ts + SESSION_MS);
        if (i < 0) return s;
        return { ...s, staffLog: s.staffLog.map((e, k) => (k === i ? { ...e, leftTs: now } : e)) };
      });
    },
    [state.staffCode, state.remote],
  );

  const toggleAttendance = useCallback((sessionId: string, memberId: string) => {
    setState((s) => {
      const cur = s.attendance[sessionId] ?? [];
      const next = cur.includes(memberId) ? cur.filter((m) => m !== memberId) : [...cur, memberId];
      return { ...s, attendance: { ...s.attendance, [sessionId]: next } };
    });
  }, []);

  /* ---------- catalog management (staff) ---------- */

  const upsertProduct = useCallback((p: Product) => {
    setState((s) => {
      const isBase = baseProducts.some((b) => b.id === p.id);
      if (isBase) return { ...s, productOverrides: { ...s.productOverrides, [p.id]: p }, hiddenProducts: s.hiddenProducts.filter((id) => id !== p.id) };
      const exists = s.customProducts.some((c) => c.id === p.id);
      return { ...s, customProducts: exists ? s.customProducts.map((c) => (c.id === p.id ? p : c)) : [p, ...s.customProducts] };
    });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setState((s) => {
      const isBase = baseProducts.some((b) => b.id === id);
      if (isBase) return { ...s, hiddenProducts: s.hiddenProducts.includes(id) ? s.hiddenProducts : [...s.hiddenProducts, id] };
      return { ...s, customProducts: s.customProducts.filter((c) => c.id !== id) };
    });
  }, []);

  const restoreProduct = useCallback((id: string) => {
    setState((s) => ({ ...s, hiddenProducts: s.hiddenProducts.filter((h) => h !== id) }));
  }, []);

  const setOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
      orderStatusOverrides: { ...s.orderStatusOverrides, [orderId]: status },
    }));
  }, []);

  /* ---------- AI coach ---------- */

  const addCoachMessage = useCallback((msg: ChatMessage) => {
    setState((s) => ({ ...s, coachMessages: [...s.coachMessages, msg].slice(-60) }));
  }, []);

  const clearCoachChat = useCallback(() => setState((s) => ({ ...s, coachMessages: [] })), []);

  const setCoachPlan = useCallback((plan: WeekPlan | null) => setState((s) => ({ ...s, coachPlan: plan })), []);

  const setCoachApiKey = useCallback((key: string | null) => {
    const k = key?.trim() || null;
    setRuntimeApiKey(k);
    setState((s) => ({ ...s, coachApiKey: k }));
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, ...patch } } : s));
  }, []);

  const completeOnboarding = useCallback((profile: FitnessProfile) => {
    setState((s) => {
      if (!s.user) return s;
      const today = toISODate(new Date());
      const firstTime = !s.user.profile;
      // First time: rebuild the demo weight history around the real weight. Later edits just log today's weight.
      const weightLog = firstTime
        ? demoWeights(profile.weightKg, profile.goal)
        : [...s.weightLog.filter((w) => w.date !== today), { date: today, kg: profile.weightKg }];
      return { ...s, user: { ...s.user, profile }, weightLog };
    });
  }, []);

  /** Staff issues a plan at the front desk: the user's own account, a client registered from another device, or a demo member. */
  const grantPlan = useCallback(
    (memberId: string, planId: string) => {
      const plan = planById(planId);
      if (!plan) return;
      // Clients that exist on the server get the new plan there too, so their own phone picks it up.
      const isSelf = state.user?.id === memberId;
      const remote = state.remote.find((r) => r.id === memberId);
      if ((isSelf || remote) && state.staffCode) {
        const next = extendMembership(isSelf ? state.membership : (remote?.membership ?? null), planId);
        grantRemote(state.staffCode, { id: memberId, name: isSelf ? state.user!.name : remote!.name, phone: isSelf ? state.user!.phone : remote!.phone, membership: next });
      }
      setState((s) => {
        const sold = (name: string): Sale[] => ((s.planPrices[planId]?.price ?? plan.price) > 0 ? [{ id: `S${Date.now()}`, ts: Date.now(), memberId, name, title: plan.name, kind: 'plan', amount: s.planPrices[planId]?.price ?? plan.price, clubId: s.staff?.clubId ?? 'c1', method: 'desk', staff: s.staff?.name ?? '' }, ...s.sales] : s.sales);
        if (s.user?.id === memberId) return { ...s, sales: sold(s.user.name), trialUsed: s.trialUsed || (!!plan.trial && !plan.staffOnly), membership: extendMembership(s.membership, planId) };
        const r = s.remote.find((x) => x.id === memberId);
        if (r) {
          const next = extendMembership(r.membership ?? null, planId);
          return { ...s, sales: sold(r.name), remote: s.remote.map((x) => (x.id === memberId ? { ...x, membership: next } : x)) };
        }
        const base = members.find((m) => m.id === memberId);
        if (!base) return s;
        const g = s.memberGrants[memberId];
        const cur: Membership | null = g ? { planId: g.planId, startDate: g.endDate, endDate: g.endDate, freezeDaysLeft: 0 } : base.endDate ? { planId: base.planId!, startDate: base.endDate, endDate: base.endDate, freezeDaysLeft: 0 } : null;
        const next = extendMembership(cur, planId);
        return { ...s, sales: sold(base.name), memberGrants: { ...s.memberGrants, [memberId]: { planId, endDate: next.endDate } } };
      });
    },
    [state.user, state.remote, state.membership, state.staffCode],
  );

  const setPlanPrice = useCallback((planId: string, price: number, oldPrice?: number) => {
    setState((s) => ({ ...s, planPrices: { ...s.planPrices, [planId]: { price, oldPrice } } }));
  }, []);

  /** Cash register: one receipt per sale, shown to the owner under payments. */
  const recordSale = useCallback((sale: Omit<Sale, 'id' | 'ts' | 'clubId' | 'staff'>) => {
    setState((s) => ({ ...s, sales: [{ ...sale, id: `R${Date.now().toString(36).toUpperCase()}`, ts: Date.now(), clubId: s.staff?.clubId ?? 'c1', staff: s.staff?.name ?? '' }, ...s.sales] }));
  }, []);

  const freezeMembership = useCallback((days: number) => {
    setState((s) => {
      if (!s.membership || days <= 0 || days > s.membership.freezeDaysLeft) return s;
      const end = new Date(s.membership.endDate);
      end.setDate(end.getDate() + days);
      return {
        ...s,
        membership: {
          ...s.membership,
          endDate: toISODate(end),
          frozenUntil: toISODate(addDays(new Date(), days)),
          freezeDaysLeft: s.membership.freezeDaysLeft - days,
        },
      };
    });
  }, []);

  const unfreezeMembership = useCallback(() => {
    setState((s) => (s.membership ? { ...s, membership: { ...s.membership, frozenUntil: undefined } } : s));
  }, []);

  const book = useCallback((sessionId: string) => {
    setState((s) => (s.bookings.includes(sessionId) ? s : { ...s, bookings: [...s.bookings, sessionId] }));
  }, []);

  const cancelBooking = useCallback((sessionId: string) => {
    setState((s) => ({ ...s, bookings: s.bookings.filter((b) => b !== sessionId) }));
  }, []);

  const toggleFavorite = useCallback((clubId: string) => {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(clubId) ? s.favorites.filter((c) => c !== clubId) : [...s.favorites, clubId],
    }));
  }, []);

  const checkIn = useCallback((clubId: string) => {
    const today = toISODate(new Date());
    setState((s) => (s.visits.some((v) => v.date === today) ? s : { ...s, visits: [{ date: today, clubId }, ...s.visits] }));
  }, []);

  const logWeight = useCallback((kg: number) => {
    const today = toISODate(new Date());
    setState((s) => ({ ...s, weightLog: [...s.weightLog.filter((w) => w.date !== today), { date: today, kg }] }));
  }, []);

  /* ---------- shop ---------- */

  const addToCart = useCallback((productId: string, option?: string, qty = 1) => {
    const key = cartKey(productId, option);
    setState((s) => {
      const existing = s.cart.find((c) => c.key === key);
      if (existing) return { ...s, cart: s.cart.map((c) => (c.key === key ? { ...c, qty: c.qty + qty } : c)) };
      return { ...s, cart: [...s.cart, { key, productId, option, qty }] };
    });
  }, []);

  const setCartQty = useCallback((key: string, qty: number) => {
    setState((s) => ({ ...s, cart: qty <= 0 ? s.cart.filter((c) => c.key !== key) : s.cart.map((c) => (c.key === key ? { ...c, qty } : c)) }));
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setState((s) => ({ ...s, cart: s.cart.filter((c) => c.key !== key) }));
  }, []);

  const clearCart = useCallback(() => setState((s) => ({ ...s, cart: [] })), []);

  const placeOrder = useCallback(
    (clubId: string, promo?: string): Order | null => {
      if (state.cart.length === 0) return null;
      const catalog = catalogOf({ customProducts: state.customProducts, productOverrides: state.productOverrides, hiddenProducts: state.hiddenProducts });
      const subtotal = state.cart.reduce((sum, c) => sum + (catalog.byId(c.productId)?.price ?? 0) * c.qty, 0);
      const today = toISODate(new Date());
      const memberActive = !!state.membership && state.membership.endDate >= today;
      const promoRate = promo ? PROMO_CODES[promo.trim().toUpperCase()] ?? 0 : 0;
      const rate = Math.max(memberActive ? MEMBER_DISCOUNT : 0, promoRate);
      const discount = Math.round(subtotal * rate);
      const order: Order = {
        id: `GP-${Date.now().toString().slice(-6)}`,
        date: today,
        items: state.cart,
        subtotal,
        discount,
        total: subtotal - discount,
        clubId,
        status: 'Готовится',
        memberId: state.user?.id,
      };
      setState((s) => ({ ...s, cart: [], orders: [order, ...s.orders] }));
      return order;
    },
    [state.cart, state.membership, state.user?.id, state.customProducts, state.productOverrides, state.hiddenProducts]
  );

  const value = useMemo<State & Actions>(
    () => ({
      ...state,
      login,
      restore,
      logout,
      updateUser,
      completeOnboarding,
      grantPlan,
      recordSale,
      setPlanPrice,
      freezeMembership,
      unfreezeMembership,
      book,
      cancelBooking,
      isBooked: (id: string) => state.bookings.includes(id),
      toggleFavorite,
      checkIn,
      logWeight,
      addToCart,
      setCartQty,
      removeFromCart,
      clearCart,
      placeOrder,
      addCoachMessage,
      clearCoachChat,
      setCoachPlan,
      setCoachApiKey,
      setLang,
      staffLogin,
      staffLogout,
      ownerLogin,
      ownerLogout,
      setStaffClub,
      logCheckin,
      checkoutMember,
      toggleAttendance,
      setOrderStatus,
      upsertProduct,
      deleteProduct,
      restoreProduct,
    }),
    [state, login, restore, logout, updateUser, completeOnboarding, grantPlan, recordSale, setPlanPrice, freezeMembership, unfreezeMembership, book, cancelBooking, toggleFavorite, checkIn, logWeight, addToCart, setCartQty, removeFromCart, clearCart, placeOrder, addCoachMessage, clearCoachChat, setCoachPlan, setCoachApiKey, setLang, staffLogin, staffLogout, ownerLogin, ownerLogout, setStaffClub, logCheckin, checkoutMember, toggleAttendance, setOrderStatus, upsertProduct, deleteProduct, restoreProduct]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** Translation helpers bound to the current language. */
export function useI18n() {
  const { lang, setLang } = useApp();
  return useMemo(
    () => ({
      lang,
      setLang,
      /** UI string by key with {var} interpolation. */
      t: (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
      /** Plural form for n, e.g. tp(3, 'days_pl') → "дня". */
      tp: (n: number, key: TKey) => pluralForm(lang, n, key),
      /** Content value from mock data (category, amenity, plan name…). */
      td: (value: string) => tData(lang, value),
    }),
    [lang, setLang]
  );
}

/** Derived membership info used across screens. */
export function useMembershipInfo() {
  const { membership } = useApp();
  return useMemo(() => {
    if (!membership) {
      return { active: false, daysLeft: 0, frozen: false, plan: undefined, totalDays: 0, progress: 0, endDate: undefined as string | undefined };
    }
    const today = new Date();
    const end = new Date(membership.endDate);
    const start = new Date(membership.startDate);
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const frozen = !!membership.frozenUntil && membership.frozenUntil >= toISODate(today);
    return {
      active: daysLeft > 0,
      daysLeft,
      frozen,
      plan: planById(membership.planId),
      totalDays,
      progress: Math.min(1, Math.max(0, 1 - daysLeft / totalDays)),
      endDate: membership.endDate,
    };
  }, [membership]);
}

/** Visit statistics for profile and home. */
export function useVisitStats() {
  const { visits } = useApp();
  return useMemo(() => {
    const today = new Date();
    const weekAgo = toISODate(addDays(today, -7));
    const monthAgo = toISODate(addDays(today, -30));
    const dates = new Set(visits.map((v) => v.date));
    let streak = 0;
    // Count consecutive weeks with at least one visit.
    for (let w = 0; w < 52; w++) {
      const from = addDays(today, -(w + 1) * 7 + 1);
      let hit = false;
      for (let i = 0; i < 7; i++) if (dates.has(toISODate(addDays(from, i)))) hit = true;
      if (hit) streak++;
      else break;
    }
    return {
      total: visits.length,
      thisWeek: visits.filter((v) => v.date >= weekAgo).length,
      thisMonth: visits.filter((v) => v.date >= monthAgo).length,
      weekStreak: streak,
      dates,
    };
  }, [visits]);
}

/** A member as the reception sees them: mock roster merged with the device user. */
export type MemberInfo = {
  id: string;
  name: string;
  phone: string;
  planId?: string;
  planName?: string;
  endDate?: string;
  daysLeft: number;
  active: boolean;
  frozen: boolean;
  dayOnly: boolean;
  homeClubId: string;
  visitsThisMonth: number;
  note?: string;
  isSelf: boolean;
  since: string;
  lastVisit?: string;
  visitsTotal: number;
  age: number;
  goal?: Goal;
  trainerId?: string;
  freezeDaysLeft: number;
  bookingsToday: number;
  ordersReady: number;
  params?: string; // height / weight, known for the device user only
};

export function useMembers() {
  const { user, membership, visits, memberGrants, bookings, orders, remote } = useApp();
  return useMemo(() => {
    const today = new Date();
    const todayIso = toISODate(today);
    const build = (m: Member, isSelf: boolean): MemberInfo => {
      const plan = m.planId ? planById(m.planId) : undefined;
      const daysLeft = m.endDate ? Math.ceil((new Date(m.endDate).getTime() - today.getTime()) / 86400000) : 0;
      return {
        id: m.id,
        name: m.name,
        phone: m.phone,
        planId: m.planId,
        planName: plan?.name,
        endDate: m.endDate,
        daysLeft,
        active: !!m.endDate && daysLeft > 0,
        frozen: !!m.frozenUntil && m.frozenUntil >= todayIso,
        dayOnly: !!plan?.dayOnly,
        homeClubId: m.homeClubId,
        visitsThisMonth: m.visitsThisMonth,
        note: m.note,
        isSelf,
        since: m.since,
        lastVisit: m.lastVisit,
        visitsTotal: m.visitsTotal,
        age: m.age,
        goal: m.goal,
        trainerId: m.trainerId,
        freezeDaysLeft: m.freezeDaysLeft,
        bookingsToday: isSelf ? bookings.filter((b) => sessionById(b)?.date === todayIso).length : 0,
        ordersReady: (isSelf ? orders : mockOrders).filter((o) => o.status === 'Готов к выдаче' && (!isSelf ? o.memberId === m.id : true)).length,
        params: isSelf && user?.profile ? `${user.profile.heightCm} см • ${user.profile.weightKg} кг` : undefined,
      };
    };
    const list = members.map((m) => {
      const g = memberGrants[m.id];
      return build(g ? { ...m, planId: g.planId, endDate: g.endDate, frozenUntil: undefined } : m, false);
    });
    // Clients registered from other devices, newest first. The device user is added below from local state.
    const fresh = remote
      .filter((r) => r.id !== user?.id && !members.some((m) => m.id === r.id))
      .map((r) => {
        const info = build({ id: r.id, name: r.name, phone: r.phone, planId: r.membership?.planId, endDate: r.membership?.endDate, frozenUntil: r.membership?.frozenUntil, homeClubId: r.homeClubId, visitsThisMonth: 0, since: r.since, visitsTotal: 0, age: r.profile?.age ?? 0, goal: r.profile?.goal as Goal | undefined, freezeDaysLeft: r.membership?.freezeDaysLeft ?? 0 }, false);
        info.params = r.profile?.heightCm ? `${r.profile.heightCm} см • ${r.profile.weightKg} кг` : undefined;
        return info;
      });
    list.unshift(...fresh);
    if (user) {
      const monthAgo = toISODate(addDays(today, -30));
      const self: Member = {
        id: user.id,
        name: user.name,
        phone: user.phone,
        planId: membership?.planId,
        endDate: membership?.endDate,
        frozenUntil: membership?.frozenUntil,
        homeClubId: user.homeClubId,
        visitsThisMonth: visits.filter((v) => v.date >= monthAgo).length,
        since: visits.length ? [...visits].sort((a, b) => a.date.localeCompare(b.date))[0].date : membership?.startDate ?? todayIso,
        lastVisit: visits.length ? [...visits].sort((a, b) => b.date.localeCompare(a.date))[0].date : undefined,
        visitsTotal: visits.length,
        age: user.profile?.age ?? 0,
        goal: user.profile?.goal ?? 'tone',
        freezeDaysLeft: membership?.freezeDaysLeft ?? 0,
      };
      list.unshift(build(self, true));
    }
    return {
      list,
      byId: (id: string) => list.find((m) => m.id === id),
    };
  }, [user, membership, visits, memberGrants, bookings, orders, remote]);
}

/** Membership plans with the front desk's price edits applied. */
export function usePlans() {
  const { planPrices } = useApp();
  return useMemo(() => plans.map((p) => {
    const o = planPrices[p.id];
    return o ? { ...p, price: o.price, oldPrice: o.oldPrice, perMonth: p.months ? Math.round(o.price / p.months) : o.price } : p;
  }), [planPrices]);
}

/** All payments: demo history plus those recorded on this device. Newest first. */
export function useSales() {
  const { sales } = useApp();
  return useMemo(() => [...sales, ...mockSales].sort((a, b) => b.ts - a.ts), [sales]);
}

/** Fitness profile with derived metrics; null until onboarding is done. */
export function useFitnessProfile() {
  const { user, weightLog, lang } = useApp();
  return useMemo(() => {
    const p = user?.profile;
    if (!p) return null;
    const latest = [...weightLog].sort((a, b) => b.date.localeCompare(a.date))[0]?.kg ?? p.weightKg;
    const value = bmi(latest, p.heightCm);
    const goal = goalByKey(p.goal);
    const toTarget = p.targetWeightKg !== undefined ? Math.round((latest - p.targetWeightKg) * 10) / 10 : undefined;
    return {
      ...p,
      currentWeightKg: latest,
      bmi: Math.round(value * 10) / 10,
      bmiInfo: bmiLabel(value),
      goalInfo: goal,
      toTarget,
      targets: dailyTargets({ ...p, weightKg: latest }),
    };
    // `lang` is a dependency because bmiLabel reads the current UI language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.profile, weightLog, lang]);
}

/** Everything the AI coach needs to know about the user; null until onboarding is done. */
export function useCoachContext() {
  const { user, weightLog, visits, bookings } = useApp();
  return useMemo(() => {
    if (!user?.profile) return null;
    const trend = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
    const current = trend[trend.length - 1]?.kg ?? user.profile.weightKg;
    const weekAgo = toISODate(addDays(new Date(), -7));
    return {
      name: user.name,
      profile: user.profile,
      currentWeightKg: current,
      weightTrend: trend,
      visitsThisWeek: visits.filter((v) => v.date >= weekAgo).length,
      homeClubId: user.homeClubId,
      upcoming: bookings.slice(0, 5),
    };
  }, [user, weightLog, visits, bookings]);
}

/** Shop catalog as members see it, with staff edits applied. */
export function useCatalog() {
  const { customProducts, productOverrides, hiddenProducts } = useApp();
  return useMemo(() => {
    const c = catalogOf({ customProducts, productOverrides, hiddenProducts });
    return { products: c.visible, all: c.all, hidden: hiddenProducts, byId: c.byId, isCustom: (id: string) => customProducts.some((p) => p.id === id) };
  }, [customProducts, productOverrides, hiddenProducts]);
}

/** Cart totals with member / promo discount. */
export function useCartSummary(promo?: string) {
  const { cart } = useApp();
  const membership = useMembershipInfo();
  const { byId } = useCatalog();
  return useMemo(() => {
    const lines = cart
      .map((c) => ({ ...c, product: byId(c.productId) }))
      .filter((l): l is typeof l & { product: NonNullable<typeof l.product> } => !!l.product);
    const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
    const promoRate = promo ? PROMO_CODES[promo.trim().toUpperCase()] ?? 0 : 0;
    const memberRate = membership.active ? MEMBER_DISCOUNT : 0;
    const rate = Math.max(memberRate, promoRate);
    const discount = Math.round(subtotal * rate);
    return {
      lines,
      count: cart.reduce((n, c) => n + c.qty, 0),
      subtotal,
      discount,
      total: subtotal - discount,
      discountSource: rate === 0 ? null : promoRate > memberRate ? ('promo' as const) : ('member' as const),
      promoValid: promoRate > 0,
    };
  }, [cart, membership.active, promo, byId]);
}

/** Current time that refreshes every 30 s, for "who is inside" views. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export type Present = { memberId: string; name: string; clubId: string; inTs: number; until: number };

/** Everyone currently inside: entries logged on this device plus sessions stored on the server. Newest first. */
export function usePresence(): Present[] {
  const { staffLog, remote } = useApp();
  const now = useNow();
  return useMemo(() => {
    const by = new Map<string, Present>();
    const add = (p: Present) => {
      const cur = by.get(p.memberId);
      if (!cur || p.inTs > cur.inTs) by.set(p.memberId, p);
    };
    staffLog.forEach((e) => e.ok && !e.leftTs && now < e.ts + SESSION_MS && add({ memberId: e.memberId, name: e.name, clubId: e.clubId, inTs: e.ts, until: e.ts + SESSION_MS }));
    remote.forEach((r) => r.session && !r.session.outTs && now < r.session.inTs + SESSION_MS && add({ memberId: r.id, name: r.name, clubId: r.session.clubId, inTs: r.session.inTs, until: r.session.inTs + SESSION_MS }));
    // A local exit mark beats an older server session of the same client.
    staffLog.forEach((e) => {
      const p = by.get(e.memberId);
      if (p && e.ok && e.leftTs && e.ts >= p.inTs) by.delete(e.memberId);
    });
    return [...by.values()].sort((a, b) => b.inTs - a.inTs);
  }, [staffLog, remote, now]);
}
