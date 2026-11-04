import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, useWindowDimensions, type ColorValue } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { Colors } from '@/constants/theme';
import { useApp, useCanManage, useI18n, orderClosed } from '@/store/app-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type IconProps = { color: ColorValue; focused: boolean };

function TabIcon({ name, outline, color, focused }: IconProps & { name: IconName; outline: IconName }) {
  return <Ionicons name={focused ? name : outline} size={23} color={color as string} />;
}

export default function StaffLayout() {
  const { staff, hydrated, orders, orderStatusOverrides } = useApp();
  const { t } = useI18n();
  const canManage = useCanManage();
  // a phone fits five tabs with readable names; the rest go under "More"
  const phone = useWindowDimensions().width < 600;
  const side = (show = true) => (show && !phone ? undefined : null);
  if (!hydrated) return null;
  if (!staff) return <Redirect href="/staff-login" />;
  const pending = orders.filter((o) => !orderClosed(orderStatusOverrides[o.id] ?? o.status)).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: StaffAccent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: 'rgba(217,100,58,0.25)', height: Platform.OS === 'ios' ? 86 : 68, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold' },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarAllowFontScaling: false,
        tabBarBadgeStyle: { backgroundColor: StaffAccent, color: Colors.onAccent, fontSize: 10, fontWeight: '800' },
      }}>
      <Tabs.Screen name="index" options={{ title: t('staff_tab_scan'), tabBarIcon: (p: IconProps) => <TabIcon name="scan" outline="scan-outline" {...p} /> }} />
      <Tabs.Screen name="pos" options={{ title: t('staff_tab_pos'), tabBarIcon: (p: IconProps) => <TabIcon name="calculator" outline="calculator-outline" {...p} /> }} />
      <Tabs.Screen name="today" options={{ title: t('staff_tab_today'), tabBarIcon: (p: IconProps) => <TabIcon name="speedometer" outline="speedometer-outline" {...p} /> }} />
      <Tabs.Screen name="safe" options={{ title: t('tab_safe'), href: side(canManage), tabBarIcon: (p: IconProps) => <TabIcon name="lock-closed" outline="lock-closed-outline" {...p} /> }} />
      <Tabs.Screen name="classes" options={{ href: side(), title: t('staff_tab_trainers'), tabBarIcon: (p: IconProps) => <TabIcon name="people" outline="people-outline" {...p} /> }} />
      <Tabs.Screen name="orders" options={{ href: side(), title: t('staff_tab_orders'), tabBarIcon: (p: IconProps) => <TabIcon name="cube" outline="cube-outline" {...p} />, tabBarBadge: pending > 0 ? pending : undefined }} />
      <Tabs.Screen name="products" options={{ href: side(), title: t('staff_tab_products'), tabBarIcon: (p: IconProps) => <TabIcon name="pricetags" outline="pricetags-outline" {...p} /> }} />
      <Tabs.Screen name="members" options={{ title: t('staff_tab_members'), tabBarIcon: (p: IconProps) => <TabIcon name="id-card" outline="id-card-outline" {...p} /> }} />
      <Tabs.Screen name="more" options={{ href: phone ? undefined : null, title: t('tab_more'), tabBarIcon: (p: IconProps) => <TabIcon name="grid" outline="grid-outline" {...p} />, tabBarBadge: pending > 0 ? pending : undefined }} />
      <Tabs.Screen name="bonuses" options={{ href: null }} />
      <Tabs.Screen name="product-edit" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
