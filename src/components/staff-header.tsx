import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StaffAccent } from '@/components/member-result';
import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById, clubs } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

/** Cyan header band shared by staff screens: shift info, club switch, exit. */
export function StaffHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const { staff, staffLogout, setStaffClub } = useApp();
  const { t } = useI18n();
  const club = clubById(staff?.clubId ?? 'c1');

  const pickClub = () => Alert.alert(t('staff_club'), undefined, [...clubs.map((c) => ({ text: c.name, onPress: () => setStaffClub(c.id) })), { text: t('cancel'), style: 'cancel' as const }]);

  const exit = () =>
    Alert.alert(t('staff_exit'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('staff_exit'),
        style: 'destructive',
        onPress: () => {
          staffLogout();
          router.replace('/(tabs)');
        },
      },
    ]);

  return (
    <SafeAreaView edges={['top']} style={styles.wrap}>
      <View style={styles.band}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={pickClub} style={styles.club}>
            <Ionicons name="business" size={13} color={StaffAccent} />
            <T type="small" color={StaffAccent} style={{ fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
              {club?.name.replace('Gym Project ', '')}
            </T>
            <Ionicons name="chevron-down" size={12} color={StaffAccent} />
          </Pressable>
          <Row gap={4}>
            {right}
            <Pressable onPress={() => router.replace('/(tabs)')} hitSlop={8} style={styles.iconBtn} accessibilityLabel={t('staff_back_member')}>
              <Ionicons name="phone-portrait-outline" size={18} color={Colors.text} />
            </Pressable>
            <Pressable onPress={exit} hitSlop={8} style={styles.iconBtn} accessibilityLabel={t('staff_exit')}>
              <Ionicons name="log-out-outline" size={18} color={Colors.text} />
            </Pressable>
          </Row>
        </Row>
        <T type="title" style={{ marginTop: 6 }}>
          {title}
        </T>
        <T type="small" color={Colors.textSecondary}>
          {t('today_shift', { name: staff?.name ?? '', club: club?.name ?? '' })}
        </T>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#0E1A2B' },
  band: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: 1, borderBottomColor: 'rgba(79,182,227,0.25)' },
  club: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: Radius.pill, backgroundColor: 'rgba(79,182,227,0.12)', borderWidth: 1, borderColor: 'rgba(79,182,227,0.35)', maxWidth: 200 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
});
