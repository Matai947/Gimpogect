import type { Lang } from '@/i18n';
import { applyClubConfig, classTemplates, clubPhotoOverrides, currentClubConfig, plans, trainers, type ClassTemplate, type Plan, type Trainer } from '@/data/mock';
import type { Product } from '@/data/shop';
import { rules } from '@/data/rules';

/**
 * Everything the administrators can change without a developer. It lives on the server, every device
 * loads it at start, and this module lays it over the built-in data, in place (like the club list).
 */

export type PlanContent = { overrides: Record<string, Partial<Plan>>; custom: Plan[]; hidden: string[] };
/** A trainer as stored: the photo is an address on the server. */
export type TrainerCfg = Omit<Trainer, 'photo'> & { photoUrl?: string };
export type TrainerContent = { overrides: Record<string, Partial<TrainerCfg>>; custom: TrainerCfg[]; hidden: string[] };
export type CatalogContent = { custom: Product[]; overrides: Record<string, Product>; hidden: string[] };
export type Promo = {
  id: string;
  title: string;
  text: string;
  kind: 'percent' | 'amount' | 'info'; // percent / fixed amount off, or just an announcement
  value: number;
  code?: string; // promo code the client or the cashier types
  clubId: string; // 'all' or a club id
  start: string; // YYYY-MM-DD
  end: string;
  active: boolean;
  image?: string;
};

export type Content = {
  catalog?: CatalogContent;
  plans?: PlanContent;
  trainers?: TrainerContent;
  rules?: Partial<Record<Lang, string[]>>;
  classes?: ClassTemplate[];
  promos?: Promo[];
  photos?: Record<string, string[]>; // club id -> photo addresses
};

export type ContentSection = keyof Content;

const BASE_PLANS: Plan[] = plans.map((p) => ({ ...p }));
const BASE_TRAINERS: Trainer[] = trainers.map((t) => ({ ...t }));
const BASE_RULES: Record<Lang, string[]> = { ru: [...rules.ru], kk: [...rules.kk], en: [...rules.en] };

/** The active promotions shown to clients; replaced in place when the server list arrives. */
export const promos: Promo[] = [];

export const withPerMonth = (p: Plan): Plan => ({ ...p, perMonth: p.months ? Math.round(p.price / p.months) : p.price });

export function applyContent(c: Content) {
  const pc = c.plans;
  const merged = [...BASE_PLANS.map((p) => withPerMonth({ ...p, ...(pc?.overrides[p.id] ?? {}) })), ...(pc?.custom ?? []).map(withPerMonth)];
  // A hidden plan stays resolvable for the members who already have it; it only leaves the sale lists.
  plans.splice(0, plans.length, ...merged.map((p) => (pc?.hidden.includes(p.id) ? { ...p, legacy: true } : p)));

  const tc = c.trainers;
  const toTrainer = (t: TrainerCfg, base?: Trainer): Trainer => {
    const { photoUrl, ...rest } = t;
    return { ...(base ?? {}), ...rest, photo: photoUrl === '' ? undefined : photoUrl ? { uri: photoUrl } : base?.photo } as Trainer;
  };
  const trainerList = [...BASE_TRAINERS.map((b) => toTrainer({ ...b, ...(tc?.overrides[b.id] ?? {}) } as TrainerCfg, b)), ...(tc?.custom ?? []).map((t) => toTrainer(t))].filter((t) => !tc?.hidden.includes(t.id));
  trainers.splice(0, trainers.length, ...trainerList);

  (['ru', 'kk', 'en'] as Lang[]).forEach((l) => {
    const custom = c.rules?.[l];
    rules[l] = custom && custom.length ? custom : BASE_RULES[l];
  });

  classTemplates.splice(0, classTemplates.length, ...(c.classes ?? []));
  promos.splice(0, promos.length, ...(c.promos ?? []));

  // Club photos: remember the overrides, then rebuild the clubs so they take them.
  Object.keys(clubPhotoOverrides).forEach((k) => delete clubPhotoOverrides[k]);
  Object.entries(c.photos ?? {}).forEach(([id, list]) => list.length && (clubPhotoOverrides[id] = list));
  applyClubConfig(currentClubConfig());
}

/** Promotions that are on today for a club (the end day counts). */
export function activePromos(today: string, clubId?: string): Promo[] {
  return promos.filter((p) => p.active && p.start <= today && today <= p.end && (p.clubId === 'all' || !clubId || p.clubId === clubId));
}

/** Every plan the editor can open: built-in and added, with the edits laid over, hidden ones flagged. */
export function planCatalog(c: Content): (Plan & { hidden: boolean })[] {
  const pc = c.plans;
  return [...BASE_PLANS.map((p) => withPerMonth({ ...p, ...(pc?.overrides[p.id] ?? {}) })), ...(pc?.custom ?? []).map(withPerMonth)].map((p) => ({ ...p, hidden: !!pc?.hidden.includes(p.id) }));
}

/** Same for trainers. */
export function trainerCatalog(c: Content): (TrainerCfg & { hidden: boolean })[] {
  const tc = c.trainers;
  const cfgOf = (b: Trainer): TrainerCfg => {
    const { photo: _photo, ...rest } = b;
    return { ...rest };
  };
  return [...BASE_TRAINERS.map((b) => ({ ...cfgOf(b), ...(tc?.overrides[b.id] ?? {}) })), ...(tc?.custom ?? [])].map((t) => ({ ...t, hidden: !!tc?.hidden.includes(t.id) }));
}

/** The promotion a typed code belongs to, if it is on today for this club. */
export function promoByCode(code: string, today: string, clubId?: string): Promo | undefined {
  const c = code.trim().toUpperCase();
  return c ? activePromos(today, clubId).find((p) => p.code === c && p.kind !== 'info') : undefined;
}

/** What a promotion takes off a total. */
export const promoDiscount = (p: Promo, total: number): number => Math.max(0, Math.min(total, p.kind === 'percent' ? Math.round((total * p.value) / 100) : p.value));
