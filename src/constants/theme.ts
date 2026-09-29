import { Platform } from 'react-native';

/** Brand palette: dark surfaces with a lime accent, typical for gym apps. */
export const Colors = {
  background: '#0B0F14',
  surface: '#151B23',
  surfaceAlt: '#1E2630',
  border: '#26303C',
  text: '#F2F5F8',
  textSecondary: '#8C97A5',
  textMuted: '#5B6673',
  accent: '#C6FF3D',
  accentDark: '#9ACC1F',
  onAccent: '#0B0F14',
  success: '#3DDC84',
  warning: '#FFB347',
  danger: '#FF5C5C',
  info: '#4DA3FF',
} as const;

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

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;
