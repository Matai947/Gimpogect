import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';

import { Avatar, T } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { fetchPhoto, setPhotoRemote } from '@/lib/api';
import { useApp, useCanManage, useI18n } from '@/store/app-context';

// a photo is fetched once per client per app run; ~20 KB each
const cache = new Map<string, string | null>();

/** Takes a picture with the phone's camera and makes it a 300×300 JPEG (~20 KB) right on the phone. */
function shoot(): Promise<string | null> {
  return new Promise((done) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const file = input.files?.[0];
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
export function ClientPhoto({ id, name, size, hasPhoto }: { id: string; name: string; size: number; hasPhoto: boolean }) {
  const { t } = useI18n();
  const { staffCode, refreshClients } = useApp();
  const canManage = useCanManage();
  const [photo, setPhoto] = useState<string | null>(cache.get(id) ?? null);
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!hasPhoto || cache.has(id) || !staffCode) return;
    let live = true;
    fetchPhoto(staffCode, id).then((p) => {
      cache.set(id, p);
      if (live) setPhoto(p);
    });
    return () => {
      live = false;
    };
  }, [id, hasPhoto, staffCode]);

  const take = async () => {
    const p = await shoot();
    if (!p) return;
    setBusy(true);
    const ok = await setPhotoRemote(staffCode, id, p);
    setBusy(false);
    setErr(!ok);
    if (!ok) return;
    cache.set(id, p);
    setPhoto(p);
    void refreshClients();
  };

  const canShoot = Platform.OS === 'web' && (!hasPhoto || canManage);
  const s = big ? 220 : size;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable onPress={() => photo && setBig((b) => !b)} disabled={!photo}>
        {photo ? <Image source={{ uri: photo }} style={{ width: s, height: s, borderRadius: big ? 16 : s / 2, backgroundColor: Colors.surfaceAlt }} /> : <Avatar name={name} size={size} />}
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
