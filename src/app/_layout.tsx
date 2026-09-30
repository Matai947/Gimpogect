import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BackButton } from '@/components/back-button';
import { Colors } from '@/constants/theme';
import { AppProvider, useI18n } from '@/store/app-context';

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

function RootStack() {
  const { t } = useI18n();
  return (
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
      <Stack.Screen name="qr" options={{ presentation: 'modal', title: t('home_qr') }} />
      <Stack.Screen name="membership" options={{ title: t('qa_plan') }} />
      <Stack.Screen name="bookings" options={{ title: t('my_bookings') }} />
      <Stack.Screen name="progress" options={{ title: t('progress') }} />
      <Stack.Screen name="trainers" options={{ title: t('qa_trainers') }} />
      <Stack.Screen name="cart" options={{ title: t('cart') }} />
      <Stack.Screen name="orders" options={{ title: t('my_orders') }} />
      <Stack.Screen name="club/[id]" options={{ title: '' }} />
      <Stack.Screen name="trainer/[id]" options={{ title: t('trainer') }} />
      <Stack.Screen name="class/[id]" options={{ title: '' }} />
      <Stack.Screen name="news/[id]" options={{ title: t('news') }} />
      <Stack.Screen name="product/[id]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <RootStack />
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
