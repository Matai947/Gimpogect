// Client registry API (api/clients.js on the Vercel deployment). Every call is best effort:
// the app keeps working offline and just stops syncing.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://gym.matai.kz';

export type RemoteMembership = { planId: string; startDate: string; endDate: string; freezeDaysLeft: number; frozenUntil?: string };
export type RemoteProfile = { age?: number; goal?: string; heightCm?: number; weightKg?: number };
export type RemoteClient = { id: string; name: string; phone: string; homeClubId: string; since: string; membership?: RemoteMembership; profile?: RemoteProfile };

async function call<T>(op: string, init?: { method?: 'POST'; body?: unknown; code?: string; query?: string }): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/api/clients?op=${op}${init?.query ?? ''}`, {
      method: init?.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(init?.code ? { 'x-code': init.code } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const registerClient = (c: { id: string; name: string; phone: string; homeClubId: string; profile?: RemoteProfile }) => call<{ membership: RemoteMembership | null }>('register', { method: 'POST', body: c });

export const fetchMyMembership = (id: string) => call<{ membership: RemoteMembership | null }>('me', { query: `&id=${id}` });

export const fetchClients = async (code: string) => (await call<{ clients: RemoteClient[] }>('list', { code }))?.clients ?? null;

export const grantRemote = (code: string, c: { id: string; name: string; phone: string; membership: RemoteMembership }) => call<{ ok: true }>('grant', { method: 'POST', code, body: c });
