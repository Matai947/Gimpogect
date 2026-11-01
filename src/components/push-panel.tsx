import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Chip, ChipRow, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs } from '@/data/mock';
import { fetchPushLog, pushSendRemote, type PushLog } from '@/lib/api';
import { useApp, useI18n } from '@/store/app-context';

/** Manager: a message to the clients' phones — a promotion, a new product — to everyone, a club, or by pass status. */
export function PushPanel({ accent }: { accent: string }) {
  const { t } = useI18n();
  const { staffCode } = useApp();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('/');
  const [audience, setAudience] = useState<'all' | 'active' | 'expired'>('all');
  const [club, setClub] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [log, setLog] = useState<{ log: PushLog[]; subscribers: number } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetchPushLog(staffCode).then((l) => live && l && setLog(l));
    return () => {
      live = false;
    };
  }, [staffCode, tick]);

  const send = async () => {
    if (!sure) {
      setSure(true);
      setTimeout(() => setSure(false), 5000);
      return;
    }
    setSure(false);
    setBusy(true);
    const r = await pushSendRemote(staffCode, { title: title.trim(), body: text.trim(), url, audience, clubId: club });
    setBusy(false);
    if (!r) return setMsg({ text: t('push_fail'), bad: true });
    setMsg({ text: t('push_sent', { n: r.sent }), bad: false });
    setTitle('');
    setText('');
    setTick((n) => n + 1);
  };

  const links: [string, string][] = [
    ['/', t('push_link_home')],
    ['/shop', t('push_link_shop')],
    ['/membership', t('push_link_plans')],
  ];

  return (
    <View style={styles.card}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Row gap={8} style={{ alignItems: 'center' }}>
          <Ionicons name="notifications-outline" size={20} color={accent} />
          <T type="subheading">{t('push_title')}</T>
        </Row>
        <T type="small" color={Colors.textMuted}>
          {log ? t('push_subs', { n: log.subscribers }) : ''}
        </T>
      </Row>
      <TextInput value={title} onChangeText={setTitle} placeholder={t('push_title_ph')} placeholderTextColor={Colors.textMuted} maxLength={60} style={styles.input} />
      <TextInput value={text} onChangeText={setText} placeholder={t('push_body_ph')} placeholderTextColor={Colors.textMuted} maxLength={240} multiline style={[styles.input, { height: 84, paddingTop: 10, textAlignVertical: 'top' }]} />

      <T type="small" color={Colors.textSecondary}>
        {t('push_who')}
      </T>
      <ChipRow>
        <Chip label={t('push_all')} active={audience === 'all'} onPress={() => setAudience('all')} />
        <Chip label={t('push_active')} active={audience === 'active'} onPress={() => setAudience('active')} />
        <Chip label={t('push_expired')} active={audience === 'expired'} onPress={() => setAudience('expired')} />
      </ChipRow>
      <ChipRow>
        <Chip label={t('all_clubs')} active={club === ''} onPress={() => setClub('')} />
        {clubs.map((c) => (
          <Chip key={c.id} label={c.name.replace('Seven Gym ', '')} active={club === c.id} onPress={() => setClub(c.id)} />
        ))}
      </ChipRow>
      <T type="small" color={Colors.textSecondary}>
        {t('push_opens')}
      </T>
      <ChipRow>
        {links.map(([u, label]) => (
          <Chip key={u} label={label} active={url === u} onPress={() => setUrl(u)} />
        ))}
      </ChipRow>

      <Button title={sure ? t('push_send_sure') : t('push_send')} icon="paper-plane-outline" onPress={() => void send()} disabled={busy || title.trim().length < 2} style={{ backgroundColor: sure ? Colors.danger : accent }} />
      {msg ? (
        <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
          {msg.text}
        </T>
      ) : null}
      <T type="small" color={Colors.textMuted}>
        {t('push_hint')}
      </T>

      {log?.log.length ? (
        <View style={{ gap: 4 }}>
          <T type="label" color={Colors.textSecondary}>
            {t('push_history')}
          </T>
          {log.log.slice(0, 8).map((p) => (
            <View key={p.id} style={styles.line}>
              <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                {p.title}
              </T>
              <T type="small" color={Colors.textMuted} numberOfLines={1}>
                {new Date(p.ts + 5 * 3600000).toISOString().slice(5, 16).replace('T', ' ').split(' ').map((x, i) => (i ? x : x.split('-').reverse().join('.'))).join(' ')} • {t('push_sent_n', { n: p.sent })} • {p.by === 'owner' ? t('role_owner') : p.by}
              </T>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  input: { minHeight: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.background },
  line: { gap: 1, paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});
