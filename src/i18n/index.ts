import { translateData } from './data';
import { en } from './en';
import { kk } from './kk';
import { ru, type TKey } from './ru';

export type Lang = 'ru' | 'kk' | 'en';
export type { TKey };

export const languages: { key: Lang; label: string; short: string }[] = [
  { key: 'ru', label: 'Русский', short: 'RU' },
  { key: 'kk', label: 'Қазақша', short: 'KZ' },
  { key: 'en', label: 'English', short: 'EN' },
];

const dicts: Record<Lang, Record<TKey, string>> = { ru, kk, en };

/** Module-level current language so non-React helpers (date formatting) can read it. */
let current: Lang = 'ru';
export function setCurrentLang(l: Lang) {
  current = l;
}
export function getLang(): Lang {
  return current;
}

type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: TKey, vars?: Vars): string {
  let s: string = dicts[lang][key] ?? ru[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Picks the plural form for `n` from a '|'-separated key value. */
export function pluralForm(lang: Lang, n: number, key: TKey): string {
  const forms = translate(lang, key).split('|');
  if (forms.length === 1) return forms[0];
  const abs = Math.abs(Math.round(n));
  if (lang === 'en') return forms[abs === 1 ? 0 : 1];
  // Russian rules
  const m10 = abs % 10;
  const m100 = abs % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2] ?? forms[1];
}

export function tData(lang: Lang, value: string): string {
  return translateData(lang, value);
}

export function weekdayNames(lang: Lang = current): string[] {
  return translate(lang, 'weekdays').split('|');
}
export function monthNames(lang: Lang = current): string[] {
  return translate(lang, 'months').split('|');
}

/** Claude should answer in the UI language. */
export function languageName(lang: Lang): string {
  return lang === 'ru' ? 'русском' : lang === 'kk' ? 'казахском' : 'английском';
}
