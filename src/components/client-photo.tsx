import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, View } from 'react-native';

import { Avatar, T } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { fetchPhoto, setPhotoRemote } from '@/lib/api';
import { useApp, useCanManage, useI18n } from '@/store/app-context';

// a photo is fetched once per client per app run (~20 KB); one request per photo however many cards ask, and every
// card showing it is told when it lands (a scan card may be re-drawn while the photo is on its way)
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<void>>();
function load(code: string, id: string, key: string) {
  let p = inflight.get(key);
  if (!p) {
    p = fetchPhoto(code, id).then((r) => {
      if (r !== undefined) cache.set(key, r); // a failed request is not remembered: the next card tries again
      inflight.delete(key);
    });
    inflight.set(key, p);
  }
  return p;
}

/** Takes a picture with the camera or picks one from the gallery, and makes it a 300×300 JPEG (~20 KB) right on the phone. */
function shoot(): Promise<string | null> {
  return new Promise((done) => {
    const input = document.createElement('input');
    input.type = 'file';
    // no `capture`: the phone offers both the camera and the gallery / files
    input.accept = 'image/*';
    // in the page while it is open: Safari on iPhone may drop the answer of a picker that is not in the page
    input.style.display = 'none';
    document.body.appendChild(input);
    // the camera closed without a picture: nothing to wait for
    input.addEventListener('cancel', () => {
      input.remove();
      done(null);
    });
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return done(null);
      const img = new window.Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const c = document.createElement('canvas');
        c.width = c.height = 300;
        c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 300, 300);
        URL.revokeObjectURL(img.src);
        done(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => done(null);
      img.src = URL.createObjectURL(file);
    };
    input.click();
  });
}

/**
 * The client's face on the card, so the desk sees the pass is used by its owner.
 * Only the staff take it (never the client); the first photo by anyone at the desk, a new one only by the manager.
 */
export function ClientPhoto({ id, name, size, photoAt }: { id: string; name: string; size: number; photoAt?: number }) {
  const { t } = useI18n();
  const { staffCode, refreshClients } = useApp();
  const canManage = useCanManage();
  // keyed by when it was taken: a photo retaken on another phone is fetched again
  const key = `${id}:${photoAt ?? 0}`;
  const [taken, setTaken] = useState<string | null>(null); // a photo just taken on this phone
  const [, setLoaded] = useState(0); // bumps when a fetched photo lands in the cache
  const hasPhoto = !!photoAt || !!taken;
  const photo = taken ?? cache.get(key) ?? null;
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!photoAt || !staffCode || cache.has(key)) return;
    let live = true;
    let tries = 0;
    const go = () =>
      void load(staffCode, id, key).then(() => {
        if (!live) return;
        if (cache.has(key)) setLoaded((n) => n + 1);
        else if (++tries < 4) setTimeout(go, 1500); // a weak network at the desk: a few more tries
      });
    go();
    return () => {
      live = false;
    };
  }, [id, key, photoAt, staffCode]);

  const take = async () => {
    const p = await shoot();
    if (!p) return;
    setBusy(true);
    const ok = await setPhotoRemote(staffCode, id, p);
    setBusy(false);
    setErr(!ok);
    if (!ok) return;
    setTaken(p);
    void refreshClients();
  };

  const canShoot = Platform.OS === 'web' && (!hasPhoto || canManage);
  const s = big ? 220 : size;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable onPress={() => photo && setBig((b) => !b)} disabled={!photo}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: s, height: s, borderRadius: big ? 16 : s / 2, backgroundColor: Colors.surfaceAlt }} />
        ) : hasPhoto && !cache.has(key) ? (
          // the photo is on its way: the desk waits for the face, not the initials
          <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.textMuted} />
          </View>
        ) : (
          <Avatar name={name} size={size} />
        )}
      </Pressable>
      {canShoot ? (
        <Pressable onPress={() => void take()} disabled={busy} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: busy ? 0.5 : 1 }}>
          <Ionicons name="camera-outline" size={14} color={err ? Colors.danger : Colors.textSecondary} />
          <T type="small" color={err ? Colors.danger : Colors.textSecondary} style={{ fontSize: 11, fontWeight: '700' }}>
            {err ? t('ph_fail') : hasPhoto ? t('ph_retake') : t('ph_take')}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
