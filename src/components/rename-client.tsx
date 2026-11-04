import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useApp, useCanManage, useI18n } from '@/store/app-context';

/** Manager and owner: correct a client's name. */
export function RenameClient({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const { renameClient } = useApp();
  const canManage = useCanManage();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  if (!canManage) return null;
  const save = async () => {
    setBusy(true);
    const ok = await renameClient(id, value.trim());
    setBusy(false);
    setMsg(ok ? { text: t('rn_done'), bad: false } : { text: t('cash_fail'), bad: true });
    if (ok) setOpen(false);
  };
  return (
    <View style={{ gap: 6 }}>
      {open ? (
        <>
          <TextInput value={value} onChangeText={setValue} maxLength={60} autoFocus placeholder={t('rn_ph')} placeholderTextColor={Colors.textMuted}
            style={{ height: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.background }} />
          <Row gap={8}>
            <Button title={t('save')} size="sm" onPress={() => void save()} disabled={busy || value.trim().length < 2 || value.trim() === name} style={{ flex: 1 }} />
            <Button title={t('cancel')} variant="secondary" size="sm" onPress={() => (setOpen(false), setValue(name))} style={{ flex: 1 }} />
          </Row>
        </>
      ) : (
        <Button title={t('rn_title')} icon="create-outline" variant="ghost" size="sm" onPress={() => (setOpen(true), setValue(name), setMsg(null))} />
      )}
      {msg ? (
        <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
          {msg.text}
        </T>
      ) : null}
    </View>
  );
}
