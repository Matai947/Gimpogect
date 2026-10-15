import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { trainerById, trainers } from '@/data/mock';
import { fetchClicks, type Click } from '@/lib/api';
import { useApp, useI18n, useNow } from '@/store/app-context';

/** Bar chart for staff and owner: how often clients opened each trainer, called and wrote on WhatsApp. */
export function TrainerClicks({ accent }: { accent: string }) {
  const { staffCode } = useApp();
  const { t } = useI18n();
  const now = useNow();
  const [days, setDays] = useState<7 | 30>(7);
  const [clicks, setClicks] = useState<Click[]>([]);

  useEffect(() => {
    if (!staffCode) return;
    let live = true;
    fetchClicks(staffCode).then((r) => live && r && setClicks(r));
    return () => {
      live = false;
    };
  }, [staffCode]);

  const rows = useMemo(() => {
    const from = now - days * 86400000;
    return trainers
      .map((tr) => {
        const mine = clicks.filter((c) => c.target === tr.id && c.ts >= from);
        return { id: tr.id, name: tr.name, views: mine.filter((c) => c.kind === 'view').length, calls: mine.filter((c) => c.kind === 'call').length, wa: mine.filter((c) => c.kind === 'whatsapp').length };
      })
      .sort((a, b) => b.calls + b.wa + b.views - (a.calls + a.wa + a.views));
  }, [clicks, days, now]);

  const max = Math.max(1, ...rows.map((r) => Math.max(r.views, r.calls, r.wa)));
  const empty = rows.every((r) => !r.views && !r.calls && !r.wa);

  return (
    <View style={styles.card}>
      <T type="subheading">{t('tc_title')}</T>
      <ChipRow>
        <Chip label={t('period_7')} active={days === 7} onPress={() => setDays(7)} />
        <Chip label={t('period_30')} active={days === 30} onPress={() => setDays(30)} />
      </ChipRow>
      <Row gap={14}>
        <Legend color={Colors.textMuted} label={t('tc_views')} />
        <Legend color={accent} label={t('tc_calls')} />
        <Legend color="#25D366" label="WhatsApp" />
      </Row>
      {empty ? (
        <T type="small" color={Colors.textMuted}>
          {t('tc_empty')}
        </T>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={{ gap: 4 }}>
            <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
              {trainerById(r.id)?.name ?? r.name}
            </T>
            <Bar value={r.views} max={max} color={Colors.textMuted} />
            <Bar value={r.calls} max={max} color={accent} />
            <Bar value={r.wa} max={max} color="#25D366" />
          </View>
        ))
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <T type="small" color={Colors.textSecondary}>
        {label}
      </T>
    </Row>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <Row gap={8}>
      <View style={styles.track}>
        <View style={{ width: `${(value / max) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
      </View>
      <T type="small" style={{ width: 28, textAlign: 'right', fontWeight: '700' }}>
        {value}
      </T>
    </Row>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.surfaceAlt, overflow: 'hidden' },
});
