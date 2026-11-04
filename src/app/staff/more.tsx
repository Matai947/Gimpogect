import { ScrollView, StyleSheet, View } from 'react-native';

import { StaffAccent } from '@/components/member-result';
import { MoreMenu } from '@/components/more-menu';
import { StaffHeader } from '@/components/staff-header';
import { Colors, Spacing } from '@/constants/theme';
import { orderClosed, useApp, useCanManage, useI18n } from '@/store/app-context';

/** The desk on a phone: what does not fit in the tab bar. */
export default function StaffMore() {
  const { t } = useI18n();
  const { orders, orderStatusOverrides } = useApp();
  const canManage = useCanManage();
  const pending = orders.filter((o) => !orderClosed(orderStatusOverrides[o.id] ?? o.status)).length;
  return (
    <View style={styles.root}>
      <StaffHeader title={t('tab_more')} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <MoreMenu
          accent={StaffAccent}
          items={[
            { href: '/staff/safe', icon: 'lock-closed-outline', title: t('tab_safe'), show: canManage },
            { href: '/staff/bonuses', icon: 'gift-outline', title: t('bonuses_title') },
            { href: '/staff/orders', icon: 'cube-outline', title: t('staff_tab_orders'), badge: pending },
            { href: '/staff/classes', icon: 'people-outline', title: t('staff_tab_trainers') },
            { href: '/staff/products', icon: 'pricetags-outline', title: t('staff_tab_products') },
            { href: '/staff/settings', icon: 'settings-outline', title: t('tab_settings'), show: canManage },
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
