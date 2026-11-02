import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { pushKeyRemote, pushSubRemote } from '@/lib/api';

/**
 * Push messages: Web Push in the browser (and the iPhone home-screen app from iOS 16.4),
 * Expo push in the Android app (delivered through Firebase).
 */
export function pushSupported() {
  if (Platform.OS === 'android') return true;
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

const remember = (on: boolean) => {
  try {
    if (Platform.OS === 'web') localStorage.setItem('push-on', on ? '1' : '0');
  } catch {
    // private mode: it still works, the button just shows "off" next time
  }
};

export function pushState(): 'on' | 'off' | 'blocked' | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  if (Platform.OS !== 'web') return 'off'; // the app checks with the phone when the button is pressed
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

type Who = { memberId?: string; token?: string; clubId?: string };

/** The Android app: a channel for the club's news, the phone's permission, then the Expo push token to the server. */
async function enableNative(who: Who): Promise<'on' | 'blocked' | 'fail'> {
  const Notifications = await import('expo-notifications');
  await Notifications.setNotificationChannelAsync('news', { name: 'Seven Gym', importance: Notifications.AndroidImportance.HIGH });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'blocked';
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
    return (await pushSubRemote({ expo: data }, who)) ? 'on' : 'fail';
  } catch {
    return 'fail'; // no Firebase set up in this build, or no connection
  }
}

/** Asks the phone for permission, subscribes and tells the server; answers what happened. */
export async function enablePush(who: Who): Promise<'on' | 'blocked' | 'unsupported' | 'fail'> {
  if (!pushSupported()) return 'unsupported';
  if (Platform.OS === 'android') return enableNative(who);
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
    remember(true);
    return 'on';
  } catch {
    return 'fail';
  }
}
