import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { Colors } from '@/constants/theme';
import { useApp, useI18n } from '@/store/app-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type IconProps = { color: ColorValue; focused: boolean };

function TabIcon({ name, outline, color, focused }: IconProps & { name: IconName; outline: IconName }) {
  return <Ionicons name={focused ? name : outline} size={23} color={color as string} />;
}

export default function StaffLayout() {
  const { staff, hydrated, orders, orderStatusOverrides } = useApp();
  const { t } = useI18n();
  if (!hydrated) return null;
  if (!staff) return <Redirect href="/staff-login" />;
  const pending = orders.filter((o) => (orderStatusOverrides[o.id] ?? o.status) !== 'Выдан').length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: StaffAccent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: '#0E1A2B', borderTopColor: 'rgba(79,182,227,0.25)', height: Platform.OS === 'ios' ? 86 : 68, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10, fontFamily: 'Onest_600SemiBold' },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarAllowFontScaling: false,
        tabBarBadgeStyle: { backgroundColor: StaffAccent, color: Colors.onAccent, fontSize: 10, fontWeight: '800' },
      }}>
      <Tabs.Screen name="index" options={{ title: t('staff_tab_scan'), tabBarIcon: (p: IconProps) => <TabIcon name="scan" outline="scan-outline" {...p} /> }} />
      <Tabs.Screen name="today" options={{ title: t('staff_tab_today'), tabBarIcon: (p: IconProps) => <TabIcon name="speedometer" outline="speedometer-outline" {...p} /> }} />
      <Tabs.Screen name="classes" options={{ title: t('staff_tab_classes'), tabBarIcon: (p: IconProps) => <TabIcon name="people" outline="people-outline" {...p} /> }} />
      <Tabs.Screen name="orders" options={{ title: t('staff_tab_orders'), tabBarIcon: (p: IconProps) => <TabIcon name="cube" outline="cube-outline" {...p} />, tabBarBadge: pending > 0 ? pending : undefined }} />
      <Tabs.Screen name="products" options={{ title: t('staff_tab_products'), tabBarIcon: (p: IconProps) => <TabIcon name="pricetags" outline="pricetags-outline" {...p} /> }} />
      <Tabs.Screen name="members" options={{ title: t('staff_tab_members'), tabBarIcon: (p: IconProps) => <TabIcon name="id-card" outline="id-card-outline" {...p} /> }} />
      <Tabs.Screen name="product-edit" options={{ href: null }} />
    </Tabs>
  );
}
