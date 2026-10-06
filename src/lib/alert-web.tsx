import { useEffect, useState } from 'react';
import { Alert, type AlertButton, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';

// React Native's Alert.alert does nothing on web, which silently broke logout, notifications,
// confirmations and pickers. On web we route it into a bottom sheet with big, thumb-sized buttons.
type Dialog = { title: string; message?: string; buttons: AlertButton[] };
let open: ((d: Dialog) => void) | null = null;

if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    const d: Dialog = { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] };
    if (open) open(d);
    else if (typeof window !== 'undefined') window.alert([title, message].filter(Boolean).join('\n\n'));
  };
}

/** Mount once near the root. Renders nothing on native, where Alert is already a system dialog. */
export function DialogHost() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  useEffect(() => {
    open = setDialog;
    return () => {
      open = null;
    };
  }, []);

  if (Platform.OS !== 'web' || !dialog) return null;

  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  const actions = dialog.buttons.filter((b) => b.style !== 'cancel');
  const close = (b?: AlertButton) => {
    setDialog(null);
    b?.onPress?.(undefined);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(cancel)}>
      <Pressable style={styles.backdrop} onPress={() => close(cancel)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <T type="heading" style={{ textAlign: 'center' }}>
            {dialog.title}
          </T>
          {dialog.message ? (
            <T type="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
              {dialog.message}
            </T>
          ) : null}
          <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
            {actions.map((b, i) => (
              <Pressable key={`${b.text}-${i}`} onPress={() => close(b)} style={({ pressed }) => [styles.btn, b.style === 'destructive' ? styles.danger : styles.primary, pressed && { opacity: 0.8 }]}>
                <T type="label" color={Colors.onAccent} style={{ textAlign: 'center' }}>
                  {b.text}
                </T>
              </Pressable>
            ))}
            {cancel || actions.length > 0 ? (
              <Pressable onPress={() => close(cancel)} style={({ pressed }) => [styles.btn, styles.ghost, pressed && { opacity: 0.8 }]}>
                <T type="label" style={{ textAlign: 'center' }}>
                  {cancel?.text ?? 'OK'}
                </T>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two, maxHeight: '85%' },
  btn: { minHeight: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  primary: { backgroundColor: Colors.accent },
  danger: { backgroundColor: Colors.danger },
  ghost: { backgroundColor: Colors.surfaceAlt },
});
