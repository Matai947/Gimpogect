import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BackButton } from '@/components/back-button';
import { Colors } from '@/constants/theme';
import { AppProvider } from '@/store/app-context';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.accent,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Colors.background },
              headerTintColor: Colors.text,
              headerTitleStyle: { fontWeight: '700' },
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              headerLeft: () => <BackButton />,
              contentStyle: { backgroundColor: Colors.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="qr" options={{ presentation: 'modal', title: 'QR-пропуск' }} />
            <Stack.Screen name="membership" options={{ title: 'Абонемент' }} />
            <Stack.Screen name="bookings" options={{ title: 'Мои записи' }} />
            <Stack.Screen name="progress" options={{ title: 'Мой прогресс' }} />
            <Stack.Screen name="trainers" options={{ title: 'Тренеры' }} />
            <Stack.Screen name="coach" options={{ title: 'ИИ-тренер' }} />
            <Stack.Screen name="cart" options={{ title: 'Корзина' }} />
            <Stack.Screen name="orders" options={{ title: 'Мои заказы' }} />
            <Stack.Screen name="club/[id]" options={{ title: 'Клуб' }} />
            <Stack.Screen name="trainer/[id]" options={{ title: 'Тренер' }} />
            <Stack.Screen name="class/[id]" options={{ title: 'Занятие' }} />
            <Stack.Screen name="news/[id]" options={{ title: 'Новости' }} />
            <Stack.Screen name="product/[id]" options={{ title: 'Товар' }} />
          </Stack>
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
