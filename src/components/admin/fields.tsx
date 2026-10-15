import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { uploadPhoto } from '@/lib/api';
import { useApp, useI18n } from '@/store/app-context';

/** A section card of the admin panel: collapsed until opened. */
export function AdminSection({ title, hint, accent, children }: { title: string; hint?: string; accent: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { contentStatus } = useApp();
  const { t } = useI18n();
  return (
    <View style={[styles.card, open && { borderColor: accent }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.head}>
        <View style={{ flex: 1 }}>
          <T type="subheading">{title}</T>
          {hint ? (
            <T type="small" color={Colors.textSecondary}>
              {hint}
            </T>
          ) : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} />
      </Pressable>
      {open ? (
        <View style={{ gap: Spacing.two }}>
          {children}
          {contentStatus !== 'idle' ? (
            <T type="small" color={contentStatus === 'fail' ? Colors.danger : contentStatus === 'ok' ? Colors.success : Colors.textMuted} style={{ fontWeight: '700' }}>
              {t(contentStatus === 'fail' ? 'adm_fail' : contentStatus === 'ok' ? 'adm_saved' : 'adm_saving')}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function Field({ label, value, onChange, keyboard, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; keyboard?: 'number-pad' | 'phone-pad'; multiline?: boolean; placeholder?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T type="small" color={Colors.textMuted}>
        {label}
      </T>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboard}
        multiline={multiline}
        style={[styles.input, multiline && { height: 110, paddingTop: 10, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Toggle({ label, value, onChange, accent }: { label: string; value: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <T type="body" style={{ flex: 1 }}>
        {label}
      </T>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: accent }} />
    </Row>
  );
}

/** One line per item, for lists such as qualifications or rules. */
export const toLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
export const fromLines = (a?: string[]) => (a ?? []).join('\n');

/** Picks a photo, sends it to the server and gives back its address. */
export function PhotoPicker({ url, onChange, accent }: { url?: string; onChange: (url: string | undefined) => void; accent: string }) {
  const { staffCode } = useApp();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const pick = async () => {
    if (!staffCode || busy) return;
    setFailed(false);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.6, base64: true });
      const a = !res.canceled ? res.assets[0] : null;
      if (!a?.base64) return;
      setBusy(true);
      const ext = (a.mimeType?.split('/')[1] ?? a.uri.split('.').pop() ?? 'jpg').replace('jpeg', 'jpg').slice(0, 4);
      const link = await uploadPhoto(staffCode, ext, a.base64);
      if (link) onChange(link);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Spacing.two }}>
      {url ? <Image source={{ uri: url }} style={styles.photo} contentFit="cover" /> : null}
      <Row gap={Spacing.two}>
        <Button title={busy ? t('adm_uploading') : url ? t('adm_photo_change') : t('adm_photo_add')} icon="image-outline" variant="secondary" size="sm" onPress={() => void pick()} disabled={busy} style={{ flex: 1 }} />
        {url ? <Button title={t('adm_photo_remove')} variant="ghost" size="sm" onPress={() => onChange(undefined)} /> : null}
      </Row>
      {failed ? (
        <T type="small" color={Colors.danger}>
          {t('adm_photo_failed')}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { minHeight: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.three, fontSize: 15, color: Colors.text },
  photo: { width: 120, height: 160, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
});
