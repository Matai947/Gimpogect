import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clientRephone } from '@/lib/api';
import { useApp, useCanManage, useI18n } from '@/store/app-context';

/** Manager and owner: the client's new phone number. The card moves to it with its pass, checks, visits and photo. */
export function RephoneClient({ id, phone, onMoved }: { id: string; phone: string; onMoved?: () => void }) {
  const { t } = useI18n();
  const { staffCode, refreshClients, refreshSales } = useApp();
  const canManage = useCanManage();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  if (!canManage) return null;
  const digits = value.replace(/\D/g, '');
  const save = async () => {
    if (!sure) return setSure(true);
    setBusy(true);
    const r = await clientRephone(staffCode, id, value);
    setBusy(false);
    setSure(false);
    if (!r.data) return setMsg({ text: r.status === 409 ? t('rp_taken') : r.status === 400 ? t('rp_bad') : t('cash_fail'), bad: true });
    setOpen(false);
    setMsg({ text: t('rp_done', { phone: r.data.phone }), bad: false });
    await Promise.all([refreshClients(), refreshSales()]);
    onMoved?.();
  };
  return (
    <View style={{ gap: 6 }}>
      {open ? (
        <>
          <T type="small" color={Colors.textSecondary}>
            {t('rp_hint', { phone: phone || '—' })}
          </T>
          <TextInput value={value} onChangeText={(x) => (setValue(x), setSure(false))} keyboardType="phone-pad" autoFocus placeholder="+7 7__ ___ __ __" placeholderTextColor={Colors.textMuted}
            style={{ height: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.three, color: Colors.text, fontSize: 16, backgroundColor: Colors.background }} />
          <Row gap={8}>
            <Button title={sure ? t('rp_sure') : t('save')} size="sm" variant={sure ? 'danger' : 'primary'} onPress={() => void save()} disabled={busy || digits.length < 10} style={{ flex: 1 }} />
            <Button title={t('cancel')} variant="secondary" size="sm" onPress={() => (setOpen(false), setValue(''), setSure(false))} style={{ flex: 1 }} />
          </Row>
        </>
      ) : (
        <Button title={t('rp_title')} icon="call-outline" variant="ghost" size="sm" onPress={() => (setOpen(true), setMsg(null))} />
      )}
      {msg ? (
        <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
          {msg.text}
        </T>
      ) : null}
    </View>
  );
}
