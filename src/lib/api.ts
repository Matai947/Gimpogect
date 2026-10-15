import type { Content, ContentSection } from '@/data/content';
import type { ClubConfig } from '@/data/mock';
import type { Sale } from '@/data/owner';

// Client registry API (functions/api/clients.js on Cloudflare Pages). Every call is best effort:
// the app keeps working offline and just stops syncing.
// The web build talks to the server it was loaded from; native builds use the public address.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (typeof location !== 'undefined' && location.protocol === 'https:' ? location.origin : 'https://gym.matai.kz');

export type RemoteMembership = { planId: string; startDate: string; endDate: string; freezeDaysLeft: number; frozenUntil?: string; visitsLeft?: number };
export type RemoteProfile = { age?: number; goal?: string; heightCm?: number; weightKg?: number; targetWeightKg?: number; gender?: string; level?: string; daysPerWeek?: number };
export type RemoteSession = { clubId: string; inTs: number; outTs?: number };
export type OneFitVisit = { d: string; c: string; ts: number };
export type RemoteClient = { id: string; onefit?: OneFitVisit[]; name: string; phone: string; homeClubId: string; since: string; note?: string; membership?: RemoteMembership; profile?: RemoteProfile; session?: RemoteSession };
export type RemoteMe = { membership: RemoteMembership | null; name: string | null; homeClubId: string | null; profile: RemoteProfile | null };
export type Lead = { name: string; phone: string; clubId: string; lang: string; ts: number };

type Init = { method?: 'POST'; body?: unknown; code?: string; token?: string; query?: string };

async function raw(op: string, init?: Init): Promise<{ status: number; data: unknown }> {
  try {
    const res = await fetch(`${BASE}/api/clients?op=${op}${init?.query ?? ''}`, {
      method: init?.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(init?.code ? { 'x-code': init.code } : {}), ...(init?.token ? { 'x-token': init.token } : {}) },
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
export const refundRemote = (code: string, saleId: string, amount?: number) => call<{ ok: true }>('refund', { method: 'POST', code, body: { saleId, amount } });

/** Front desk: the client pays (part of) a debt. */
export const settleRemote = (code: string, debtId: string, amount: number, method: string, staff: string) => call<{ ok: true }>('settle', { method: 'POST', code, body: { debtId, amount, method, staff } });

export type TrainerLoad = { id: string; trainerId: string; clubId: string; date: string; sessions: number; note?: string; staff?: string };
/** Administrators record how many sessions a trainer worked (the schedule itself is not in the system). */
export const postLoad = (code: string, b: { trainerId: string; clubId: string; date: string; sessions: number; note: string; staff: string }) => call<{ ok: true; id: string }>('load', { method: 'POST', code, body: b });
export const fetchLoads = async (code: string, days = 60) => (await call<{ loads: TrainerLoad[] }>('loads', { code, query: `&days=${days}` }))?.loads ?? null;
export const deleteLoad = (code: string, id: string) => call<{ ok: true }>('load-del', { method: 'POST', code, body: { id } });

/** Editable content (prices, plans, trainers, rules, schedule, promotions, photos), as the administrators set it. */
export const fetchContent = async () => (await call<{ content: Content }>('content'))?.content ?? null;
export const saveContentRemote = (code: string, section: ContentSection, data: unknown, by: string) => call<{ ok: true }>('content-save', { method: 'POST', code, body: { section, data, by } });
/** Uploads a photo (base64) to the public media bucket and returns its address. */
export const uploadPhoto = async (code: string, ext: string, base64: string) => (await call<{ url: string }>('upload', { method: 'POST', code, body: { ext, data: base64 } }))?.url ?? null;

/** The network's clubs, as the owner set them (empty until the owner saves a list). */
export const fetchClubs = async () => (await call<{ clubs: ClubConfig[] }>('clubs'))?.clubs ?? null;
/** Owner only: adds or edits branches. */
export const saveClubs = (code: string, clubs: ClubConfig[]) => call<{ ok: true }>('clubs-save', { method: 'POST', code, body: { clubs } });

export const grantRemote = (code: string, c: { id: string; name: string; phone: string; membership: RemoteMembership }) => call<{ ok: true }>('grant', { method: 'POST', code, body: c });

export const checkinRemote = (code: string, id: string, clubId: string) => call<{ ok: true; visitsLeft?: number }>('checkin', { method: 'POST', code, body: { id, clubId } });

export const checkoutRemote = (code: string, id: string) => call<{ ok: true }>('checkout', { method: 'POST', code, body: { id } });

/** Front desk: forget a client's password so they can set a new one. */
export const resetPasswordRemote = (code: string, id: string) => call<{ ok: true }>('reset-password', { method: 'POST', code, body: { id } });
