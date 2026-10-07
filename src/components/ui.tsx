import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextProps, View, ViewProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colors, fontFor, Radius, Spacing, Tint, type FontRole } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/* ---------- Layout ---------- */

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scrollContent, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, padded = true }: ViewProps & { onPress?: () => void; padded?: boolean }) {
  const content = <View style={[styles.card, padded && { padding: Spacing.three }, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {content}
    </Pressable>
  );
}

export function Row({ children, style, gap = Spacing.two }: ViewProps & { gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider({ style }: ViewProps) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: Colors.border }, style]} />;
}

/* ---------- Typography ---------- */

type TType = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'small' | 'label';

const displayTypes: TType[] = ['display', 'title'];

export function T({ type = 'body', color, style, children, ...rest }: TextProps & { type?: TType; color?: string }) {
  // Custom fonts ship one file per weight: resolve the family from the effective weight
  // and drop fontWeight so Android does not fall back to the system font.
  const flat: TextStyle = StyleSheet.flatten([textStyles[type], style]) ?? {};
  const role: FontRole = displayTypes.includes(type) ? 'display' : 'text';
  const fontFamily = fontFor(role, flat.fontWeight);
  return (
    <Text style={[styles.text, textStyles[type], color ? { color } : null, style, { fontFamily, fontWeight: undefined }]} {...rest}>
      {children}
    </Text>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: Spacing.two }}>
      <T type="heading">{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <T type="label" color={Colors.accent}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </Row>
  );
}

/* ---------- Controls ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
  size = 'md',
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IoniconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const bg =
    variant === 'primary' ? Colors.accent : variant === 'secondary' ? Colors.surfaceAlt : variant === 'danger' ? 'rgba(240,96,93,0.15)' : 'transparent';
  const fg = variant === 'primary' ? Colors.onAccent : variant === 'danger' ? Colors.danger : Colors.text;
  const height = size === 'sm' ? 38 : size === 'lg' ? 56 : 48;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, height, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: Colors.border },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={fg} /> : null}
      <T type="label" color={fg} style={{ fontSize: size === 'sm' ? 14 : 16 }} numberOfLines={1}>
        {title}
      </T>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = Colors.text,
  bg = Colors.surfaceAlt,
  size = 44,
}: {
  icon: IoniconName;
  onPress?: () => void;
  color?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
      ]}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IoniconName }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: Colors.accent, borderColor: Colors.accent },
        pressed && { opacity: 0.8 },
      ]}>
      {icon ? <Ionicons name={icon} size={14} color={active ? Colors.onAccent : Colors.textSecondary} /> : null}
      <T type="small" color={active ? Colors.onAccent : Colors.text} style={{ fontWeight: '600' }}>
        {label}
      </T>
    </Pressable>
  );
}

export function ChipRow({ children, style }: ViewProps) {
  return (
    // Fixed height: on web a horizontal ScrollView reports 0 height and the rows pile onto each other.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 52 }} contentContainerStyle={[{ gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 4, alignItems: 'center' }, style]}>
      {children}
    </ScrollView>
  );
}

export function Badge({ label, color = Colors.accent, textColor }: { label: string; color?: string; textColor?: string }) {
  return (
    <View style={{ backgroundColor: color + '26', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill }}>
      <T type="small" color={textColor ?? color} style={{ fontWeight: '700' }}>
        {label}
      </T>
    </View>
  );
}

export function ProgressBar({ value, color = Colors.accent, height = 6, track = 'rgba(0,0,0,0.1)' }: { value: number; color?: string; height?: number; track?: string }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function Avatar({ name, size = 48, uri }: { name: string; size?: number; uri?: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri ? null : (
        <T type="label" color={Colors.accent} style={{ fontSize: size * 0.38 }}>
          {initials}
        </T>
      )}
    </View>
  );
}

export function StatTile({ value, label, icon, color = Colors.accent }: { value: string | number; label: string; icon?: IoniconName; color?: string }) {
  return (
    <View style={styles.statTile}>
      {icon ? <Ionicons name={icon} size={18} color={color} style={{ marginBottom: 6 }} /> : null}
      <T type="title" style={{ fontSize: 24 }}>
        {value}
      </T>
      <T type="small" color={Colors.textSecondary}>
        {label}
      </T>
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon: IoniconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: Colors.surfaceAlt }]}>
      <View style={[styles.listIcon, danger && { backgroundColor: 'rgba(240,96,93,0.15)' }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.danger : Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <T type="body" color={danger ? Colors.danger : Colors.text} style={{ fontWeight: '600' }}>
          {title}
        </T>
        {subtitle ? (
          <T type="small" color={Colors.textSecondary}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
    </Pressable>
  );
}

export function EmptyState({ icon, title, subtitle, action, onAction }: { icon: IoniconName; title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: Spacing.five, gap: Spacing.two }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={28} color={Colors.textSecondary} />
      </View>
      <T type="subheading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {subtitle ? (
        <T type="small" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 260 }}>
          {subtitle}
        </T>
      ) : null}
      {action ? <Button title={action} onPress={onAction} size="sm" style={{ marginTop: Spacing.two, paddingHorizontal: Spacing.four }} /> : null}
    </View>
  );
}

export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <Row gap={3}>
      <Ionicons name="star" size={size} color={Colors.warning} />
      <T type="small" style={{ fontWeight: '700' }}>
        {rating.toFixed(1)}
      </T>
    </Row>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.six },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  text: { color: Colors.text },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.three,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Tint.accent12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Unbounded is a wide face, so display sizes sit a step below a narrow sans.
const textStyles = StyleSheet.create({
  display: { fontSize: 30, fontWeight: '700', letterSpacing: -0.3, lineHeight: 36, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2, lineHeight: 28, textTransform: 'uppercase' },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, lineHeight: 24 },
  subheading: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  small: { fontSize: 12.5, lineHeight: 17 },
  label: { fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
});
