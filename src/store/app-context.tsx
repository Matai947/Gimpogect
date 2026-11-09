import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { bmi, bmiLabel, dailyTargets, goalByKey, type FitnessProfile, type Goal } from '@/data/fitness';
import { members, mockOrders, type Member } from '@/data/members';
import { mockSales, saleValue, type PayMethod, type Sale } from '@/data/owner';
import { applyContent, promoByCode, promoDiscount, type Content, type ContentSection } from '@/data/content';
import { addDays, applyClubConfig, planById, plans, sessionById, toISODate, type ClubConfig, clubCapacity } from '@/data/mock';
import { MEMBER_DISCOUNT, PROMO_CODES, products as baseProducts, type Product, shopCategories } from '@/data/shop';
import { pluralForm, setCurrentLang, tData, translate, type Lang, type TKey } from '@/i18n';
import { trainerLoginRemote, checkinRemote, clientMove, clientDelete, clientRename, type RemoteMembership, checkoutRemote, fetchClients, fetchClubs, fetchContent, saveClubs, saveContentRemote, fetchSales, postSale, fetchMyMembership, fetchMemberVisits, fetchOccupancy, editMembershipRemote, grantRemoteOnce, planFixRemote, loginClient, registerClient, type RemoteClient, serverNow, freezeRemote, onTokenRefused, fetchWhoami } from '@/lib/api';
import { setRuntimeApiKey, type ChatMessage, type WeekPlan } from '@/lib/coach';

export type Membership = {
  planId: string;
  startDate: string;
  endDate: string;
  frozenUntil?: string;
  freezeDaysLeft: number;
  freezesLeft?: number; // freezes still allowed (unset on old passes: the server works it out)
  freezeMax?: number; // days in one freeze
  visitsLeft?: number; // only for plans with a visit counter
  dayOnly?: boolean; // daytime plan: no entry from 17:00 (the server checks it too)
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

export type OrderStatus = 'Готовится' | 'Готов к выдаче' | 'Выдан' | 'Отменён';
/** Handed over or cancelled: nothing left to do at the desk. */
export const orderClosed = (s: OrderStatus) => s === 'Выдан' || s === 'Отменён';

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
  cancelReason?: string;
};

export type StaffSession = { name: string; clubId: string; since: string; role?: 'admin' | 'manager' };
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
  accountant?: boolean; // the owner's screens for the accountant: money only, read-only except the expenses
  staffCode: string; // code typed at staff/owner login, sent to the API to read the client list
  token: string; // the client's own access token from the server (password sign-in)
  remote: RemoteClient[]; // clients registered from any device, fetched while staff or owner is signed in
  serverSales: Sale[] | null; // the shared books from the server (null until first loaded)
  clubConfig: ClubConfig[]; // the network's clubs as the owner set them, kept for the next start
  autoAdmit: boolean; // the scanner records the entry (and takes a visit) as soon as a valid QR is scanned
  trainerAuth: { id: string; token: string } | null; // a trainer signed in with their PIN
  content: Content; // prices, plans, trainers, rules, schedule, promotions, photos set by the administrators
  contentStatus: 'idle' | 'saving' | 'ok' | 'fail'; // last save to the server (not kept on the device)
  sales: Sale[]; // payments recorded on this device when staff issue plans
  /** Plans issued at the desk that the server has not confirmed yet; sent again until it answers. `error` = the server refused. */
  pendingGrants: { gid: string; memberId: string; name: string; phone: string; membership: RemoteMembership; ts: number; error?: string }[];
  staffLog: CheckinEntry[];
  attendance: Record<string, string[]>; // sessionId -> memberIds marked present
  orderStatusOverrides: Record<string, OrderStatus>;
  customProducts: Product[]; // products created by staff
  productOverrides: Record<string, Product>; // staff edits of base products
  planPrices: Record<string, { price: number; oldPrice?: number }>; // staff edits of membership prices
  hiddenProducts: string[]; // base products removed by staff
  memberGrants: Record<string, { planId: string; endDate: string }>; // plans issued by staff to mock members
  hydrated: boolean;
  sessionExpired?: boolean; // the server refused the saved sign-in: the sign-in screen says why
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
  restore: (phone: string, password: string) => Promise<'ok' | 'unknown' | 'wrong' | 'reset' | 'locked' | 'offline'>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  completeOnboarding: (profile: FitnessProfile) => void;
  /** Manager: the client's home club changes; they move to that club's list. */
  moveClient: (memberId: string, clubId: string) => Promise<boolean>;
  deleteClient: (memberId: string) => Promise<boolean>;
  renameClient: (memberId: string, name: string) => Promise<boolean>;
  grantPlan: (memberId: string, planId: string, amount?: number, pays?: { method: PayMethod; amount: number }[], meta?: { disc?: number; off?: number }) => void;
  /** The desk has read a refused grant (and asked the manager): it leaves the warning list. */
  dismissGrant: (gid: string) => void;
  /** The desk corrects a client's current plan: when it ends and how many visits are left. No sale is recorded. */
  editMembership: (memberId: string, fields: { planId?: string; endDate: string; visitsLeft?: number; addFreeze?: boolean }) => Promise<boolean>;
  /** Manager or owner: a plan added by mistake becomes the right one (same start date, what was used stays used). No sale is recorded. */
  changePlan: (memberId: string, planId: string, fields: { endDate: string; visitsLeft?: number }, reason: string) => Promise<boolean>;
  recordSale: (sale: Omit<Sale, 'id' | 'ts' | 'clubId' | 'staff' | 'synced'>) => void;
  refreshSales: () => Promise<void>;
  /** Re-reads the content (prices, stock counts) from the server. */
  refreshContent: () => Promise<void>;
  saveClubConfig: (list: ClubConfig[]) => Promise<boolean>;
  saveContent: (section: ContentSection, data: unknown) => void;
  trainerLogin: (trainerId: string, pin: string) => Promise<'ok' | 'wrong' | 'locked' | 'nopin' | 'offline'>;
  trainerLogout: () => void;
  setAutoAdmit: (v: boolean) => void;
  setPlanPrice: (planId: string, price: number, oldPrice?: number) => void;
  /** The client freezes or unfreezes their own plan on the server. False = refused or offline. */
  freezeMembership: (days: number) => Promise<boolean>;
  unfreezeMembership: () => Promise<boolean>;
  /** The desk freezes (days > 0) or unfreezes (0) a client's plan. */
  staffFreeze: (memberId: string, days: number) => Promise<boolean>;
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
  staffLogin: (name: string, clubId: string, code: string, role: 'admin' | 'manager') => void;
  staffLogout: () => void;
  ownerLogin: (code: string, accountant?: boolean) => void;
  ownerLogout: () => void;
  setStaffClub: (clubId: string) => void;
  logCheckin: (entry: Omit<CheckinEntry, 'ts'>, served?: { visitsLeft?: number; membership?: RemoteMembership | null }) => void;
  checkoutMember: (memberId: string) => void;
  toggleAttendance: (sessionId: string, memberId: string) => void;
  setOrderStatus: (orderId: string, status: OrderStatus, reason?: string) => void;
  /** The client changed their mind: an order not yet handed over is removed. */
  cancelOrder: (orderId: string) => void;
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
  serverSales: null,
  clubConfig: [],
  autoAdmit: true,
  trainerAuth: null,
  content: {},
  contentStatus: 'idle',
  sales: [],
  pendingGrants: [],
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
  const perFreeze = plan.trial ? 0 : (plan.freezeDays ?? 0);
  const count = perFreeze ? (plan.freezeCount ?? 1) : 0;
  const freezeDays = perFreeze * count;
  const freezesLeft = (stillActive ? (cur!.freezesLeft ?? 0) : 0) + count;
  const visitsLeft = plan.visits ? (stillActive && cur!.visitsLeft !== undefined ? cur!.visitsLeft : 0) + plan.visits : undefined;
  return { planId, startDate: stillActive ? cur!.startDate : today, endDate: toISODate(end), freezeDaysLeft: (stillActive ? cur!.freezeDaysLeft : 0) + freezeDays, freezesLeft, freezeMax: perFreeze || (stillActive ? cur!.freezeMax : 0) || 0, ...(visitsLeft !== undefined ? { visitsLeft } : {}), ...(plan.dayOnly ? { dayOnly: true } : {}) };
}

/**
 * A plan added by mistake becomes the right one as if it had been sold on the same day: same start, the right length,
 * and what the client already used (visits, freeze days and freezes) stays used.
 */
export function replacePlan(cur: Membership, planId: string): Membership {
  const plan = planById(planId)!;
  const old = planById(cur.planId);
  const oldCount = old?.freezeDays ? (old.freezeCount ?? 1) : 0;
  const perFreeze = plan.trial ? 0 : (plan.freezeDays ?? 0);
  const count = perFreeze ? (plan.freezeCount ?? 1) : 0;
  const usedFreezes = Math.max(0, oldCount - (cur.freezesLeft ?? oldCount));
  // days already spent frozen pushed the end date out; they stay spent and keep pushing it.
  // Only a pass that was really frozen has spent any: many imported passes carry 0 freeze days without ever freezing.
  const pool = (old?.freezeDays ?? 0) * oldCount;
  const usedFreezeDays = usedFreezes > 0 ? Math.min(pool, Math.max(0, pool - cur.freezeDaysLeft)) : 0;
  const usedVisits = old?.visits && cur.visitsLeft !== undefined ? Math.max(0, old.visits - cur.visitsLeft) : 0;
  const end = new Date(cur.startDate);
  if (plan.days) end.setDate(end.getDate() + plan.days);
  else end.setMonth(end.getMonth() + plan.months);
  end.setDate(end.getDate() + usedFreezeDays);
  return {
    planId,
    startDate: cur.startDate,
    endDate: toISODate(end),
    freezeDaysLeft: Math.max(0, perFreeze * count - usedFreezeDays),
    freezesLeft: Math.max(0, count - usedFreezes),
    freezeMax: perFreeze,
    ...(plan.visits ? { visitsLeft: Math.max(0, plan.visits - usedVisits) } : {}),
    ...(plan.dayOnly ? { dayOnly: true } : {}),
    ...(cur.frozenUntil ? { frozenUntil: cur.frozenUntil } : {}),
  };
}

const AppContext = createContext<(State & Actions) | null>(null);

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
          applyClubConfig(saved.clubConfig ?? []);
          applyContent(saved.content ?? {});
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
    const { hydrated: _h, remote: _r, serverSales: _ss, contentStatus: _cs, ...persist } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persist)).catch(() => {});
  }, [state]);

  // Branches added by the owner: fetched at start and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!state.hydrated) return;
    let live = true;
    const load = () =>
      fetchClubs().then((list) => {
        if (!live || !list || !list.length) return;
        applyClubConfig(list);
        setState((s) => ({ ...s, clubConfig: list }));
      });
    const loadContent = () =>
      fetchContent(state.staffCode).then((c) => {
        if (!live || !c) return;
        applyContent(c);
        // The shop catalogue lives in its own state fields; the server copy replaces them.
        setState((s) => ({ ...s, content: c, ...(c.catalog ? { customProducts: c.catalog.custom, productOverrides: c.catalog.overrides, hiddenProducts: c.catalog.hidden } : {}) }));
      });
    void load();
    void loadContent();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && (void load(), void loadContent()));
    return () => {
      live = false;
      sub.remove();
    };
  }, [state.hydrated, state.staffCode]);

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
        const books = await fetchSales(staffCode);
        if (live && books) setState((s) => ({ ...s, serverSales: books }));
      }
      if (uid && token) {
        const me = await fetchMyMembership(uid, token);
        const m = me?.membership;
        if (live && me && (!m || planById(m.planId))) setState((s) => (JSON.stringify(s.membership ?? null) === JSON.stringify(m ?? null) ? s : { ...s, membership: m ?? null }));
        // a name the manager corrected reaches the client's own phone
        if (live && me?.name && me.name !== 'Гость') setState((s) => (s.user && s.user.name !== me.name ? { ...s, user: { ...s.user, name: me.name! } } : s));
        const seen = await fetchMemberVisits(uid, { token });
        if (live && seen) {
          const visits = [...new Map(seen.map((v) => [v.d, { date: v.d, clubId: v.c }])).values()];
          setState((s) => (JSON.stringify(s.visits) === JSON.stringify(visits) ? s : { ...s, visits }));
        }
      }
    };
    tick();
    // A client's phone asks every 20 seconds, so a plan bought at the desk turns the QR on almost at once;
    // the desk (the whole registry) every minute. Plus whenever the app comes back to the foreground.
    const iv = setInterval(tick, staffSignedIn ? 60000 : 20000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && tick());
    return () => {
      live = false;
      clearInterval(iv);
      sub.remove();
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
      sessionExpired: false,
      // A new client has no plan: the administrator issues it at the front desk after payment, and only then the QR appears.
      membership: s.membership,
      visits: s.visits,
      weightLog: s.weightLog,
    }));
    return true;
  }, []);

  const restore = useCallback(async (phone: string, password: string) => {
    const id = `u_${phone.replace(/\D/g, '')}`;
    const r = await loginClient(id, password);
    if (r.status === 404) return 'unknown';
    if (r.status === 401) return 'wrong';
    if (r.status === 409) return 'reset';
    if (r.status === 429) return 'locked';
    if (!r.data) return 'offline';
    const me = r.data.account;
    const token = r.data.token;
    const p = me.profile;
    const full = p && p.goal && p.heightCm && p.weightKg && p.age ? ({ gender: (p.gender as FitnessProfile['gender']) ?? 'male', age: p.age, heightCm: p.heightCm, weightKg: p.weightKg, targetWeightKg: p.targetWeightKg, goal: p.goal as FitnessProfile['goal'], level: (p.level as FitnessProfile['level']) ?? 'beginner', daysPerWeek: p.daysPerWeek ?? 3 } satisfies FitnessProfile) : undefined;
    setState((s) => ({
      ...s,
      user: { id, name: me.name ?? 'Гость', phone, homeClubId: me.homeClubId ?? 'c1', profile: full },
      token,
      sessionExpired: false,
      membership: me.membership ?? s.membership,
      visits: s.visits,
      weightLog: full?.weightKg && !s.weightLog.length ? [{ date: toISODate(new Date()), kg: full.weightKg }] : s.weightLog,
    }));
    return 'ok';
  }, []);

  // The staff name is remembered at sign-in; after the owner renames someone the server writes shifts and sales under the
  // new name, and this phone would look for its open shift under the old one (the shift seemed to vanish). Take the server's.
  const staffName = state.staff?.name;
  useEffect(() => {
    if (!state.hydrated || !state.staffCode || !staffName) return;
    let live = true;
    fetchWhoami(state.staffCode).then((name) => {
      if (live && name && name !== 'owner' && name !== staffName) setState((s) => (s.staff ? { ...s, staff: { ...s.staff, name } } : s));
    });
    return () => {
      live = false;
    };
  }, [state.hydrated, state.staffCode, staffName]);

  // A sign-in the server no longer accepts (made on the old server, or expired): sign the client out, keep staff mode and the language.
  useEffect(() => {
    onTokenRefused(() =>
      setState((s) => (s.user ? { ...initialState, lang: s.lang, hydrated: true, staff: s.staff, owner: s.owner, staffCode: s.staffCode, sessionExpired: true } : s)),
    );
    return () => onTokenRefused(null);
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

  const staffLogin = useCallback((name: string, clubId: string, code: string, role: 'admin' | 'manager') => {
    setState((s) => ({ ...s, staffCode: code, staff: { name, clubId, since: toISODate(new Date()), role } }));
  }, []);

  const staffLogout = useCallback(() => setState((s) => ({ ...s, staff: null, staffCode: s.owner ? s.staffCode : '' })), []);
  const ownerLogin = useCallback((code: string, accountant?: boolean) => setState((s) => ({ ...s, owner: true, accountant: !!accountant, staffCode: code })), []);
  const ownerLogout = useCallback(() => setState((s) => ({ ...s, owner: false, accountant: false, staffCode: s.staff ? s.staffCode : '' })), []);

  const setStaffClub = useCallback((clubId: string) => setState((s) => (s.staff ? { ...s, staff: { ...s.staff, clubId } } : s)), []);

  const logCheckin = useCallback(
    (entry: Omit<CheckinEntry, 'ts'>, served?: { visitsLeft?: number; membership?: RemoteMembership | null }) => {
    const ts = Date.now();
    const today = toISODate(new Date());
    // What the server answered: the visit counter, or the pass that just started at this first entry.
    const apply = (r: { visitsLeft?: number; membership?: RemoteMembership | null } | null) => {
      if (!r) return;
      setState((s) => ({ ...s, remote: s.remote.map((c) => (c.id === entry.memberId ? { ...c, pending: undefined, ...(r.membership ? { membership: r.membership } : {}) } : c)) }));
    };
    if (served) apply(served);
    else if (entry.ok && state.staffCode && state.remote.some((r) => r.id === entry.memberId)) checkinRemote(state.staffCode, entry.memberId, entry.clubId).then(apply);
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

  // Only a real edit on this device sends the catalogue to the server: a fresh device must never push its empty copy over the server's.
  const catalogDirty = useRef(false);
  // the products edited here: only these go over the server's copy, so two phones editing at once keep each other's changes
  const touched = useRef(new Set<string>());
  const upsertProduct = useCallback((p: Product) => {
    catalogDirty.current = true;
    touched.current.add(p.id);
    setState((s) => {
      const isBase = baseProducts.some((b) => b.id === p.id);
      if (isBase) return { ...s, productOverrides: { ...s.productOverrides, [p.id]: p }, hiddenProducts: s.hiddenProducts.filter((id) => id !== p.id) };
      const exists = s.customProducts.some((c) => c.id === p.id);
      return { ...s, customProducts: exists ? s.customProducts.map((c) => (c.id === p.id ? p : c)) : [p, ...s.customProducts] };
    });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    catalogDirty.current = true;
    touched.current.add(id);
    // nothing is erased: a removed product goes to "Hidden", where one tap brings it back with its price and barcodes
    setState((s) => ({ ...s, hiddenProducts: s.hiddenProducts.includes(id) ? s.hiddenProducts : [...s.hiddenProducts, id] }));
  }, []);

  const restoreProduct = useCallback((id: string) => {
    catalogDirty.current = true;
    touched.current.add(id);
    setState((s) => ({ ...s, hiddenProducts: s.hiddenProducts.filter((h) => h !== id) }));
  }, []);

  const setOrderStatus = useCallback((orderId: string, status: OrderStatus, reason?: string) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, status, cancelReason: status === 'Отменён' ? reason : undefined } : o)),
      orderStatusOverrides: { ...s.orderStatusOverrides, [orderId]: status },
    }));
  }, []);

  const cancelOrder = useCallback((orderId: string) => {
    setState((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== orderId || orderClosed(s.orderStatusOverrides[o.id] ?? o.status)) }));
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
      // The first weight opens the log; later edits log today's weight.
      const weightLog = firstTime ? [{ date: today, kg: profile.weightKg }] : [...s.weightLog.filter((w) => w.date !== today), { date: today, kg: profile.weightKg }];
      return { ...s, user: { ...s.user, profile }, weightLog };
    });
  }, []);

  /** Staff issues a plan at the front desk: the user's own account, a client registered from another device, or a demo member. */
  const editMembership = useCallback(
    async (memberId: string, fields: { planId?: string; endDate: string; visitsLeft?: number; addFreeze?: boolean }) => {
      const isSelf = state.user?.id === memberId;
      const remote = state.remote.find((r) => r.id === memberId);
      const cur = isSelf ? state.membership : remote?.membership;
      // A client without a plan gets the one the desk picked; an existing plan keeps its type.
      const planId = cur?.planId ?? remote?.pending?.planId ?? fields.planId;
      const picked = fields.planId ? planById(fields.planId) : undefined;
      if (!state.staffCode || !planId || (!isSelf && !remote)) return false;
      const today = toISODate(new Date());
      // An imported pass that was still waiting for its first entry starts today once the desk gives it dates.
      // A pass that never froze and carries no freeze days (set by hand, brought from the old base) gets its plan's freeze rule.
      const rule = planById(planId);
      const perFreeze = rule && !rule.trial ? (rule.freezeDays ?? 0) : 0;
      const count = perFreeze ? (rule?.freezeCount ?? 1) : 0;
      const neverFroze = !cur || (cur.freezesLeft === undefined && !cur.freezeDaysLeft && !cur.frozenUntil);
      const freeze = neverFroze && perFreeze && !remote?.pending?.freezeDays ? { freezeDaysLeft: perFreeze * count, freezesLeft: count, freezeMax: perFreeze } : {};
      const kept = cur?.freezesLeft !== undefined ? { freezesLeft: cur.freezesLeft, ...(cur.freezeMax ? { freezeMax: cur.freezeMax } : {}) } : {};
      const next: Membership = { planId, startDate: cur?.startDate ?? today, endDate: fields.endDate, freezeDaysLeft: cur?.freezeDaysLeft ?? remote?.pending?.freezeDays ?? 0, ...kept, ...(cur?.frozenUntil ? { frozenUntil: cur.frozenUntil } : {}), ...(cur?.dayOnly || remote?.pending?.dayOnly || (!cur && picked?.dayOnly) ? { dayOnly: true } : {}), ...(fields.visitsLeft !== undefined ? { visitsLeft: fields.visitsLeft } : {}), ...freeze };
      if (fields.addFreeze) {
        const days = perFreeze || 5;
        Object.assign(next, { freezeDaysLeft: (next.freezeDaysLeft ?? 0) + days, freezesLeft: (next.freezesLeft ?? 0) + 1, freezeMax: next.freezeMax || days });
      }
      const ok = await editMembershipRemote(state.staffCode, { id: memberId, name: isSelf ? state.user!.name : remote!.name, phone: isSelf ? state.user!.phone : remote!.phone, membership: next });
      if (!ok) return false;
      setState((s) => (isSelf ? { ...s, membership: next } : { ...s, remote: s.remote.map((x) => (x.id === memberId ? { ...x, membership: next, pending: undefined } : x)) }));
      return true;
    },
    [state.user, state.remote, state.membership, state.staffCode],
  );

  const changePlan = useCallback(
    async (memberId: string, planId: string, fields: { endDate: string; visitsLeft?: number }, reason: string) => {
      const isSelf = state.user?.id === memberId;
      const remote = state.remote.find((r) => r.id === memberId);
      const cur = isSelf ? state.membership : remote?.membership;
      if (!state.staffCode || !cur || !planById(planId)) return false;
      const { visitsLeft: _v, ...base } = replacePlan(cur, planId);
      // the desk may still correct the end date and the visits it was shown
      const next: Membership = { ...base, endDate: fields.endDate, ...(fields.visitsLeft !== undefined ? { visitsLeft: fields.visitsLeft } : {}) };
      if (!(await planFixRemote(state.staffCode, memberId, next, reason))) return false;
      setState((s) => (isSelf ? { ...s, membership: next } : { ...s, remote: s.remote.map((x) => (x.id === memberId ? { ...x, membership: next } : x)) }));
      return true;
    },
    [state.user, state.remote, state.membership, state.staffCode],
  );

  const moveClient = useCallback(
    async (memberId: string, clubId: string) => {
      if (!state.staffCode || !(await clientMove(state.staffCode, memberId, clubId))) return false;
      setState((s) => ({ ...s, remote: s.remote.map((x) => (x.id === memberId ? { ...x, homeClubId: clubId } : x)) }));
      return true;
    },
    [state.staffCode],
  );

  const renameClient = useCallback(
    async (memberId: string, name: string) => {
      if (!state.staffCode || !(await clientRename(state.staffCode, memberId, name))) return false;
      setState((s) => ({ ...s, remote: s.remote.map((x) => (x.id === memberId ? { ...x, name } : x)) }));
      return true;
    },
    [state.staffCode],
  );

  const deleteClient = useCallback(
    async (memberId: string) => {
      if (!state.staffCode || !(await clientDelete(state.staffCode, memberId))) return false;
      setState((s) => ({ ...s, remote: s.remote.filter((x) => x.id !== memberId) }));
      return true;
    },
    [state.staffCode],
  );

  const grantPlan = useCallback(
    (memberId: string, planId: string, amount?: number, pays?: { method: PayMethod; amount: number }[], meta?: { disc?: number; off?: number }) => {
      const plan = planById(planId);
      if (!plan) return;
      // Clients that exist on the server get the new plan there too, so their own phone picks it up.
      const isSelf = state.user?.id === memberId;
      const remote = state.remote.find((r) => r.id === memberId);
      // the sale carries the grant's id: a cancelled check takes back only a plan the server really gave, and only once
      const gid = `G${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      if ((isSelf || remote) && state.staffCode) {
        const next = extendMembership(isSelf ? state.membership : (remote?.membership ?? null), planId);
        // not sent and forgotten: the grant waits in a queue (kept on the device) until the server confirms it
        const grant = { gid, memberId, name: isSelf ? state.user!.name : remote!.name, phone: isSelf ? state.user!.phone : remote!.phone, membership: next, ts: Date.now() };
        setState((s) => ({ ...s, pendingGrants: [...(s.pendingGrants ?? []), grant] }));
      }
      setState((s) => {
        const price = amount ?? s.planPrices[planId]?.price ?? plan.price;
        // one row per way it was paid: a mixed payment (cash + Kaspi) is two rows, so the drawer counts only the cash
        const parts = (pays ?? [{ method: 'desk' as PayMethod, amount: price }]).filter((p, i) => p.amount > 0 || (i === 0 && meta?.disc === 100));
        const sold = (name: string): Sale[] => [...parts.map((p, i): Sale => ({ id: `S${Date.now()}${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), memberId, name, title: plan.name, ...(i === 0 ? { planId, gid } : {}), kind: 'plan', amount: p.amount, clubId: s.staff?.clubId ?? 'c1', method: p.method, staff: s.staff?.name ?? '', ...(i === 0 && meta?.disc ? { disc: meta.disc, off: meta.off } : {}) })), ...s.sales];
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

  /** Reloads the shared books right now (after a refund or a debt payment). */
  const refreshContent = useCallback(async () => {
    const c = await fetchContent(state.staffCode);
    if (!c) return;
    applyContent(c);
    setState((s) => ({ ...s, content: c, ...(c.catalog ? { customProducts: c.catalog.custom, productOverrides: c.catalog.overrides, hiddenProducts: c.catalog.hidden } : {}) }));
  }, [state.staffCode]);

  const refreshSales = useCallback(async () => {
    if (!state.staffCode) return;
    const books = await fetchSales(state.staffCode);
    if (books) setState((s) => ({ ...s, serverSales: books }));
  }, [state.staffCode]);

  // Every payment made on this device goes to the server once; the flag keeps retries honest after a restart.
  const posting = useRef(new Set<string>());
  useEffect(() => {
    if (!state.hydrated || !state.staffCode) return;
    state.sales
      .filter((x) => !x.synced && !posting.current.has(x.id))
      .forEach((x) => {
        posting.current.add(x.id);
        postSale(state.staffCode, x).then((r) => {
          posting.current.delete(x.id);
          if (r) setState((s) => ({ ...s, sales: s.sales.map((y) => (y.id === x.id ? { ...y, synced: true } : y)) }));
        });
      });
  }, [state.hydrated, state.staffCode, state.sales]);

  // Plans issued at the desk reach the server the same way: retried until confirmed, every 20 s while some wait.
  const granting = useRef(new Set<string>());
  const [grantTick, setGrantTick] = useState(0);
  useEffect(() => {
    if (!state.hydrated || !state.staffCode) return;
    const waiting = (state.pendingGrants ?? []).filter((g) => !g.error && !granting.current.has(g.gid));
    waiting.forEach((g) => {
      granting.current.add(g.gid);
      grantRemoteOnce(state.staffCode, { id: g.memberId, name: g.name, phone: g.phone, membership: g.membership, gid: g.gid }).then((r) => {
        granting.current.delete(g.gid);
        if (r.status >= 200 && r.status < 300) setState((s) => ({ ...s, pendingGrants: (s.pendingGrants ?? []).filter((x) => x.gid !== g.gid) }));
        // refused for good (not a lost connection): kept with the reason, the desk sees it and asks the manager
        else if (r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 429) setState((s) => ({ ...s, pendingGrants: (s.pendingGrants ?? []).map((x) => (x.gid === g.gid ? { ...x, error: r.error || String(r.status) } : x)) }));
      });
    });
    if (!(state.pendingGrants ?? []).some((g) => !g.error)) return;
    const t = setTimeout(() => setGrantTick((n) => n + 1), 20000);
    return () => clearTimeout(t);
  }, [state.hydrated, state.staffCode, state.pendingGrants, grantTick]);
  const dismissGrant = useCallback((gid: string) => setState((s) => ({ ...s, pendingGrants: (s.pendingGrants ?? []).filter((x) => x.gid !== gid) })), []);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const pushTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /** Administrators change content: it shows on this device at once and goes to the server after the last edit. */
  const saveContent = useCallback((section: ContentSection, data: unknown) => {
    const content = { ...stateRef.current.content, [section]: data } as Content;
    applyContent(content);
    setState((s) => ({ ...s, content, contentStatus: 'saving' }));
    clearTimeout(pushTimers.current[section]);
    pushTimers.current[section] = setTimeout(async () => {
      const { staffCode, staff } = stateRef.current;
      const ok = staffCode ? await saveContentRemote(staffCode, section, data, staff?.name ?? 'owner') : null;
      setState((s) => ({ ...s, contentStatus: ok ? 'ok' : 'fail' }));
    }, 700);
  }, []);

  // Shop edits (stored in their own fields) travel to the server as the "catalog" section.
  useEffect(() => {
    if (!state.hydrated || !state.staffCode || !catalogDirty.current) return;
    const cur = { custom: state.customProducts, overrides: state.productOverrides, hidden: state.hiddenProducts };
    const known = state.content.catalog ?? { custom: [], overrides: {}, hidden: [] };
    if (JSON.stringify(cur) === JSON.stringify(known)) {
      catalogDirty.current = false;
      return;
    }
    // Sending this phone's whole list would put back whatever it had before other phones' edits (a barcode added elsewhere
    // would vanish). So the server's latest list is taken and only the products edited here are laid over it.
    // ponytail: a few seconds' window where two phones saving the same moment can still cross; a per-product server op closes it.
    // The edited ids are kept for the session: a second edit saved before the first reached the server still carries the first.
    catalogDirty.current = false;
    void fetchContent(state.staffCode).then((fresh) => {
      const ids = [...touched.current];
      const now = stateRef.current;
      const cur = { custom: now.customProducts, overrides: now.productOverrides, hidden: now.hiddenProducts };
      const base = fresh?.catalog ?? known;
      const custom = base.custom.filter((p) => !ids.includes(p.id));
      const overrides = { ...base.overrides };
      let hidden = base.hidden.filter((id) => !ids.includes(id));
      for (const id of ids) {
        const mine = cur.custom.find((p) => p.id === id);
        if (mine) custom.unshift(mine);
        if (cur.overrides[id]) overrides[id] = cur.overrides[id];
        else delete overrides[id];
        if (cur.hidden.includes(id)) hidden = [...hidden, id];
      }
      const merged = { custom, overrides, hidden };
      setState((s) => ({ ...s, customProducts: custom, productOverrides: overrides, hiddenProducts: hidden }));
      saveContent('catalog', merged);
    });
  }, [state.hydrated, state.staffCode, state.customProducts, state.productOverrides, state.hiddenProducts, state.content.catalog, saveContent]);

  const trainerLogin = useCallback(async (trainerId: string, pin: string) => {
    const r = await trainerLoginRemote(trainerId, pin);
    if (r.status === 'ok') setState((s) => ({ ...s, trainerAuth: { id: trainerId, token: r.token } }));
    return r.status;
  }, []);
  const setAutoAdmit = useCallback((v: boolean) => setState((s) => ({ ...s, autoAdmit: v })), []);
  const trainerLogout = useCallback(() => setState((s) => ({ ...s, trainerAuth: null })), []);

  /** Owner: save the list of clubs (add a branch, edit one, switch one off). */
  const saveClubConfig = useCallback(
    async (list: ClubConfig[]) => {
      if (!state.staffCode) return false;
      const ok = await saveClubs(state.staffCode, list);
      if (ok) {
        applyClubConfig(list);
        setState((s) => ({ ...s, clubConfig: list }));
      }
      return !!ok;
    },
    [state.staffCode],
  );

  const setPlanPrice = useCallback(
    (planId: string, price: number, oldPrice?: number) => {
      const cur = stateRef.current.content.plans ?? { overrides: {}, custom: [], hidden: [] };
      const isCustom = cur.custom.some((p) => p.id === planId);
      const next = isCustom
        ? { ...cur, custom: cur.custom.map((p) => (p.id === planId ? { ...p, price, oldPrice } : p)) }
        : { ...cur, overrides: { ...cur.overrides, [planId]: { ...cur.overrides[planId], price, oldPrice } } };
      saveContent('plans', next);
    },
    [saveContent],
  );

  /** Cash register: one receipt per sale, shown to the owner under payments. */
  const recordSale = useCallback((sale: Omit<Sale, 'id' | 'ts' | 'clubId' | 'staff'>) => {
    setState((s) => ({ ...s, sales: [{ ...sale, id: `R${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), clubId: s.staff?.clubId ?? 'c1', staff: s.staff?.name ?? '' }, ...s.sales] }));
  }, []);

  const freezeMembership = useCallback(
    async (days: number) => {
      if (!state.user || !state.token) return false;
      const next = await freezeRemote(state.user.id, days, { token: state.token });
      if (!next) return false;
      setState((s) => ({ ...s, membership: next }));
      return true;
    },
    [state.user, state.token],
  );

  const unfreezeMembership = useCallback(() => freezeMembership(0), [freezeMembership]);

  const staffFreeze = useCallback(
    async (memberId: string, days: number) => {
      if (!state.staffCode) return false;
      const next = await freezeRemote(memberId, days, { code: state.staffCode });
      if (!next) return false;
      setState((s) => ({ ...s, remote: s.remote.map((x) => (x.id === memberId ? { ...x, membership: next } : x)), ...(s.user?.id === memberId ? { membership: next } : {}) }));
      return true;
    },
    [state.staffCode],
  );

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
      dismissGrant,
      moveClient,
      deleteClient,
      renameClient,
      editMembership,
      changePlan,
      recordSale,
      refreshSales,
      refreshContent,
      saveClubConfig,
      saveContent,
      trainerLogin,
      trainerLogout,
      setAutoAdmit,
      setPlanPrice,
      freezeMembership,
      unfreezeMembership,
      staffFreeze,
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
      cancelOrder,
      upsertProduct,
      deleteProduct,
      restoreProduct,
    }),
    [state, login, restore, logout, updateUser, completeOnboarding, grantPlan, dismissGrant, moveClient, deleteClient, renameClient, editMembership, changePlan, recordSale, refreshSales, refreshContent, saveClubConfig, saveContent, trainerLogin, trainerLogout, setAutoAdmit, setPlanPrice, freezeMembership, unfreezeMembership, staffFreeze, book, cancelBooking, toggleFavorite, checkIn, logWeight, addToCart, setCartQty, removeFromCart, clearCart, placeOrder, addCoachMessage, clearCoachChat, setCoachPlan, setCoachApiKey, setLang, staffLogin, staffLogout, ownerLogin, ownerLogout, setStaffClub, logCheckin, checkoutMember, toggleAttendance, setOrderStatus, cancelOrder, upsertProduct, deleteProduct, restoreProduct]
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
      return { active: false, daysLeft: 0, frozen: false, plan: undefined, totalDays: 0, progress: 0, endDate: undefined as string | undefined, visitsLeft: undefined as number | undefined };
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
      visitsLeft: membership.visitsLeft,
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
  frozenUntil?: string;
  dayOnly: boolean;
  homeClubId: string;
  visitsThisMonth: number;
  note?: string;
  onefitVisits?: number; // came through 1Fit this many times
  onefitLast?: string; // the last 1Fit visit, a day
  isSelf: boolean;
  since: string;
  lastVisit?: string;
  visitsTotal: number;
  age: number;
  goal?: Goal;
  trainerId?: string;
  freezeDaysLeft: number;
  freezesLeft?: number;
  freezeMax?: number;
  visitsLeft?: number;
  pendingActivation: boolean; // an imported pass that starts at the first entry
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
        frozenUntil: m.frozenUntil,
        dayOnly: !!plan?.dayOnly,
        homeClubId: m.homeClubId,
        visitsThisMonth: m.visitsThisMonth,
        note: m.note,
        onefitVisits: m.onefitVisits,
        onefitLast: m.onefitLast,
        isSelf,
        since: m.since,
        lastVisit: m.lastVisit,
        visitsTotal: m.visitsTotal,
        age: m.age,
        goal: m.goal,
        trainerId: m.trainerId,
        freezeDaysLeft: m.freezeDaysLeft,
        freezesLeft: m.freezesLeft,
        freezeMax: m.freezeMax,
        visitsLeft: m.visitsLeft,
        pendingActivation: !!m.pendingActivation,
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
        const info = build({ id: r.id, name: r.name, phone: r.phone, planId: r.membership?.planId ?? r.pending?.planId, endDate: r.membership?.endDate ?? (r.pending ? toISODate(addDays(today, r.pending.days)) : undefined), pendingActivation: !!r.pending && !r.membership, frozenUntil: r.membership?.frozenUntil, homeClubId: r.homeClubId, visitsThisMonth: 0, note: r.note, onefitVisits: r.onefit?.length || (r.note === '1Fit' ? 0 : undefined), onefitLast: r.onefit?.length ? r.onefit[r.onefit.length - 1].d : undefined, trialUsed: r.trialUsed, since: r.since, visitsTotal: 0, age: r.profile?.age ?? 0, goal: r.profile?.goal as Goal | undefined, freezeDaysLeft: r.membership?.freezeDaysLeft ?? 0, freezesLeft: r.membership?.freezesLeft, freezeMax: r.membership?.freezeMax, visitsLeft: r.membership?.visitsLeft ?? r.pending?.visitsLeft }, false);
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
        freezesLeft: membership?.freezesLeft,
        freezeMax: membership?.freezeMax,
        visitsLeft: membership?.visitsLeft,
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
  const { content } = useApp();
  // The module list is edited in place by applyContent; this re-reads it whenever the plan content changes.
  return useMemo(() => plans.filter((p) => !p.legacy), [content.plans]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** All payments: demo history plus those recorded on this device. Newest first. */
/** Raw payment rows: what this device recorded plus the shared books; the server copy wins. Newest first. */
export function useRawSales() {
  const { sales, serverSales } = useApp();
  return useMemo(() => {
    const byId = new Map<string, Sale>();
    [...sales, ...mockSales].forEach((x) => byId.set(x.id, x));
    (serverSales ?? []).forEach((x) => byId.set(x.id, x));
    return [...byId.values()].sort((a, b) => b.ts - a.ts);
  }, [sales, serverSales]);
}

/** Payments with `amount` already meaning income: refunds and open debts are negative, so every sum on screen is net. */
export function useSales() {
  const raw = useRawSales();
  return useMemo(() => raw.map((x) => ({ ...x, amount: saleValue(x) })), [raw]);
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

/** One club's shelf; the first counts were one shelf (product -> units) and belong to the first club. */
export function clubStock(stock: Content['stock'] | Record<string, number> | undefined, clubId: string): Record<string, number> | undefined {
  if (!stock) return undefined;
  if (Object.values(stock).some((v) => typeof v === 'number')) return clubId === 'c1' ? (stock as Record<string, number>) : undefined;
  return (stock as Record<string, Record<string, number>>)[clubId];
}

/** Shop catalog as members see it, with staff edits applied. */
export function useCatalog() {
  const { customProducts, productOverrides, hiddenProducts, content, staff } = useApp();
  const stock = clubStock(content.stock, staff?.clubId ?? 'c1');
  return useMemo(() => {
    const c = catalogOf({ customProducts, productOverrides, hiddenProducts });
    const withStock = (p: Product): Product => (stock && p.id in stock ? { ...p, stock: stock[p.id] } : p);
    const all = c.all.map(withStock);
    return { products: c.visible.map(withStock), all, hidden: hiddenProducts, byId: (id: string) => all.find((p) => p.id === id), isCustom: (id: string) => customProducts.some((p) => p.id === id) };
  }, [customProducts, productOverrides, hiddenProducts, stock]);
}

/** How full each club is now: people inside (from the server's entries and exits) over the club's lockers. */
export function useOccupancy() {
  const [inside, setInside] = useState<Record<string, number>>({});
  const { staffLog } = useApp();
  // asked every 15 seconds and right after an entry marked on this phone, so a client who came in shows at once
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let live = true;
    const go = () => fetchOccupancy().then((o) => live && o && setInside(o));
    void go();
    const again = setTimeout(go, 2500); // the entry reaches the server a moment after it is marked here
    return () => {
      live = false;
      clearTimeout(again);
    };
  }, [tick, staffLog.length]);
  return useCallback(
    (clubId: string) => {
      const n = inside[clubId] ?? 0;
      const cap = clubCapacity[clubId] ?? 50;
      return { inside: n, capacity: cap, pct: Math.min(100, Math.round((n / cap) * 100)) };
    },
    [inside],
  );
}

/** The shop's categories: the built-in ones, then every other one a product carries (added by the manager). */
export function useShopCategories() {
  const { all } = useCatalog();
  return useMemo(() => {
    const known = new Set(shopCategories.map((c) => c.key));
    const extra = [...new Set(all.map((p) => p.category).filter((c) => c && !known.has(c)))].sort((a, b) => a.localeCompare(b, 'ru'));
    return [...shopCategories, ...extra.map((key) => ({ key, icon: 'pricetag-outline' }))];
  }, [all]);
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
    const code = promo ? promo.trim().toUpperCase() : '';
    const live = code ? promoByCode(code, toISODate(new Date())) : undefined;
    const promoRate = code ? PROMO_CODES[code] ?? 0 : 0;
    const memberRate = membership.active ? MEMBER_DISCOUNT : 0;
    const promoOff = Math.max(Math.round(subtotal * promoRate), live ? promoDiscount(live, subtotal) : 0);
    const memberOff = Math.round(subtotal * memberRate);
    const discount = Math.max(memberOff, promoOff);
    return {
      lines,
      count: cart.reduce((n, c) => n + c.qty, 0),
      subtotal,
      discount,
      total: subtotal - discount,
      discountSource: discount === 0 ? null : promoOff > memberOff ? ('promo' as const) : ('member' as const),
      promoValid: promoOff > 0,
    };
  }, [cart, membership.active, promo, byId]);
}

/** Current time that refreshes every 30 s, for "who is inside" views. */
/** The manager and the owner edit goods, prices and content and confirm money going back; the administrator only runs the desk. */
export function useCanManage() {
  const { staff, owner } = useApp();
  return owner || staff?.role === 'manager';
}

export function useNow() {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    // The first tick comes at once: the server's clock is known only after the first answer, so the mount value may be the device's.
    const first = setTimeout(() => setNow(serverNow()), 1500);
    const iv = setInterval(() => setNow(serverNow()), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
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
