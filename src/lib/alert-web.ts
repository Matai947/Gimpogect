import { Alert, Platform } from 'react-native';

// React Native's Alert.alert does nothing on web, which silently broke logout, notifications,
// confirmations and pickers. On web we route it through the browser's own dialogs instead.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const all = buttons?.length ? buttons : [{ text: 'OK' }];
    const cancel = all.find((b) => b.style === 'cancel');
    const actions = all.filter((b) => b.style !== 'cancel');

    if (actions.length === 0 || (actions.length === 1 && !cancel)) {
      window.alert(text);
      actions[0]?.onPress?.();
    } else if (actions.length === 1) {
      // Cancel + one action: a confirmation.
      if (window.confirm(`${text}\n\n${actions[0].text}?`)) actions[0].onPress?.();
      else cancel?.onPress?.();
    } else {
      // Several choices: a numbered list.
      const pick = Number(window.prompt(`${text}\n\n${actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}`));
      actions[pick - 1]?.onPress?.();
    }
  };
}
