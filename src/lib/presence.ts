import type { CheckinEntry } from '@/store/app-context';

/** A member may stay this long after a successful check-in, then counts as having left. */
export const STAY_MIN = 120;

export type Presence = {
  memberId: string;
  name: string;
  clubId: string;
  since: number; // check-in time
  until: number; // when the stay ends: the explicit exit, or the allowed stay running out
  inside: boolean;
  auto: boolean; // left because the time ran out, not because staff marked the exit
};

/**
 * Who is in the gym, derived from the check-in log (newest first). One row per member, using their
 * latest successful entry; an explicit exit entry after it ends the stay early.
 */
export function presenceOf(log: CheckinEntry[], now: number): Presence[] {
  const seen = new Set<string>();
  const out: Presence[] = [];
  for (const e of log) {
    if (seen.has(e.memberId) || !e.ok) continue;
    if (e.out) {
      // The latest event is an exit: the matching entry is the next older check-in.
      const entry = log.find((x) => x.memberId === e.memberId && x.ok && !x.out && x.ts < e.ts);
      seen.add(e.memberId);
      if (entry) out.push({ memberId: e.memberId, name: e.name, clubId: entry.clubId, since: entry.ts, until: e.ts, inside: false, auto: false });
      continue;
    }
    seen.add(e.memberId);
    const until = e.ts + STAY_MIN * 60000;
    out.push({ memberId: e.memberId, name: e.name, clubId: e.clubId, since: e.ts, until, inside: now < until, auto: now >= until });
  }
  return out;
}

export function minutesLeft(p: Presence, now: number) {
  return Math.max(0, Math.ceil((p.until - now) / 60000));
}
