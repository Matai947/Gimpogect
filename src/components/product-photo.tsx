import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

/** Product picture, or a neutral placeholder while the product has no photo. */
export function ProductPhoto({ uri, style, transition }: { uri?: string; style?: StyleProp<ViewStyle>; transition?: number }) {
  if (uri) return <Image source={{ uri }} style={style as never} contentFit="cover" transition={transition} />;
  return (
    <View style={[styles.empty, style]}>
      <Ionicons name="cube-outline" size={28} color={Colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
});
