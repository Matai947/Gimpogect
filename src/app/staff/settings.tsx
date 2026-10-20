import { ScrollView, StyleSheet, View } from 'react-native';

import { AdminSettings } from '@/components/admin/admin-settings';
import { StaffAccent } from '@/components/member-result';
import { StaffHeader } from '@/components/staff-header';
import { Colors, Spacing } from '@/constants/theme';
import { useCanManage, useI18n } from '@/store/app-context';
import { T } from '@/components/ui';

/** The front desk can change the same content as the owner (prices, plans, trainers, schedule, promotions, rules, photos). */
export default function StaffSettings() {
  const { t } = useI18n();
  const canManage = useCanManage();
  return (
    <View style={styles.root}>
      <StaffHeader title={t('tab_settings')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {canManage ? <AdminSettings accent={StaffAccent} /> : <T type="small" color={Colors.textMuted}>{t('manager_only')}</T>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, paddingBottom: Spacing.six },
});
