import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { bmi, bmiLabel, dailyTargets, goalByKey, type FitnessProfile } from '@/data/fitness';
import { addDays, planById, toISODate } from '@/data/mock';
import { MEMBER_DISCOUNT, PROMO_CODES, productById } from '@/data/shop';

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

export type Order = {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  clubId: string;
  status: 'Готовится' | 'Готов к выдаче' | 'Выдан';
};

type State = {
  user: User | null;
  membership: Membership | null;
  bookings: string[]; // sessionIds
  favorites: string[]; // clubIds
  visits: Visit[];
  weightLog: { date: string; kg: number }[];
  cart: CartItem[];
  orders: Order[];
  hydrated: boolean;
};

type Actions = {
  login: (phone: string, name?: string) => void;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  completeOnboarding: (profile: FitnessProfile) => void;
  buyPlan: (planId: string) => void;
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
  hydrated: false,
};

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
    const { hydrated: _h, ...persist } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persist)).catch(() => {});
  }, [state]);

  const login = useCallback((phone: string, name?: string) => {
    setState((s) => ({
      ...s,
      user: { id: `u_${phone.replace(/\D/g, '')}`, name: name?.trim() || 'Гость', phone, homeClubId: 'c1' },
      // Demo account: a member with an active plan and history so the app looks alive.
      membership: s.membership ?? {
        planId: 'p6',
        startDate: toISODate(addDays(new Date(), -52)),
        endDate: toISODate(addDays(new Date(), 128)),
        freezeDaysLeft: 30,
      },
      visits: s.visits.length ? s.visits : demoVisits(),
      weightLog: s.weightLog.length ? s.weightLog : demoWeights(),
    }));
  }, []);

  const logout = useCallback(() => {
    setState({ ...initialState, hydrated: true });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
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

  const buyPlan = useCallback((planId: string) => {
    const plan = planById(planId);
    if (!plan) return;
    setState((s) => {
      const today = toISODate(new Date());
      const stillActive = s.membership && s.membership.endDate >= today;
      const base = stillActive ? new Date(s.membership!.endDate) : new Date();
      const end = new Date(base);
      end.setMonth(end.getMonth() + plan.months);
      const freezeDays = plan.months >= 12 ? 90 : plan.months >= 6 ? 30 : plan.months >= 3 ? 14 : 7;
      return {
        ...s,
        membership: {
          planId,
          startDate: stillActive ? s.membership!.startDate : today,
          endDate: toISODate(end),
          freezeDaysLeft: (stillActive ? s.membership!.freezeDaysLeft : 0) + freezeDays,
        },
      };
    });
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
      const subtotal = state.cart.reduce((sum, c) => sum + (productById(c.productId)?.price ?? 0) * c.qty, 0);
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
      };
      setState((s) => ({ ...s, cart: [], orders: [order, ...s.orders] }));
      return order;
    },
    [state.cart, state.membership]
  );

  const value = useMemo<State & Actions>(
    () => ({
      ...state,
      login,
      logout,
      updateUser,
      completeOnboarding,
      buyPlan,
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
    }),
    [state, login, logout, updateUser, completeOnboarding, buyPlan, freezeMembership, unfreezeMembership, book, cancelBooking, toggleFavorite, checkIn, logWeight, addToCart, setCartQty, removeFromCart, clearCart, placeOrder]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
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

/** Fitness profile with derived metrics; null until onboarding is done. */
export function useFitnessProfile() {
  const { user, weightLog } = useApp();
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
  }, [user?.profile, weightLog]);
}

/** Cart totals with member / promo discount. */
export function useCartSummary(promo?: string) {
  const { cart } = useApp();
  const membership = useMembershipInfo();
  return useMemo(() => {
    const lines = cart
      .map((c) => ({ ...c, product: productById(c.productId) }))
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
  }, [cart, membership.active, promo]);
}
