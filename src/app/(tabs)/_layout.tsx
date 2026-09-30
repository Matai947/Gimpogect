import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';

import { Colors } from '@/constants/theme';
import { useApp, useI18n } from '@/store/app-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type IconProps = { color: ColorValue; focused: boolean };

function TabIcon({ name, outline, color, focused }: IconProps & { name: IconName; outline: IconName }) {
  return <Ionicons name={focused ? name : outline} size={23} color={color as string} />;
}

/** The AI coach tab gets a raised lime badge so it reads as the app's signature feature. */
function CoachIcon({ focused }: IconProps) {
  return (
    <View style={[styles.coach, focused && styles.coachActive]}>
      <Ionicons name="sparkles" size={20} color={focused ? Colors.onAccent : Colors.accent} />
    </View>
  );
}

export default function TabsLayout() {
  const { user, hydrated, cart } = useApp();
  const { t } = useI18n();
  if (!hydrated) return null;
  if (!user) return <Redirect href="/auth" />;
  if (!user.profile) return <Redirect href="/onboarding" />;
  const cartCount = cart.reduce((n, c) => n + c.qty, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 86 : 68,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarAllowFontScaling: false,
        tabBarBadgeStyle: { backgroundColor: Colors.accent, color: Colors.onAccent, fontSize: 10, fontWeight: '800' },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tab_home'), tabBarIcon: (p: IconProps) => <TabIcon name="home" outline="home-outline" {...p} /> }} />
      <Tabs.Screen name="clubs" options={{ title: t('tab_clubs'), tabBarIcon: (p: IconProps) => <TabIcon name="location" outline="location-outline" {...p} /> }} />
      <Tabs.Screen name="schedule" options={{ title: t('tab_schedule'), tabBarIcon: (p: IconProps) => <TabIcon name="calendar" outline="calendar-outline" {...p} /> }} />
      <Tabs.Screen name="coach" options={{ title: t('tab_coach'), tabBarIcon: (p: IconProps) => <CoachIcon {...p} /> }} />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('tab_shop'),
          tabBarIcon: (p: IconProps) => <TabIcon name="bag-handle" outline="bag-handle-outline" {...p} />,
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: t('tab_profile'), tabBarIcon: (p: IconProps) => <TabIcon name="person" outline="person-outline" {...p} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  coach: { width: 36, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(198,255,61,0.45)', backgroundColor: 'rgba(198,255,61,0.08)' },
  coachActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
});
