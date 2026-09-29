import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { Colors } from '@/constants/theme';
import { useApp } from '@/store/app-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type IconProps = { color: ColorValue; focused: boolean };

function TabIcon({ name, outline, color, focused }: IconProps & { name: IconName; outline: IconName }) {
  return <Ionicons name={focused ? name : outline} size={24} color={color as string} />;
}

export default function TabsLayout() {
  const { user, hydrated, cart } = useApp();
  if (!hydrated) return null;
  if (!user) return <Redirect href="/auth" />;
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
          height: Platform.OS === 'ios' ? 86 : 66,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: Colors.accent, color: Colors.onAccent, fontSize: 10, fontWeight: '800' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Главная', tabBarIcon: (p: IconProps) => <TabIcon name="home" outline="home-outline" {...p} /> }} />
      <Tabs.Screen name="clubs" options={{ title: 'Клубы', tabBarIcon: (p: IconProps) => <TabIcon name="location" outline="location-outline" {...p} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Расписание', tabBarIcon: (p: IconProps) => <TabIcon name="calendar" outline="calendar-outline" {...p} /> }} />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Магазин',
          tabBarIcon: (p: IconProps) => <TabIcon name="bag-handle" outline="bag-handle-outline" {...p} />,
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: (p: IconProps) => <TabIcon name="person" outline="person-outline" {...p} /> }} />
    </Tabs>
  );
}
