import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubById } from '@/data/mock';
import { fetchLeads, type Lead } from '@/lib/api';
import { useApp, useI18n, useNow } from '@/store/app-context';

/** Requests left on the website, newest first. Shown to staff and owner, refreshed every 15 seconds. */
export function LeadsCard({ accent }: { accent: string }) {
  const { staffCode } = useApp();
  const { t } = useI18n();
  const [leads, setLeads] = useState<Lead[]>([]);
  const now = useNow();

  useEffect(() => {
    if (!staffCode) return;
    let live = true;
    const load = async () => {
      const r = await fetchLeads(staffCode);
      if (live && r) setLeads(r);
    };
    load();
    const iv = setInterval(load, 5 * 60000);
    return () => {
      live = false;
      clearInterval(iv);
    };
  }, [staffCode]);

  // Only the last 7 days matter at the desk.
  const fresh = leads.filter((l) => now - l.ts < 7 * 86400000);
  if (fresh.length === 0) return null;

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <Row gap={8}>
        <Ionicons name="globe-outline" size={18} color={accent} />
        <T type="subheading">
          {t('leads_title')} • {fresh.length}
        </T>
      </Row>
      {fresh.slice(0, 6).map((l) => (
        <Pressable key={`${l.ts}-${l.phone}`} onPress={() => Linking.openURL(`tel:${l.phone.replace(/\s/g, '')}`)} style={styles.row}>
          <View style={{ flex: 1 }}>
            <T type="body" style={{ fontWeight: '600' }} numberOfLines={1}>
              {l.name}
            </T>
            <T type="small" color={Colors.textSecondary} numberOfLines={1}>
              {l.phone} • {l.clubId ? clubById(l.clubId)?.name.replace('Seven Gym ', '') : t('leads_any')} • {new Date(l.ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} {new Date(l.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </T>
          </View>
          <Ionicons name="call-outline" size={20} color={accent} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
});
