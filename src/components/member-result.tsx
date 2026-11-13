import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Linking, Pressable, TextInput, StyleSheet, View } from 'react-native';

import { Badge, Button, Chip, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { goalTitle } from '@/data/fitness';
import type { PayMethod } from '@/data/owner';
import { fetchMemberVisits, fetchVisits, resetPasswordRemote, type MemberVisit } from '@/lib/api';
import { ClientPhoto } from '@/components/client-photo';
import { DeleteClient } from '@/components/delete-client';
import { RenameClient } from '@/components/rename-client';
import { VisitCalendar } from '@/components/visit-calendar';
import { DAY_ONLY_UNTIL, clubs, clubById, clubHour, formatDateHuman, formatDateLong, formatPrice, trainerById } from '@/data/mock';
import { replacePlan, useApp, useCanManage, useI18n, useMembers, usePlans, usePresence, type MemberInfo } from '@/store/app-context';

export const hm = (ts: number) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const StaffAccent = '#D9643A';

// visits of the last 30 days per client, one request shared by every card on the screen (kept for two minutes)
let month: { at: number; code: string; p: Promise<Map<string, number> | null> } | null = null;
function useMonthVisits(id: string, code: string | null | undefined) {
  const [n, setN] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!code) return;
    if (!month || month.code !== code || Date.now() - month.at > 120000) {
      month = { at: Date.now(), code, p: fetchVisits(code, 30).then((rows) => rows && rows.filter((v) => v.kind !== 'out').reduce((m, v) => m.set(v.member, (m.get(v.member) ?? 0) + 1), new Map<string, number>())) };
    }
    let live = true;
    void month.p.then((m) => live && m && setN(m.get(id) ?? 0));
    return () => {
      live = false;
    };
  }, [id, code]);
  return n;
}

/** Decides whether a member may enter right now and why not. */
export function entryDecision(m: MemberInfo, t: (k: any, v?: any) => string): { ok: boolean; reason?: string } {
  if (!m.planId || !m.endDate) return { ok: false, reason: t('member_no_plan') };
  if (!m.active) return { ok: false, reason: t('member_expired') };
  if (m.frozen) return { ok: false, reason: t('member_frozen') };
  if (m.visitsLeft !== undefined && m.visitsLeft <= 0) return { ok: false, reason: t('member_no_visits') };
  if (m.dayOnly && clubHour() >= DAY_ONLY_UNTIL) return { ok: false, reason: t('member_day_only') };
  return { ok: true };
}

export function MemberResult({ member: snapshot, onDone, compact }: { member: MemberInfo; onDone?: () => void; compact?: boolean }) {
  const { t, td } = useI18n();
  const plans = usePlans();
  // The scanner passes a snapshot; re-read so the card updates right after a plan is issued.
  const member = useMembers().byId(snapshot.id) ?? snapshot;
  const { staff, staffCode, logCheckin, checkoutMember, grantPlan, editMembership, changePlan, staffFreeze, moveClient, remote, membership } = useApp();
  const canManage = useCanManage();
  const [moveMsg, setMoveMsg] = useState('');
  const [seen, setSeen] = useState<MemberVisit[] | null>(null);
  const monthVisits = useMonthVisits(member.id, staffCode);
  const [showVisits, setShowVisits] = useState(false);
  const openVisits = () => {
    setShowVisits((v) => !v);
    if (!seen && staffCode) void fetchMemberVisits(member.id, { code: staffCode }).then((v) => v && setSeen(v));
  };
  const [freezing, setFreezing] = useState(false);
  const [freezeMsg, setFreezeMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const doFreeze = async (days: number) => {
    const ok = await staffFreeze(member.id, days);
    setFreezing(false);
    setFreezeMsg(ok ? { text: days > 0 ? t('freeze_done', { n: days }) : t('unfreeze_done'), bad: false } : { text: t('freeze_failed'), bad: true });
  };
  const [editing, setEditing] = useState(false);
  const [endText, setEndText] = useState('');
  const [visitsText, setVisitsText] = useState('');
  const [editMsg, setEditMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [editPlan, setEditPlan] = useState<string | null>(null); // the type picked for a client who has none
  const [fixPlan, setFixPlan] = useState<string | null>(null); // manager: the right plan instead of one added by mistake
  const [fixReason, setFixReason] = useState('');
  const pickFix = (planId: string) => {
    const cur = member.isSelf ? membership : remote.find((r) => r.id === member.id)?.membership;
    if (!cur) return;
    const next = replacePlan(cur, planId);
    setFixPlan(planId);
    setEndText(showDay(next.endDate));
    setVisitsText(next.visitsLeft === undefined ? '' : String(next.visitsLeft));
  };
  const editable = plans.filter((p) => !p.staffOnly && !p.trial && !p.partner);
  const [saving, setSaving] = useState(false);
  const here = usePresence().find((p) => p.memberId === snapshot.id);
  const [logged, setLogged] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [granted, setGranted] = useState<string | null>(null);

  const [choice, setChoice] = useState<string | null>(null);
  // a paid plan sold from the card says how it was paid, so its cash reaches the drawer
  const [payBy, setPayBy] = useState<PayMethod | null>(null);
  const [pct, setPct] = useState(0); // the desk's discount on this plan
  const chosen = plans.find((p) => p.id === choice);

  const grant = (planId: string) => {
    const full = plans.find((p) => p.id === planId)?.price ?? 0;
    const price = pct ? Math.round((full * (100 - pct)) / 100) : full;
    // free (100%) needs no way of paying; it is still written down with its zero
    const by = payBy ?? (pct === 100 ? 'cash' : null);
    grantPlan(member.id, planId, price, by && full > 0 ? [{ method: by, amount: price }] : undefined, pct && full > 0 ? { disc: pct, off: full - price } : undefined);
    setPayBy(null);
    setPct(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPicking(false);
    setChoice(null);
    setGranted(planId);
  };
  const decision = entryDecision(member, t);
  // A daytime plan is not let in during the evening, and the desk cannot override that: a single workout is sold instead.
  const dayBlocked = member.dayOnly && member.active && !member.frozen && clubHour() >= DAY_ONLY_UNTIL;
  const club = clubById(member.homeClubId);

  const allow = () => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    logCheckin({ memberId: member.id, name: member.name, ok: true, clubId: staff?.clubId ?? member.homeClubId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setLogged(t('entry_logged', { name: member.name, time }));
  };

  const [resetDone, setResetDone] = useState(false);
  const resetPassword = async () => {
    if (!staffCode) return;
    const ok = await resetPasswordRemote(staffCode, member.id);
    if (ok) setResetDone(true);
  };

  // dd.mm.yyyy typed by the desk -> yyyy-mm-dd; empty when the date does not exist
  const parseDay = (v: string) => {
    const m = v.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (!m) return '';
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    const iso = d.toISOString().slice(0, 10);
    return iso.endsWith(`-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`) ? iso : '';
  };
  const showDay = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
  const openEdit = () => {
    setEndText(showDay(member.endDate));
    setVisitsText(member.visitsLeft === undefined ? '' : String(member.visitsLeft));
    setEditPlan(null);
    setFixPlan(null);
    setFixReason('');
    setEditMsg(null);
    setEditing(true);
  };
  const saveEdit = async () => {
    const endDate = parseDay(endText);
    if (!member.planId && !editPlan) return setEditMsg({ text: t('edit_plan_pick'), bad: true });
    if (!endDate) return setEditMsg({ text: t('edit_plan_bad_date'), bad: true });
    const visits = visitsText.trim() === '' ? undefined : Number(visitsText.replace(/\D/g, ''));
    if (fixPlan) {
      if (fixReason.trim().length < 3) return setEditMsg({ text: t('plan_fix_reason_need'), bad: true });
      setSaving(true);
      const fixed = await changePlan(member.id, fixPlan, { endDate, visitsLeft: visits }, fixReason.trim());
      setSaving(false);
      if (!fixed) return setEditMsg({ text: t('cash_fail'), bad: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEditing(false);
      return setEditMsg({ text: t('plan_fix_saved', { name: td(plans.find((p) => p.id === fixPlan)?.name ?? ''), date: formatDateLong(endDate) }), bad: false });
    }
    setSaving(true);
    const ok = await editMembership(member.id, { planId: member.planId ? undefined : editPlan ?? undefined, endDate, visitsLeft: visits });
    setSaving(false);
    if (!ok) return setEditMsg({ text: t('cash_fail'), bad: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setEditing(false);
    setEditMsg({ text: t('edit_plan_saved', { date: formatDateLong(endDate) }), bad: false });
  };

  const giveAccess = () => {
    grantPlan(member.id, 'guest');
    setGranted('guest');
    allow();
  };

  const deny = () => {
    logCheckin({ memberId: member.id, name: member.name, ok: false, reason: decision.reason, clubId: staff?.clubId ?? member.homeClubId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    onDone?.();
  };

  return (
    <View style={[styles.card, { borderColor: decision.ok ? 'rgba(76,195,138,0.5)' : 'rgba(240,96,93,0.5)' }]}>
      <View style={[styles.stripe, { backgroundColor: decision.ok ? Colors.success : Colors.danger }]} />
      <View style={{ flex: 1, minWidth: 0, padding: Spacing.three, gap: Spacing.two }}>
        <Row gap={Spacing.three}>
          <ClientPhoto id={member.id} name={member.name} size={compact ? 52 : 72} hasPhoto={!!remote.find((r) => r.id === member.id)?.photoAt} />
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <T type={compact ? 'subheading' : 'heading'} style={{ flexShrink: 1 }} numberOfLines={1}>
                {member.name}
              </T>
              {member.isSelf ? <Badge label={t('self_badge')} color={StaffAccent} /> : null}
            </Row>
            <T type="small" color={Colors.textSecondary}>
              {member.phone} • {club?.name.replace('Seven Gym ', '')}
            </T>
          </View>
          <View style={[styles.verdict, { backgroundColor: decision.ok ? 'rgba(76,195,138,0.15)' : 'rgba(240,96,93,0.15)' }]}>
            <Ionicons name={decision.ok ? 'checkmark-circle' : 'close-circle'} size={26} color={decision.ok ? Colors.success : Colors.danger} />
          </View>
        </Row>

        {member.pendingActivation && member.endDate ? (
          <View style={styles.trial}>
            <Ionicons name="calendar-outline" size={22} color={Colors.success} />
            <T type="body" style={{ fontWeight: '800', flex: 1 }} color={Colors.success}>
              {t('pending_banner')}
            </T>
          </View>
        ) : null}

        <View style={styles.planBox}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T type="body" style={{ fontWeight: '700' }} color={decision.ok ? Colors.text : Colors.danger}>
              {member.planId && member.endDate ? t('member_plan_until', { name: td(member.planName ?? ''), date: formatDateLong(member.endDate) }) : t('member_no_plan')}
            </T>
            {member.active ? (
              <T type="small" color={member.daysLeft <= 7 ? Colors.warning : Colors.textSecondary}>
                {t('member_days_left', { n: member.daysLeft })}
              </T>
            ) : null}
          </Row>
          {member.visitsLeft !== undefined ? (
            <T type="body" style={{ fontWeight: '700' }} color={member.visitsLeft <= 2 ? Colors.warning : Colors.text}>
              {t('visits_left_n', { n: member.visitsLeft })}
            </T>
          ) : null}
          <T type="small" color={Colors.textSecondary}>
            {t('member_visits_month', { n: monthVisits ?? member.visitsThisMonth })}
            {member.note ? ` • ${member.note}` : ''}
          </T>
          {dayBlocked ? (
            <T type="small" color={Colors.textSecondary}>
              {t('day_only_hint')}
            </T>
          ) : null}
          {!decision.ok ? (
            <Row gap={6} style={{ marginTop: 4 }}>
              <Ionicons name="alert-circle" size={14} color={Colors.danger} />
              <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
                {decision.reason}
              </T>
            </Row>
          ) : null}
        </View>

        {here ? (
          <View style={{ gap: Spacing.two }}>
            <View style={styles.logged}>
              <Ionicons name="log-in" size={18} color={Colors.success} />
              <T type="small" color={Colors.success} style={{ fontWeight: '700', flex: 1 }}>
                {t('present_since', { from: hm(here.inTs), to: hm(here.until) })}
              </T>
            </View>
            <Button
              title={t('mark_exit')}
              icon="log-out-outline"
              variant="secondary"
              onPress={() => {
                checkoutMember(member.id);
                setLogged(null);
              }}
            />
          </View>
        ) : logged ? (
          <View style={styles.logged}>
            <Ionicons name="checkmark-done" size={18} color={Colors.success} />
            <T type="small" color={Colors.success} style={{ fontWeight: '700', flex: 1 }}>
              {logged}
            </T>
          </View>
        ) : (
          <View style={{ gap: Spacing.two }}>
            <Row gap={Spacing.two}>
              {!canManage ? (
                <T type="small" color={Colors.textSecondary} style={{ flex: 1, fontWeight: '600' }}>
                  {decision.ok ? t('entry_qr_only') : decision.reason}
                </T>
              ) : decision.ok ? (
                <>
                  <Button title={t('allow_entry')} icon="log-in-outline" onPress={allow} style={{ flex: 1 }} />
                  <Button title="" icon="card-outline" variant="ghost" onPress={() => setPicking((v) => !v)} style={{ paddingHorizontal: 14 }} />
                </>
              ) : (
                <>
                  {/* a day pass after hours: only the manager lets the client in */}
                  {dayBlocked ? <Button title={t('allow_entry')} icon="log-in-outline" onPress={allow} style={{ flex: 1 }} /> : null}
                  {dayBlocked ? null : <Button title={t('give_access')} icon="key-outline" onPress={giveAccess} style={{ flex: 1 }} />}
                  <Button title="" icon="close" variant="danger" onPress={deny} style={{ paddingHorizontal: 14 }} />
                </>
              )}
              <Button title="" icon="call-outline" variant="ghost" onPress={() => Linking.openURL(`tel:${member.phone.replace(/\s/g, '')}`)} style={{ paddingHorizontal: 14 }} />
            </Row>
            {!decision.ok ? <Button title={t('sell_plan')} variant="secondary" icon="card-outline" onPress={() => setPicking((v) => !v)} /> : null}
          </View>
        )}
        {/* the client's account: also while the client is in the hall */}
        <View style={{ gap: Spacing.two }}>
            {resetDone ? (
              <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>
                {t('reset_pass_done')}
              </T>
            ) : (
              <Button title={t('reset_pass')} variant="ghost" size="sm" icon="key-outline" onPress={() => void resetPassword()} />
            )}
            {canManage && !member.isSelf && clubs.length > 1 ? (
              <View style={{ gap: 6 }}>
                <T type="small" color={Colors.textSecondary}>
                  {t('mv_home', { club: clubById(member.homeClubId || 'c1')?.name ?? '' })} • {t('mv_title')}:
                </T>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {clubs
                    .filter((c) => c.id !== (member.homeClubId || 'c1'))
                    .map((c) => (
                      <Chip key={c.id} label={c.name} icon="swap-horizontal-outline" onPress={() => void moveClient(member.id, c.id).then((ok) => setMoveMsg(ok ? t('mv_done', { club: c.name }) : t('cash_fail')))} />
                    ))}
                </Row>
                {moveMsg ? (
                  <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>
                    {moveMsg}
                  </T>
                ) : null}
              </View>
            ) : null}
            {!member.isSelf ? <RenameClient id={member.id} name={member.name} /> : null}
            {!member.isSelf ? <DeleteClient id={member.id} name={member.name} onDone={onDone} /> : null}
        </View>
        {/* the manager corrects the current plan (dates, visits, a plan added by mistake); administrators do not */}
        {!member.isSelf && canManage ? (
          editing ? (
            <View style={styles.picker}>
              <T type="small" style={{ fontWeight: '700' }}>
                {member.planId ? t('edit_plan_title', { name: td(member.planName ?? '') }) : t('edit_plan_new')}
              </T>
              {member.planId && canManage ? (
                <View style={{ gap: 6 }}>
                  <T type="small" color={Colors.textMuted}>
                    {t('plan_fix_title')}
                  </T>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    {editable
                      .filter((p) => p.id !== member.planId)
                      .map((p) => (
                        <Chip key={p.id} label={td(p.name)} active={fixPlan === p.id} onPress={() => pickFix(p.id)} />
                      ))}
                  </Row>
                  {fixPlan ? (
                    <>
                      <TextInput value={fixReason} onChangeText={setFixReason} placeholder={t('plan_fix_reason')} placeholderTextColor={Colors.textMuted} maxLength={120} style={styles.input} />
                      <T type="small" color={Colors.textMuted}>
                        {t('plan_fix_hint')}
                      </T>
                    </>
                  ) : null}
                </View>
              ) : member.planId ? (
                <T type="small" color={Colors.textMuted}>
                  {t('plan_fix_manager_only')}
                </T>
              ) : null}
              {!member.planId ? (
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {editable.map((p) => (
                    <Chip
                      key={p.id}
                      label={td(p.name)}
                      active={editPlan === p.id}
                      onPress={() => {
                        setEditPlan(p.id);
                        setVisitsText(p.visits ? String(p.visits) : '');
                        if (!endText) {
                          const end = new Date();
                          end.setDate(end.getDate() + (p.months ? p.months * 30 : p.days || 30));
                          setEndText(showDay(end.toISOString().slice(0, 10)));
                        }
                      }}
                    />
                  ))}
                </Row>
              ) : null}
              <Row gap={Spacing.two}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T type="small" color={Colors.textMuted}>
                    {t('edit_plan_until')}
                  </T>
                  <TextInput value={endText} onChangeText={setEndText} placeholder="31.12.2026" placeholderTextColor={Colors.textMuted} keyboardType="numbers-and-punctuation" style={styles.input} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T type="small" color={Colors.textMuted}>
                    {t('edit_plan_visits')}
                  </T>
                  <TextInput value={visitsText} onChangeText={(v) => setVisitsText(v.replace(/\D/g, ''))} placeholder={t('edit_plan_unlimited')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" style={styles.input} />
                </View>
              </Row>
              <T type="small" color={Colors.textMuted}>
                {t('edit_plan_hint')}
              </T>
              {editMsg?.bad ? (
                <T type="small" color={Colors.danger}>
                  {editMsg.text}
                </T>
              ) : null}
              <Row gap={Spacing.two}>
                <Button title={t('save')} icon="checkmark-circle-outline" onPress={() => void saveEdit()} disabled={saving} style={{ flex: 1 }} />
                <Button title={t('cancel')} variant="secondary" onPress={() => setEditing(false)} />
              </Row>
            </View>
          ) : (
            <>
              <Button title={member.planId ? t('edit_plan') : t('edit_plan_set')} variant="ghost" size="sm" icon="create-outline" onPress={openEdit} />
              {editMsg && !editMsg.bad ? (
                <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>
                  {editMsg.text}
                </T>
              ) : null}
            </>
          )
        ) : null}
        {/* freeze at the desk: the client asked in person, or forgot to unfreeze */}
        {!member.isSelf && member.planId && member.active ? (
          member.frozen ? (
            <Button title={t('unfreeze')} icon="sunny-outline" variant="secondary" size="sm" onPress={() => void doFreeze(0)} />
          ) : member.freezeDaysLeft > 0 && member.freezesLeft !== 0 ? (
            freezing ? (
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {((cap) => [3, 5, 7, 10, 14, cap].filter((d, i, a) => d >= 1 && d <= cap && a.indexOf(d) === i).sort((x, y) => x - y))(Math.min(member.freezeMax || member.freezeDaysLeft, member.freezeDaysLeft)).map((d) => (
                  <Chip key={d} label={t('freeze_for', { n: d })} onPress={() => void doFreeze(d)} />
                ))}
                <Chip label={t('cancel')} onPress={() => setFreezing(false)} />
              </Row>
            ) : (
              <Button title={t('freeze')} icon="snow-outline" variant="ghost" size="sm" onPress={() => setFreezing(true)} />
            )
          ) : canManage && member.endDate ? (
            // the freeze is used up: the manager can give one more
            <Button
              // used up: "one more"; a pass that never had one (a guest pass, an old import): "give"
              title={t(member.freezesLeft === 0 ? 'freeze_add' : 'freeze_give')}
              icon="snow-outline"
              variant="ghost"
              size="sm"
              onPress={() =>
                void editMembership(member.id, { endDate: member.endDate!, visitsLeft: member.visitsLeft, addFreeze: true }).then((ok) =>
                  setFreezeMsg(ok ? { text: t('freeze_added'), bad: false } : { text: t('freeze_failed'), bad: true }),
                )
              }
            />
          ) : null
        ) : null}
        {freezeMsg ? (
          <T type="small" color={freezeMsg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
            {freezeMsg.text}
          </T>
        ) : null}
        {/* Full client profile for the front desk */}
        <View style={styles.grid}>
          <Fact label={t('fact_since')} value={formatDateLong(member.since)} />
          <Fact label={t('fact_last_visit')} value={member.lastVisit ? formatDateHuman(member.lastVisit) : '—'} />
          <Fact label={t('fact_visits_total')} value={String(member.visitsTotal)} />
          <Fact label={t('fact_age_goal')} value={[member.age ? t('age_n', { n: member.age }) : '', member.goal ? goalTitle(member.goal) : ''].filter(Boolean).join(' • ') || '—'} />
          <Fact label={t('fact_trainer')} value={member.trainerId ? (trainerById(member.trainerId)?.name ?? '—') : t('fact_no_trainer')} />
          <Fact label={t('fact_freeze')} value={member.frozen && member.frozenUntil ? t('frozen_until', { date: formatDateLong(member.frozenUntil) }) : member.freezesLeft === 0 ? t('ms_freeze_used') : t('ms_freeze_rule', { k: member.freezesLeft ?? 1, n: Math.min(member.freezeMax || member.freezeDaysLeft, member.freezeDaysLeft) })} accent={member.frozen} />
          <Pressable onPress={openVisits} style={styles.visitsToggle}>
            <Ionicons name="calendar-outline" size={16} color={StaffAccent} />
            <T type="small" color={StaffAccent} style={{ fontWeight: '700', flex: 1 }}>
              {t('vc_title')}
              {seen ? ` • ${t('vc_total', { n: new Set(seen.map((v) => v.d)).size })}` : ''}
            </T>
            <Ionicons name={showVisits ? 'chevron-up' : 'chevron-down'} size={16} color={StaffAccent} />
          </Pressable>
          {showVisits ? (
            seen ? (
              <VisitCalendar days={[...new Set(seen.map((v) => v.d))]} oneFit={new Set(seen.filter((v) => v.onefit).map((v) => v.d))} accent={StaffAccent} />
            ) : (
              <T type="small" color={Colors.textMuted}>
                …
              </T>
            )
          ) : null}
          {member.params ? <Fact label={t('my_params')} value={member.params} /> : null}
          {member.bookingsToday ? <Fact label={t('fact_bookings_today')} value={String(member.bookingsToday)} accent /> : null}
          {member.ordersReady ? <Fact label={t('fact_orders_ready')} value={String(member.ordersReady)} accent /> : null}
        </View>

        {picking ? (
          <View style={styles.picker}>
            <T type="small" color={Colors.textSecondary}>
              {t('grant_pick')}
            </T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {plans.map((p) => (
                <Chip key={p.id} label={p.id === 'guest' ? t('guest_pass') : p.trial ? t('trial_grant') : `${td(p.name)} · ${formatPrice(p.price)}`} active={choice === p.id} onPress={() => setChoice(p.id)} />
              ))}
            </Row>
            {chosen && chosen.price > 0 ? (
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {(['cash', 'kaspi', 'card'] as PayMethod[]).map((m) => (
                  <Chip key={m} label={t(m === 'cash' ? 'pay_cash' : m === 'kaspi' ? 'pay_kaspi' : 'pay_card')} active={payBy === m} onPress={() => setPayBy(m)} />
                ))}
              </Row>
            ) : null}
            {chosen && chosen.price > 0 && canManage ? (
              <Row gap={6} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <T type="small" color={Colors.textSecondary}>
                  {t('pos_manual_disc')}
                </T>
                {[10, 20, 30, 50, 100].map((p) => (
                  <Chip key={p} label={`${p}%`} active={pct === p} onPress={() => setPct((v) => (v === p ? 0 : p))} />
                ))}
              </Row>
            ) : null}
            {chosen ? (
              <Button
                disabled={chosen.price > 0 && pct !== 100 && !payBy}
                title={chosen.price > 0 ? t('grant_confirm', { price: formatPrice(pct ? Math.round((chosen.price * (100 - pct)) / 100) : chosen.price), name: td(chosen.name) }) : t('grant_confirm_free', { name: td(chosen.name) })}
                icon="checkmark-circle-outline"
                onPress={() => grant(chosen.id)}
              />
            ) : null}
          </View>
        ) : null}
        {granted && member.endDate ? (
          <View style={styles.logged}>
            <Ionicons name="card" size={18} color={Colors.success} />
            <T type="small" color={Colors.success} style={{ fontWeight: '700', flex: 1 }}>
              {t('grant_done', { name: td(member.planName ?? ''), date: formatDateLong(member.endDate) })}
            </T>
          </View>
        ) : null}
        {(logged || here) && onDone ? <Button title={t('scan_again')} variant="secondary" icon="qr-code-outline" onPress={onDone} size="sm" /> : null}
      </View>
    </View>
  );
}

export function Fact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.fact}>
      <T type="small" color={Colors.textMuted} style={{ fontSize: 10.5 }} numberOfLines={1}>
        {label}
      </T>
      <T type="small" color={accent ? StaffAccent : Colors.text} style={{ fontWeight: '700' }} numberOfLines={2}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  visitsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: { width: '48%', flexGrow: 1, gap: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, overflow: 'hidden', flexDirection: 'row' },
  stripe: { width: 6 },
  verdict: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planBox: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 12, gap: 4 },
  input: { height: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.two, fontSize: 16, color: Colors.text },
  picker: { gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  trial: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(76,195,138,0.14)', borderWidth: 1, borderColor: 'rgba(76,195,138,0.5)' },
  logged: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(76,195,138,0.12)' },
});
