import { ScrollView, StyleSheet, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { SafePanel } from '@/components/safe-panel';
import { StaffHeader } from '@/components/staff-header';
import { T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useCanManage, useI18n } from '@/store/app-context';

/** The manager's safe: what is in it per club, every movement, taking out and putting in. */
export default function StaffSafe() {
  const { t } = useI18n();
  const canManage = useCanManage();
  return (
    <View style={styles.root}>
      <StaffHeader title={t('tab_safe')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {canManage ? <SafePanel accent={StaffAccent} /> : <T type="small" color={Colors.textMuted}>{t('manager_only')}</T>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, paddingBottom: Spacing.six },
});
