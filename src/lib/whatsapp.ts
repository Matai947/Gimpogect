import { Linking, Platform } from 'react-native';

/** Opens a WhatsApp chat. On a desktop browser it goes straight to WhatsApp Web; wa.me would stop on a chooser page. */
export function openWhatsApp(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, '');
  const desktopWeb = Platform.OS === 'web' && typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const msg = text ? encodeURIComponent(text) : '';
  return Linking.openURL(desktopWeb ? `https://web.whatsapp.com/send?phone=${digits}${msg ? `&text=${msg}` : ''}` : `https://wa.me/${digits}${msg ? `?text=${msg}` : ''}`);
}
