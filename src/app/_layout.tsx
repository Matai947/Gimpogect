import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold } from '@expo-google-fonts/onest';
import { Unbounded_500Medium, Unbounded_600SemiBold, Unbounded_700Bold, useFonts } from '@expo-google-fonts/unbounded';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/lib/alert-web';
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
        headerTitleStyle: { fontFamily: 'Onest_700Bold' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerLeft: () => <BackButton />,
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="staff-login" options={{ headerShown: false }} />
      <Stack.Screen name="staff" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="owner" options={{ headerShown: false, gestureEnabled: false }} />
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

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_500Medium,
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    Onest_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

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
