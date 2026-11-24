import { Platform } from 'react-native';

// ponytail: dark mode by inverting the whole page (photos, the camera and QR codes are turned back), one switch per phone.
// The app's colours are fixed constants; a real dark palette would mean theming every screen.
const KEY = 'dark';
const CSS = `html.dark{filter:invert(1) hue-rotate(180deg);background:#fff}
html.dark img,html.dark video,html.dark svg,html.dark canvas{filter:invert(1) hue-rotate(180deg)}`;

export function isDark() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function setDark(on: boolean) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!document.getElementById('dark-css')) {
    const s = document.createElement('style');
    s.id = 'dark-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  document.documentElement.classList.toggle('dark', on);
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // private mode: it stays for this visit only
  }
}

/** The phone's last choice, put back when the app opens. */
export function restoreDark() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1') setDark(true);
  } catch {
    // no storage: light
  }
}
