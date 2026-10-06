import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { OwnerAccent } from '@/components/owner-header';
import { Colors } from '@/constants/theme';
import { useApp, useI18n } from '@/store/app-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type IconProps = { color: ColorValue; focused: boolean };

function TabIcon({ name, outline, color, focused }: IconProps & { name: IconName; outline: IconName }) {
  return <Ionicons name={focused ? name : outline} size={23} color={color as string} />;
}

export default function OwnerLayout() {
  const { owner, hydrated } = useApp();
  const { t } = useI18n();
  if (!hydrated) return null;
  if (!owner) return <Redirect href="/staff-login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: OwnerAccent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: '#141414', borderTopColor: 'rgba(255,199,54,0.25)', height: Platform.OS === 'ios' ? 86 : 68, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10, fontFamily: 'Onest_600SemiBold' },
        tabBarAllowFontScaling: false,
      }}>
      <Tabs.Screen name="index" options={{ title: t('tab_overview'), tabBarIcon: (p: IconProps) => <TabIcon name="stats-chart" outline="stats-chart-outline" {...p} /> }} />
      <Tabs.Screen name="clients" options={{ title: t('tab_clients'), tabBarIcon: (p: IconProps) => <TabIcon name="people" outline="people-outline" {...p} /> }} />
      <Tabs.Screen name="sales" options={{ title: t('tab_sales'), tabBarIcon: (p: IconProps) => <TabIcon name="card" outline="card-outline" {...p} /> }} />
      <Tabs.Screen name="clubs" options={{ title: t('tab_clubs_o'), tabBarIcon: (p: IconProps) => <TabIcon name="business" outline="business-outline" {...p} /> }} />
    </Tabs>
  );
}
