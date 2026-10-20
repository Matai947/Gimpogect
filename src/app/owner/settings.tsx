import { ScrollView, StyleSheet, View } from 'react-native';

import { AdminSettings } from '@/components/admin/admin-settings';
import { AdminsEditor } from '@/components/admin/admins-editor';
import { AdminSection } from '@/components/admin/fields';
import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { Colors, Spacing } from '@/constants/theme';
import { useI18n } from '@/store/app-context';

export default function OwnerSettings() {
  const { t } = useI18n();
  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_settings')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AdminSection title={t('adm_admins')} hint={t('adm_admins_hint')} accent={OwnerAccent}>
          <AdminsEditor accent={OwnerAccent} />
        </AdminSection>
        <AdminSettings accent={OwnerAccent} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, paddingBottom: Spacing.six },
});
