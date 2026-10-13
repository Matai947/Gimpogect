import { StyleSheet, View } from 'react-native';

import { Card, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { rules } from '@/data/rules';
import { useI18n } from '@/store/app-context';

export default function RulesScreen() {
  const { t, lang } = useI18n();
  return (
    <Screen edges={[]} contentStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six }}>
      <T type="caption">{t('rules_sub')}</T>
      <Card style={{ gap: Spacing.three }}>
        {rules[lang].map((r, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.num}>
              <T type="small" color={Colors.onAccent} style={{ fontWeight: '800' }}>
                {i + 1}
              </T>
            </View>
            <T type="body" style={{ flex: 1 }}>
              {r}
            </T>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
