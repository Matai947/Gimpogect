import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

/** Header back button that always works: goes back in history, or to the home tab when opened directly. */
export function BackButton({ fallback = '/(tabs)' as const }: { fallback?: '/(tabs)' }) {
  const onPress = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
  return (
    <Pressable onPress={onPress} hitSlop={12} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Назад">
      <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={26} color={Colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: Platform.OS === 'web' ? 4 : -8 },
});
