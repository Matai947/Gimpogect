import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { languages } from '@/i18n';
import { useI18n } from '@/store/app-context';

/** Compact RU / KZ / EN switch used on auth and in the profile. */
export function LangSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <View style={styles.wrap}>
      {languages.map((l) => {
        const active = lang === l.key;
        return (
          <Pressable key={l.key} onPress={() => setLang(l.key)} style={[styles.item, active && styles.itemActive]} accessibilityRole="button" accessibilityLabel={l.label}>
            <T type="small" color={active ? Colors.onAccent : Colors.textSecondary} style={{ fontWeight: '800', fontSize: compact ? 11 : 12 }}>
              {compact ? l.short : l.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: Radius.pill, padding: 3, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start' },
  item: { paddingHorizontal: 12, height: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  itemActive: { backgroundColor: Colors.accent },
});
