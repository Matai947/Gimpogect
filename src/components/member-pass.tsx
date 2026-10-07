import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDateLong } from '@/data/mock';
import { useI18n, useMembershipInfo } from '@/store/app-context';

/** Alatau ridge line: two layered silhouettes, drawn in a 360×90 box and stretched to fit. */
function Ridge({ color, back }: { color: string; back: string }) {
  return (
    <Svg width="100%" height={90} viewBox="0 0 360 90" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Path d="M0 70 L38 44 L62 56 L104 18 L132 40 L160 28 L196 58 L232 22 L262 46 L292 34 L326 60 L360 42 L360 90 L0 90 Z" fill={back} />
      <Path d="M0 82 L30 66 L58 74 L92 50 L118 64 L150 56 L184 76 L214 58 L248 70 L280 60 L318 78 L360 64 L360 90 L0 90 Z" fill={color} />
      {/* snow caps on the two highest peaks */}
      <Path d="M104 18 L94 27 L101 25 L108 30 L114 24 Z" fill="rgba(255,255,255,0.55)" />
      <Path d="M232 22 L222 31 L229 29 L236 34 L242 28 Z" fill="rgba(255,255,255,0.55)" />
    </Svg>
  );
}

/**
 * The membership pass: the one solid-gold object in the member app.
 * Reads like a physical club pass: tear line, big day count set in the display face, mountains at the foot.
 */
export function MemberPass() {
  const { t, tp, td } = useI18n();
  const m = useMembershipInfo();
  const active = m.active && !m.frozen;
  const bg = !m.active ? '#E9E4E6' : m.frozen ? '#DCE8F2' : Colors.accent;
  const ink = active ? Colors.onAccent : Colors.text;
  const inkSoft = active ? 'rgba(11,11,11,0.7)' : Colors.textSecondary;

  return (
    <Pressable onPress={() => router.push(m.active ? '/qr' : '/membership')} style={({ pressed }) => [styles.pass, { backgroundColor: bg }, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <T type="small" color={inkSoft} style={{ fontWeight: '600' }}>
            {m.active ? t('home_plan_name', { name: td(m.plan?.name ?? '—') }) : t('status_none')}
          </T>
          {m.active ? (
            <View style={styles.countRow}>
              <T type="display" color={ink} style={styles.count}>
                {m.daysLeft}
              </T>
              <T type="body" color={inkSoft} style={{ marginBottom: 10, fontWeight: '600' }}>
                {tp(m.daysLeft, 'days_pl')} {t('home_left')}
              </T>
            </View>
          ) : (
            <T type="title" color={ink} style={{ marginTop: 6 }}>
              {t('home_no_plan_title')}
            </T>
          )}
        </View>
        <View style={[styles.qr, { borderColor: active ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)' }]}>
          <Ionicons name={m.active ? 'qr-code' : 'card-outline'} size={26} color={ink} />
        </View>
      </View>

      {/* tear line with side notches, like a ticket stub */}
      <View style={styles.tearRow}>
        <View style={[styles.notch, { left: -10 }]} />
        <View style={[styles.tear, { borderColor: active ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)' }]} />
        <View style={[styles.notch, { right: -10 }]} />
      </View>

      <View style={styles.bottom}>
        <T type="small" color={inkSoft} style={{ fontWeight: '600', flex: 1 }}>
          {m.active ? (m.frozen ? t('status_frozen') : t('home_valid_until', { date: m.endDate ? formatDateLong(m.endDate) : '—' })) : t('home_no_plan_sub')}
        </T>
        <T type="small" color={ink} style={{ fontWeight: '700' }}>
          {m.active ? t('home_qr') : t('home_choose_plan')}
        </T>
      </View>

      <View style={styles.ridge} pointerEvents="none">
        <Ridge color={active ? Colors.accentDark : 'rgba(0,0,0,0.25)'} back={active ? '#E3C96A' : 'rgba(0,0,0,0.12)'} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pass: { borderRadius: Radius.xl, overflow: 'hidden', paddingTop: Spacing.four, minHeight: 250 },
  top: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: Spacing.four, gap: Spacing.three },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 2 },
  count: { fontSize: 64, lineHeight: 70, letterSpacing: -2 },
  qr: { width: 52, height: 52, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tearRow: { height: 20, justifyContent: 'center', marginTop: Spacing.three },
  tear: { marginHorizontal: Spacing.four, borderTopWidth: 1.5, borderStyle: 'dashed' },
  notch: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.background },
  bottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: 6, gap: Spacing.two },
  ridge: { height: 90, marginTop: Spacing.two },
});
