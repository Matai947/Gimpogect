import { Platform } from 'react-native';

import { pushKeyRemote, pushSubRemote } from '@/lib/api';

/** Web Push works in the browser and in the app added to the home screen (iPhone from iOS 16.4). Not in the Android APK. */
export function pushSupported() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushState(): 'on' | 'off' | 'blocked' | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  try {
    return Notification.permission === 'granted' && localStorage.getItem('push-on') === '1' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** Asks the phone for permission, subscribes and tells the server; answers what happened. */
export async function enablePush(who: { memberId?: string; token?: string; clubId?: string }): Promise<'on' | 'blocked' | 'unsupported' | 'fail'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'fail';
  const key = await pushKeyRemote();
  if (!key) return 'fail';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
    const ok = await pushSubRemote(sub.toJSON(), who);
    if (!ok) return 'fail';
    try {
      localStorage.setItem('push-on', '1');
    } catch {
      // private mode: it still works, the button just shows "off" next time
    }
    return 'on';
  } catch {
    return 'fail';
  }
}
