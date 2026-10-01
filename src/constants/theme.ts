import { Platform } from 'react-native';

/** s89-style: carbon black base, white caps headlines, violet pill buttons, coral and yellow secondary accents. */
export const Colors = {
  background: '#0A0A0A',
  surface: '#1F1F1F',
  surfaceAlt: '#2A2A2A',
  border: '#333333',
  text: '#FFFFFF',
  textSecondary: '#B5B5B5',
  textMuted: '#777777',
  accent: '#9A3DCD',
  accentDark: '#7B2FB0',
  onAccent: '#FFFFFF',
  success: '#4CC38A',
  warning: '#FF8562',
  danger: '#E6424F',
  info: '#FFC736',
} as const;

/** Tints of the accent for chips, icon wells and highlighted rows. */
export const Tint = {
  accent08: 'rgba(154,61,205,0.08)',
  accent12: 'rgba(154,61,205,0.14)',
  accent25: 'rgba(154,61,205,0.3)',
  accent45: 'rgba(154,61,205,0.5)',
} as const;

/**
 * Unbounded (display) + Onest (text). Both ship Cyrillic Extended, so Kazakh letters render.
 * Custom fonts need one family per weight; `fontFor` maps a weight to the right file.
 */
export const FontFiles = {
  Unbounded_500Medium: 'Unbounded_500Medium',
  Unbounded_600SemiBold: 'Unbounded_600SemiBold',
  Unbounded_700Bold: 'Unbounded_700Bold',
  Onest_400Regular: 'Onest_400Regular',
  Onest_500Medium: 'Onest_500Medium',
  Onest_600SemiBold: 'Onest_600SemiBold',
  Onest_700Bold: 'Onest_700Bold',
  Onest_800ExtraBold: 'Onest_800ExtraBold',
} as const;

export type FontRole = 'display' | 'text';

export function fontFor(role: FontRole, weight?: string | number): string {
  const w = Number(weight ?? (role === 'display' ? 700 : 400)) || 400;
  if (role === 'display') return w >= 700 ? FontFiles.Unbounded_700Bold : w >= 600 ? FontFiles.Unbounded_600SemiBold : FontFiles.Unbounded_500Medium;
  if (w >= 800) return FontFiles.Onest_800ExtraBold;
  if (w >= 700) return FontFiles.Onest_700Bold;
  if (w >= 600) return FontFiles.Onest_600SemiBold;
  if (w >= 500) return FontFiles.Onest_500Medium;
  return FontFiles.Onest_400Regular;
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
