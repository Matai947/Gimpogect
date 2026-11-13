import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { T } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useI18n } from '@/store/app-context';

const ENTRY = /entry-[a-f0-9]+\.js/;

/** The version this page runs and the one the site serves now: different after a deploy. */
async function newer() {
  const mine = [...document.scripts].map((s) => s.src.match(ENTRY)?.[0]).find(Boolean);
  if (!mine) return false;
  try {
    const html = await (await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })).text();
    const live = html.match(ENTRY)?.[0];
    return !!live && live !== mine;
  } catch {
    return false;
  }
}

/**
 * Phones keep the site open for days, so a fix reaches them late. After a deploy: an app brought back after a minute
 * or more away reloads by itself (nothing is half-typed then); an app in use shows a bar to tap when it suits.
 */
export function UpdateWatcher() {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let hiddenAt = 0;
    const check = async (back: boolean) => {
      if (!(await newer())) return;
      if (back) window.location.reload();
      else setReady(true);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else void check(hiddenAt > 0 && Date.now() - hiddenAt > 60000);
    };
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(() => void check(false), 5 * 60000);
    void check(false);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(iv);
    };
  }, []);

  if (!ready) return null;
  return (
    <Pressable
      onPress={() => window.location.reload()}
      style={{ position: 'absolute', left: 12, right: 12, bottom: 90, zIndex: 1000, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: Colors.text }}>
      <Ionicons name="refresh" size={18} color="#fff" />
      <T type="small" color="#fff" style={{ flex: 1, fontWeight: '700' }}>
        {t('upd_ready')}
      </T>
    </Pressable>
  );
}
