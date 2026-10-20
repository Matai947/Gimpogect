import type { Content, ContentSection } from '@/data/content';
import type { ClassTemplate, ClubConfig } from '@/data/mock';
import type { Sale } from '@/data/owner';

// Client registry API (functions/api/clients.js on Cloudflare Pages). Every call is best effort:
// the app keeps working offline and just stops syncing.
// The web build talks to the server it was loaded from; native builds use the public address.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (typeof location !== 'undefined' && location.protocol === 'https:' ? location.origin : 'https://gym.matai.kz');

export type RemoteMembership = { planId: string; startDate: string; endDate: string; freezeDaysLeft: number; frozenUntil?: string; visitsLeft?: number; dayOnly?: boolean };
export type RemoteProfile = { age?: number; goal?: string; heightCm?: number; weightKg?: number; targetWeightKg?: number; gender?: string; level?: string; daysPerWeek?: number };
export type RemoteSession = { clubId: string; inTs: number; outTs?: number };
export type OneFitVisit = { d: string; c: string; ts: number };
export type RemoteClient = { id: string; onefit?: OneFitVisit[]; name: string; phone: string; homeClubId: string; since: string; note?: string; trialUsed?: boolean; pending?: { planId: string; days: number; freezeDays?: number; visitsLeft?: number; dayOnly?: boolean }; membership?: RemoteMembership; profile?: RemoteProfile; session?: RemoteSession };
export type RemoteMe = { membership: RemoteMembership | null; name: string | null; homeClubId: string | null; profile: RemoteProfile | null };
export type Lead = { name: string; phone: string; clubId: string; lang: string; ts: number };

type Init = { method?: 'POST'; body?: unknown; code?: string; token?: string; trainerToken?: string; query?: string };

async function raw(op: string, init?: Init): Promise<{ status: number; data: unknown }> {
  try {
    const res = await fetch(`${BASE}/api/clients?op=${op}${init?.query ?? ''}`, {
      method: init?.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(init?.code ? { 'x-code': init.code } : {}), ...(init?.token ? { 'x-token': init.token } : {}), ...(init?.trainerToken ? { 'x-trainer': init.trainerToken } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  } catch {
    return { status: 0, data: null };
  }
}

async function call<T>(op: string, init?: Init): Promise<T | null> {
  const r = await raw(op, init);
  return r.status >= 200 && r.status < 300 ? (r.data as T) : null;
}

/** Create an account (with a password) or update your own (with the token). */
export const registerClient = (c: { id: string; name: string; phone: string; homeClubId: string; profile?: RemoteProfile; password?: string }, token?: string) =>
  call<{ membership: RemoteMembership | null; token?: string }>('register', { method: 'POST', body: c, token });

/** Phone + password. status 404 = unknown phone, 401 = wrong password, 0 = offline. */
export const loginClient = async (id: string, password: string) => {
  const r = await raw('login', { method: 'POST', body: { id, password } });
  return { status: r.status, data: r.status === 200 ? (r.data as { token: string; account: RemoteMe }) : null };
};

export const fetchMyMembership = (id: string, token: string) => call<RemoteMe>('me', { query: `&id=${id}`, token });

/** A fresh single-use proof for the client's own QR (valid 90 seconds). */
export const fetchQrProof = async (id: string, token: string) => (await call<{ code: string }>('qr', { token, query: `&id=${id}` }))?.code ?? null;

export const fetchLeads = async (code: string) => (await call<{ leads: Lead[] }>('leads', { code }))?.leads ?? null;

export const fetchClients = async (code: string) => (await call<{ clients: RemoteClient[] }>('list', { code }))?.clients ?? null;

/** Front desk: a 1Fit member walks in. Creates the card if needed and records one 1Fit visit for the day. */
export const onefitRemote = (code: string, b: { name: string; phone: string; clubId: string }) => call<{ ok: true; id: string; name: string; duplicate?: boolean }>('onefit', { method: 'POST', code, body: b });

/** Register payments, kept on the server so every device and the owner see the same books. */
export const postSale = (code: string, s: Sale) => call<{ ok: true }>('sale', { method: 'POST', code, body: s });
export const fetchSales = async (code: string, days = 120) => (await call<{ sales: Sale[] }>('sales', { code, query: `&days=${days}` }))?.sales ?? null;

export type VisitRow = { ts: number; club: string; member: string; kind: string };
export const fetchVisits = async (code: string, days = 60) => (await call<{ visits: VisitRow[] }>('visits', { code, query: `&days=${days}` }))?.visits ?? null;

/** Owner only: return money for a sale (the whole rest, or a part). */
export const refundRemote = (code: string, saleId: string, reason: string, amount?: number) => call<{ ok: true }>('refund', { method: 'POST', code, body: { saleId, amount, reason } });

/** Front desk: the client pays (part of) a debt. */
export const settleRemote = (code: string, debtId: string, amount: number, method: string, staff: string) => call<{ ok: true }>('settle', { method: 'POST', code, body: { debtId, amount, method, staff } });

export type TrainerLoad = { id: string; trainerId: string; clubId: string; date: string; sessions: number; note?: string; staff?: string };
/** Administrators record how many sessions a trainer worked (the schedule itself is not in the system). */
export const postLoad = (code: string, b: { trainerId: string; clubId: string; date: string; sessions: number; note: string; staff: string }) => call<{ ok: true; id: string }>('load', { method: 'POST', code, body: b });
export const fetchLoads = async (code: string, days = 60) => (await call<{ loads: TrainerLoad[] }>('loads', { code, query: `&days=${days}` }))?.loads ?? null;
export const deleteLoad = (code: string, id: string) => call<{ ok: true }>('load-del', { method: 'POST', code, body: { id } });

/** Administrators' shifts: "I have arrived" starts one, "I finish my shift" closes it. auto = the person forgot to close it. */
export type Shift = { id: string; staff: string; clubId: string; start: number; end: number | null; auto?: boolean };
export const startShift = (code: string, b: { staff: string; clubId: string }) => call<{ ok: true; id: string; start: number }>('shift-start', { method: 'POST', code, body: b });
export const endShift = (code: string, id: string) => call<{ ok: true; end: number }>('shift-end', { method: 'POST', code, body: { id } });
export const fetchShifts = async (code: string, days = 30) => (await call<{ shifts: Shift[] }>('shifts', { code, query: `&days=${days}` }))?.shifts ?? null;

/** The cash drawer of a club: opened with a count, money taken out, closed with a count. */
export type CashDrawer = { id: string; clubId: string; staff: string; open: number; openCash: number; outs: { ts: number; amount: number; note: string; staff: string }[]; close: number | null; counted?: number; expected: number; cashIn: number; refunds: number; taken?: number };
export const fetchCash = async (code: string, clubId: string) => (await call<{ drawer: CashDrawer | null }>('cash', { code, query: `&clubId=${clubId}` }))?.drawer;
export const cashOpen = async (code: string, b: { clubId: string; staff: string; amount: number }) => (await call<{ drawer: CashDrawer }>('cash-open', { method: 'POST', code, body: b }))?.drawer ?? null;
export const cashOut = async (code: string, b: { id: string; amount: number; note: string; staff: string }) => (await call<{ drawer: CashDrawer }>('cash-out', { method: 'POST', code, body: b }))?.drawer ?? null;
export const cashClose = async (code: string, b: { id: string; counted: number; staff: string }) => (await call<{ drawer: CashDrawer }>('cash-close', { method: 'POST', code, body: b }))?.drawer ?? null;
export const fetchCashes = async (code: string, days = 30) => (await call<{ cashes: CashDrawer[] }>('cashes', { code, query: `&days=${days}` }))?.cashes ?? null;

/** Editable content (prices, plans, trainers, rules, schedule, promotions, photos), as the administrators set it. */
export const fetchContent = async () => (await call<{ content: Content }>('content'))?.content ?? null;
export const saveContentRemote = (code: string, section: ContentSection, data: unknown, by: string) => call<{ ok: true }>('content-save', { method: 'POST', code, body: { section, data, by } });
/** Uploads a photo (base64) to the public media bucket and returns its address. */
export const uploadPhoto = async (code: string, ext: string, base64: string) => (await call<{ url: string }>('upload', { method: 'POST', code, body: { ext, data: base64 } }))?.url ?? null;

/** The network's clubs, as the owner set them (empty until the owner saves a list). */
export const fetchClubs = async () => (await call<{ clubs: ClubConfig[] }>('clubs'))?.clubs ?? null;
/** Owner only: adds or edits branches. */
export const saveClubs = (code: string, clubs: ClubConfig[]) => call<{ ok: true }>('clubs-save', { method: 'POST', code, body: { clubs } });

/** A trainer signs in with the PIN the administrators gave them. */
export async function trainerLoginRemote(trainerId: string, pin: string): Promise<{ status: 'ok'; token: string } | { status: 'wrong' | 'locked' | 'nopin' | 'offline' }> {
  const r = await raw('trainer-login', { method: 'POST', body: { trainerId, pin } });
  if (r.status === 200 && (r.data as { token?: string })?.token) return { status: 'ok', token: (r.data as { token: string }).token };
  return { status: r.status === 401 ? 'wrong' : r.status === 429 ? 'locked' : r.status === 404 ? 'nopin' : 'offline' };
}

export type Appointment = { id: string; trainerId: string; clubId: string; clientId: string; clientName: string; clientPhone: string; kind: 'weekly' | 'once'; weekdays: number[]; date: string; time: string; durationMin: number; note: string; active: boolean };
export type TrainerMe = { classes: ClassTemplate[]; appointments: Appointment[]; sessions: TrainerLoad[]; clients: { name: string; ts: number; club: string }[] };

/** Front desk: give a trainer a client and a time. The trainer sees it in their cabinet. */
export const saveAppt = (code: string, a: Omit<Appointment, 'id' | 'active'> & { id?: string }) => call<{ ok: true; id: string }>('appt-save', { method: 'POST', code, body: a });
export const fetchAppts = async (code: string) => (await call<{ appts: Appointment[] }>('appts', { code }))?.appts ?? null;
export const deleteAppt = (code: string, id: string) => call<{ ok: true }>('appt-del', { method: 'POST', code, body: { id } });
/** The signed-in trainer's own classes, recorded sessions and personal clients. null = expired or offline. */
export const fetchTrainerMe = (trainerToken: string) => call<TrainerMe>('trainer-me', { trainerToken });

/** Administrators give a trainer a PIN (4–8 digits). It cannot be read back, only replaced. */
export const setTrainerPin = (code: string, trainerId: string, pin: string) => call<{ ok: true }>('trainer-pin', { method: 'POST', code, body: { trainerId, pin } });
/** Switch a trainer's sign-in off: the PIN is deleted and the trainer's open sessions end. */
export const clearTrainerPin = (code: string, trainerId: string) => call<{ ok: true }>('trainer-pin-clear', { method: 'POST', code, body: { trainerId } });
export const fetchTrainerPins = async (code: string) => (await call<{ set: string[] }>('trainer-pins', { code }))?.set ?? null;

export const grantRemote = (code: string, c: { id: string; name: string; phone: string; membership: RemoteMembership }) => call<{ ok: true }>('grant', { method: 'POST', code, body: c });

/** Records an entry. With the client's QR proof the server checks it first (automatic entry); without it the desk admits by hand. */
export const checkinRemote = (code: string, id: string, clubId: string, qr?: string) => call<{ ok: true; visitsLeft?: number; membership?: RemoteMembership | null }>('checkin', { method: 'POST', code, body: { id, clubId, ...(qr ? { qr } : {}) } });

export const checkoutRemote = (code: string, id: string) => call<{ ok: true }>('checkout', { method: 'POST', code, body: { id } });

/** Front desk: forget a client's password so they can set a new one. */
export const resetPasswordRemote = (code: string, id: string) => call<{ ok: true }>('reset-password', { method: 'POST', code, body: { id } });
