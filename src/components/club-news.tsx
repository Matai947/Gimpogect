import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button, Card, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fetchNews, type NewsItem } from '@/lib/api';
import { enablePush, pushState } from '@/lib/push';
import { useApp, useI18n } from '@/store/app-context';

/** The client's profile: turn on the club's push messages, and read the last ones here too (also on phones without push). */
export function ClubNews() {
  const { t } = useI18n();
  const { user, token } = useApp();
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [state, setState] = useState(pushState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchNews().then((n) => live && n && setNews(n));
    return () => {
      live = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    const r = await enablePush({ memberId: user?.id, token: token ?? undefined, clubId: user?.homeClubId });
    setBusy(false);
    setState(r === 'on' ? 'on' : r === 'blocked' ? 'blocked' : r === 'unsupported' ? 'unsupported' : 'off');
  };

  return (
    <Card style={{ gap: Spacing.two }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Row gap={8} style={{ alignItems: 'center' }}>
          <Ionicons name="notifications-outline" size={20} color={Colors.accent} />
          <T type="subheading">{t('news_title')}</T>
        </Row>
        {state === 'on' ? (
          <T type="small" color={Colors.success} style={{ fontWeight: '700' }}>
            {t('news_on')}
          </T>
        ) : null}
      </Row>
      {state === 'off' ? <Button title={t('news_enable')} icon="notifications-outline" size="sm" onPress={() => void turnOn()} disabled={busy} /> : null}
      {state === 'blocked' ? (
        <T type="small" color={Colors.textMuted}>
          {t('news_blocked')}
        </T>
      ) : null}
      {state === 'unsupported' ? (
        <T type="small" color={Colors.textMuted}>
          {t('news_unsupported')}
        </T>
      ) : null}
      {news?.length ? (
        news.slice(0, 5).map((n) => (
          <Pressable key={n.ts} onPress={() => n.url && n.url !== '/' && router.push(n.url as Href)} style={styles.item}>
            <T type="small" style={{ fontWeight: '700' }}>
              {n.title}
            </T>
            {n.body ? (
              <T type="small" color={Colors.textSecondary}>
                {n.body}
              </T>
            ) : null}
            <T type="small" color={Colors.textMuted}>
              {new Date(n.ts + 5 * 3600000).toISOString().slice(0, 10).split('-').reverse().join('.')}
            </T>
          </Pressable>
        ))
      ) : (
        <T type="small" color={Colors.textMuted}>
          {news ? t('news_none') : '…'}
        </T>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { gap: 2, padding: Spacing.two, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
});
