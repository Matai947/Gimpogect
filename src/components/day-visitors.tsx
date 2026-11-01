import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { clockTime } from '@/components/shift-bar';
import { Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs } from '@/data/mock';
import { fetchVisits, type VisitRow } from '@/lib/api';
import { SESSION_MS, useApp, useI18n, useMembers, useNow } from '@/store/app-context';

const ALMATY = 5 * 3600000;
const dayOf = (ts: number) => new Date(ts + ALMATY).toISOString().slice(0, 10);
const shiftDay = (iso: string, d: number) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 86400000).toISOString().slice(0, 10);
const dmy = (iso: string) => iso.split('-').reverse().join('.');

type Person = { member: string; inTs: number; outTs?: number; auto: boolean; onefit: boolean };

/** Manager: how many people came and left on a day, by club, and who — with the time they came and went. */
export function DayVisitors({ accent }: { accent: string }) {
  const { t } = useI18n();
  const { staff, staffCode } = useApp();
  const { byId } = useMembers();
  const now = useNow();
  const today = dayOf(now);
  const [day, setDay] = useState(today);
  const [club, setClub] = useState(staff?.clubId ?? 'c1');
  const [rows, setRows] = useState<VisitRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const minute = Math.floor(now / 60000);

  // the log of entries and exits, enough days back to reach the picked day
  const back = Math.ceil((Date.parse(today) - Date.parse(day)) / 86400000) + 2;
  useEffect(() => {
    let live = true;
    fetchVisits(staffCode, back).then((v) => live && v && setRows(v));
    return () => {
      live = false;
    };
  }, [staffCode, back, minute]);

  const d = useMemo(() => {
    const mine = (rows ?? []).filter((v) => v.club === club && dayOf(v.ts) === day).sort((a, b) => a.ts - b.ts);
    const people = new Map<string, Person>();
    for (const v of mine) {
      if (v.kind === 'out') {
        const p = people.get(v.member);
        if (p) people.set(v.member, { ...p, outTs: v.ts, auto: false });
      } else if (!people.has(v.member)) {
        people.set(v.member, { member: v.member, inTs: v.ts, auto: true, onefit: v.kind === 'onefit' });
      }
    }
    // with no exit marked, a visit ends by itself after the usual session
    const list = [...people.values()].map((p) => (p.outTs ? p : { ...p, outTs: p.inTs + SESSION_MS <= now ? p.inTs + SESSION_MS : undefined }));
    const came = list.length;
    const left = list.filter((p) => p.outTs).length;
    const byHour = Array.from({ length: 18 }, (_, i) => list.filter((p) => new Date(p.inTs + ALMATY).getUTCHours() === i + 6).length);
    return { list: list.sort((a, b) => b.inTs - a.inTs), came, left, inside: came - left, byHour, onefit: list.filter((p) => p.onefit).length };
  }, [rows, club, day, now]);

  const max = Math.max(1, ...d.byHour);

  return (
    <View style={styles.card}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <T type="subheading">{t('dv_title')}</T>
        <Row gap={6} style={{ alignItems: 'center' }}>
          <Pressable onPress={() => setDay((x) => shiftDay(x, -1))} hitSlop={8} style={styles.arrow}>
            <Ionicons name="chevron-back" size={18} color={accent} />
          </Pressable>
          <Pressable onPress={() => setDay(today)} hitSlop={6}>
            <T type="small" style={{ fontWeight: '700', minWidth: 84, textAlign: 'center' }}>
              {day === today ? t('rt_today') : dmy(day)}
            </T>
          </Pressable>
          <Pressable onPress={() => setDay((x) => shiftDay(x, 1))} disabled={day >= today} hitSlop={8} style={[styles.arrow, day >= today && { opacity: 0.3 }]}>
            <Ionicons name="chevron-forward" size={18} color={accent} />
          </Pressable>
        </Row>
      </Row>
      <ChipRow>
        {clubs.map((c) => (
          <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={club === c.id} onPress={() => setClub(c.id)} />
        ))}
      </ChipRow>

      <View style={styles.stats}>
        <Stat label={t('dv_came')} value={d.came} color={Colors.success} />
        <Stat label={t('dv_left')} value={d.left} color={Colors.textSecondary} />
        <Stat label={day === today ? t('dv_inside') : t('dv_onefit')} value={day === today ? d.inside : d.onefit} color={accent} />
      </View>

      {/* when they came, by hour */}
      <View style={styles.bars}>
        {d.byHour.map((n, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
            {n ? (
              <T type="small" color={Colors.textMuted} style={{ fontSize: 9 }}>
                {n}
              </T>
            ) : null}
            <View style={{ width: '70%', height: Math.max(2, (n / max) * 52), borderRadius: 2, backgroundColor: n === max && n > 0 ? accent : 'rgba(217,100,58,0.3)' }} />
            <T type="small" color={Colors.textMuted} style={{ fontSize: 9 }}>
              {i % 3 === 0 ? i + 6 : ''}
            </T>
          </View>
        ))}
      </View>

      {d.list.length ? (
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.toggle}>
          <T type="small" color={accent} style={{ fontWeight: '700' }}>
            {open ? t('dv_hide') : t('dv_show', { n: d.list.length })}
          </T>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={accent} />
        </Pressable>
      ) : (
        <T type="small" color={Colors.textMuted}>
          {rows ? t('dv_none') : '…'}
        </T>
      )}
      {open
        ? d.list.map((p) => (
            <Row key={p.member} gap={Spacing.two} style={styles.line}>
              <View style={[styles.dot, { backgroundColor: p.outTs ? Colors.textMuted : Colors.success }]} />
              <T type="small" style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                {byId(p.member)?.name ?? p.member}
                {p.onefit ? ' • 1Fit' : ''}
              </T>
              <T type="small" color={Colors.textSecondary}>
                {clockTime(p.inTs)} → {p.outTs ? `${clockTime(p.outTs)}${p.auto ? ' ≈' : ''}` : t('dv_here')}
              </T>
            </Row>
          ))
        : null}
      {open ? (
        <T type="small" color={Colors.textMuted}>
          {t('dv_auto_hint')}
        </T>
      ) : null}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <T type="display" color={color} style={{ fontSize: 28, lineHeight: 32 }}>
        {value}
      </T>
      <T type="small" color={Colors.textMuted} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  arrow: { padding: 4, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  stats: { flexDirection: 'row', paddingVertical: Spacing.two, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 82, gap: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  line: { alignItems: 'center', paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
