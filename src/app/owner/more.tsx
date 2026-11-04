import { ScrollView, StyleSheet, View } from 'react-native';

import { MoreMenu } from '@/components/more-menu';
import { OwnerAccent, OwnerHeader } from '@/components/owner-header';
import { Colors, Spacing } from '@/constants/theme';
import { useI18n } from '@/store/app-context';

/** The owner on a phone: what does not fit in the tab bar. */
export default function OwnerMore() {
  const { t } = useI18n();
  return (
    <View style={styles.root}>
      <OwnerHeader title={t('tab_more')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <MoreMenu
          accent={OwnerAccent}
          items={[
            { href: '/owner/safe', icon: 'lock-closed-outline', title: t('tab_safe') },
            { href: '/owner/clubs', icon: 'business-outline', title: t('tab_clubs_o') },
            { href: '/owner/settings', icon: 'settings-outline', title: t('tab_settings') },
          ]}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
});
