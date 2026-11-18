import { useState } from 'react';
import { View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { freeEntryRemote } from '@/lib/api';
import { useApp, useCanManage, useI18n } from '@/store/app-context';

/** Manager and owner: let this client in without a pass (the client shows the QR as usual, each entry is logged), or take it back. */
export function FreeEntry({ id, on }: { id: string; on: boolean }) {
  const { t } = useI18n();
  const { staffCode, refreshClients } = useApp();
  const canManage = useCanManage();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  if (!canManage) return null;
  const flip = async () => {
    if (!on && !sure) return setSure(true);
    setSure(false);
    setBusy(true);
    const ok = await freeEntryRemote(staffCode, id, !on);
    setBad(!ok);
    if (ok) await refreshClients();
    setBusy(false);
  };
  return (
    <View style={{ gap: 4 }}>
      <Button title={on ? t('fe_off') : sure ? t('fe_sure') : t('fe_on')} icon={on ? 'lock-closed-outline' : 'key-outline'} variant={sure ? 'danger' : 'ghost'} size="sm" onPress={() => void flip()} disabled={busy} />
      {bad ? (
        <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
          {t('cash_fail')}
        </T>
      ) : null}
    </View>
  );
}
