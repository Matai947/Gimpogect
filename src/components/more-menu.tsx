import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type MoreItem = { href: string; icon: IconName; title: string; badge?: number; show?: boolean };

/** On a phone: the sections that do not fit in the tab bar, as big buttons. */
export function MoreMenu({ items, accent }: { items: MoreItem[]; accent: string }) {
  return (
    <>
      {items
        .filter((i) => i.show !== false)
        .map((i) => (
          <Pressable key={i.href} onPress={() => router.push(i.href as Href)} style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
            <View style={[styles.icon, { backgroundColor: accent + '1A' }]}>
              <Ionicons name={i.icon} size={24} color={accent} />
            </View>
            <T type="body" style={{ flex: 1, fontWeight: '700' }}>
              {i.title}
            </T>
            {i.badge ? (
              <View style={[styles.badge, { backgroundColor: accent }]}>
                <T type="small" color={Colors.onAccent} style={{ fontWeight: '800' }}>
                  {i.badge}
                </T>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </Pressable>
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 64, paddingHorizontal: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
