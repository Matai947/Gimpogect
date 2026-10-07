import { Platform } from 'react-native';

/** Seven Gym brand book on a white base: onyx text, gold accent, light paper surfaces. */
export const Colors = {
  background: '#F6F6F6',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFEF',
  border: '#E4E4E4',
  text: '#0B0B0B',
  textSecondary: '#5F5F5F',
  textMuted: '#9A9A9A',
  accent: '#D4AF37',
  accentDark: '#B8952B',
  onAccent: '#0B0B0B',
  success: '#1F8A4C',
  warning: '#D9643A',
  danger: '#D63B47',
  info: '#C9A227',
} as const;

/** Tints of the accent for chips, icon wells and highlighted rows. */
export const Tint = {
  accent08: 'rgba(212,175,55,0.10)',
  accent12: 'rgba(212,175,55,0.16)',
  accent25: 'rgba(212,175,55,0.32)',
  accent45: 'rgba(212,175,55,0.5)',
} as const;

/**
 * Raleway (display) + Montserrat (text), per the brand book. Both cover Kazakh Cyrillic.
 * Custom fonts need one family per weight; `fontFor` maps a weight to the right file.
 */
export const FontFiles = {
  Raleway_700Bold: 'Raleway_700Bold',
  Raleway_800ExtraBold: 'Raleway_800ExtraBold',
  Montserrat_400Regular: 'Montserrat_400Regular',
  Montserrat_500Medium: 'Montserrat_500Medium',
  Montserrat_600SemiBold: 'Montserrat_600SemiBold',
  Montserrat_700Bold: 'Montserrat_700Bold',
  Montserrat_800ExtraBold: 'Montserrat_800ExtraBold',
} as const;

export type FontRole = 'display' | 'text';

export function fontFor(role: FontRole, weight?: string | number): string {
  const w = Number(weight ?? (role === 'display' ? 700 : 400)) || 400;
  if (role === 'display') return w >= 800 ? FontFiles.Raleway_800ExtraBold : FontFiles.Raleway_700Bold;
  if (w >= 800) return FontFiles.Montserrat_800ExtraBold;
  if (w >= 700) return FontFiles.Montserrat_700Bold;
  if (w >= 600) return FontFiles.Montserrat_600SemiBold;
  if (w >= 500) return FontFiles.Montserrat_500Medium;
  return FontFiles.Montserrat_400Regular;
}

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Radius follows hierarchy: controls are tight, containers softer, the pass the softest. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;
