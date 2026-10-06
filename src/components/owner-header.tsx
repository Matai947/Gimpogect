import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

export const OwnerAccent = '#FFC736';

/** Gold header band for owner CRM screens. Exit is direct: Alert.alert is a no-op on web. */
export function OwnerHeader({ title }: { title: string }) {
  const { ownerLogout } = useApp();
  const { t } = useI18n();
  return (
    <SafeAreaView edges={['top']} style={styles.wrap}>
      <View style={styles.band}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={styles.tag}>
            <Ionicons name="briefcase" size={13} color={OwnerAccent} />
            <T type="small" color={OwnerAccent} style={{ fontWeight: '700', fontSize: 12 }}>
              {t('owner_title')}
            </T>
          </View>
          <Row gap={4}>
            <Pressable onPress={() => router.replace('/(tabs)')} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="phone-portrait-outline" size={18} color={Colors.text} />
            </Pressable>
            <Pressable
              onPress={() => {
                ownerLogout();
                router.replace('/(tabs)');
              }}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityLabel={t('owner_exit')}>
              <Ionicons name="log-out-outline" size={18} color={Colors.text} />
            </Pressable>
          </Row>
        </Row>
        <T type="title" style={{ marginTop: 6 }}>
          {title}
        </T>
        <T type="small" color={Colors.textSecondary}>
          {t('owner_sub', { n: clubs.length })}
        </T>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#141414' },
  band: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: 1, borderBottomColor: 'rgba(255,199,54,0.25)' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: Radius.pill, backgroundColor: 'rgba(255,199,54,0.12)', borderWidth: 1, borderColor: 'rgba(255,199,54,0.35)' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
});
