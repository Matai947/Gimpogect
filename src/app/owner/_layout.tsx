import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, useWindowDimensions, type ColorValue } from 'react-native';

import { OwnerAccent } from '@/components/owner-header';
import { Colors } from '@/constants/theme';
import { useApp, useI18n } from '@/store/app-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type IconProps = { color: ColorValue; focused: boolean };

function TabIcon({ name, outline, color, focused }: IconProps & { name: IconName; outline: IconName }) {
  return <Ionicons name={focused ? name : outline} size={23} color={color as string} />;
}

export default function OwnerLayout() {
  const { owner, accountant, hydrated } = useApp();
  const hide = accountant ? { href: null } : {};
  const { t } = useI18n();
  // a phone fits five tabs with readable names: the owner's safe, clubs and settings go under "More" (the accountant has four tabs, all fit)
  const phone = useWindowDimensions().width < 600 && !accountant;
  const side = phone ? { href: null } : {};
  if (!hydrated) return null;
  if (!owner) return <Redirect href="/staff-login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: OwnerAccent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: 'rgba(184,149,43,0.25)', height: Platform.OS === 'ios' ? 86 : 68, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold' },
        tabBarAllowFontScaling: false,
      }}>
      <Tabs.Screen name="index" options={{ title: t('tab_overview'), tabBarIcon: (p: IconProps) => <TabIcon name="stats-chart" outline="stats-chart-outline" {...p} /> }} />
      <Tabs.Screen name="clients" options={{ ...hide, title: t('tab_clients'), tabBarIcon: (p: IconProps) => <TabIcon name="people" outline="people-outline" {...p} /> }} />
      <Tabs.Screen name="sales" options={{ title: t('tab_sales'), tabBarIcon: (p: IconProps) => <TabIcon name="card" outline="card-outline" {...p} /> }} />
      <Tabs.Screen name="safe" options={{ ...side, title: t('tab_safe'), tabBarIcon: (p: IconProps) => <TabIcon name="lock-closed" outline="lock-closed-outline" {...p} /> }} />
      <Tabs.Screen name="reports" options={{ title: t('tab_reports'), tabBarIcon: (p: IconProps) => <TabIcon name="bar-chart" outline="bar-chart-outline" {...p} /> }} />
      <Tabs.Screen name="settings" options={{ ...hide, ...side, title: t('tab_settings'), tabBarIcon: (p: IconProps) => <TabIcon name="settings" outline="settings-outline" {...p} /> }} />
      <Tabs.Screen name="clubs" options={{ ...hide, ...side, title: t('tab_clubs_o'), tabBarIcon: (p: IconProps) => <TabIcon name="business" outline="business-outline" {...p} /> }} />
      <Tabs.Screen name="more" options={{ href: phone ? undefined : null, title: t('tab_more'), tabBarIcon: (p: IconProps) => <TabIcon name="grid" outline="grid-outline" {...p} /> }} />
    </Tabs>
  );
}
