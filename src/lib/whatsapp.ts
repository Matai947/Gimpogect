import { Linking, Platform } from 'react-native';

/** Opens a WhatsApp chat. On a desktop browser it goes straight to WhatsApp Web; wa.me would stop on a chooser page. */
export function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const desktopWeb = Platform.OS === 'web' && typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return Linking.openURL(desktopWeb ? `https://web.whatsapp.com/send?phone=${digits}` : `https://wa.me/${digits}`);
}
