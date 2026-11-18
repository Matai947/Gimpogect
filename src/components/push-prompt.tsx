import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Button, Card, Row, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { enablePush, pushState } from '@/lib/push';
import { useApp, useI18n } from '@/store/app-context';

const LATER = 'push-ask-later';
const WEEK = 7 * 86400000;
const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/** iPhone Safari outside the home-screen app: push comes only after «На экран Домой». */
function iphoneTab() {
  const n = navigator as Navigator & { standalone?: boolean };
  return /iPhone|iPad|iPod/.test(n.userAgent) && !n.standalone && !matchMedia('(display-mode: standalone)').matches;
}

function initial(): 'ask' | 'iphone' | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (Date.now() - Number(get(LATER) || 0) < WEEK) return null;
  const s = pushState();
  if (s === 'off') return 'ask';
  if (s === 'unsupported' && iphoneTab()) return 'iphone';
  return null;
}

/** The client's home screen: the club's messages reach only phones that turned them on, so ask right here. */
export function PushPrompt() {
  const { t } = useI18n();
  const { user, token } = useApp();
  const [mode, setMode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState('');
  if (!mode || !user) return null;

  const later = () => {
    try {
      localStorage.setItem(LATER, String(Date.now()));
    } catch {
      // private mode: it asks again next time
    }
    setMode(null);
  };
  const turnOn = async () => {
    setBusy(true);
    const r = await enablePush({ memberId: user.id, token: token ?? undefined, clubId: user.homeClubId });
    setBusy(false);
    if (r === 'on') setMode(null);
    else setBad(r === 'blocked' ? t('news_blocked') : t('push_ask_fail'));
  };

  return (
    <Card style={{ gap: Spacing.two, borderWidth: 1, borderColor: Colors.accent }}>
      <Row gap={10} style={{ alignItems: 'center' }}>
        <Ionicons name="notifications" size={24} color={Colors.accent} />
        <View style={{ flex: 1 }}>
          <T type="subheading">{t('push_ask_title')}</T>
          <T type="small" color={Colors.textSecondary}>
            {mode === 'iphone' ? t('push_ask_iphone') : t('push_ask_body')}
          </T>
        </View>
      </Row>
      {bad ? (
        <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
          {bad}
        </T>
      ) : null}
      <Row gap={8}>
        {mode === 'ask' ? <Button title={t('news_enable')} icon="notifications-outline" size="sm" onPress={() => void turnOn()} disabled={busy} style={{ flex: 1 }} /> : null}
        <Pressable onPress={later} hitSlop={8} style={{ justifyContent: 'center', paddingHorizontal: 12, flex: mode === 'ask' ? 0 : 1 }}>
          <T type="small" color={Colors.textMuted} style={{ fontWeight: '700', textAlign: 'center' }}>
            {t('push_ask_later')}
          </T>
        </Pressable>
      </Row>
    </Card>
  );
}
