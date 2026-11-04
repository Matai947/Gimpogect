import { useState } from 'react';
import { View } from 'react-native';

import { Button, Row, T } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useApp, useCanManage, useI18n } from '@/store/app-context';

/** Manager and owner: remove a client card made by mistake, after a second tap to confirm. */
export function DeleteClient({ id, name, onDone }: { id: string; name: string; onDone?: () => void }) {
  const { t } = useI18n();
  const { deleteClient } = useApp();
  const canManage = useCanManage();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!canManage) return null;
  if (!sure) return <Button title={t('del_client')} icon="trash-outline" variant="ghost" size="sm" onPress={() => (setSure(true), setFailed(false))} />;
  const go = async () => {
    setBusy(true);
    const ok = await deleteClient(id);
    setBusy(false);
    if (!ok) return setFailed(true);
    onDone?.();
  };
  return (
    <View style={{ gap: 6, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.danger }}>
      <T type="small" color={Colors.danger} style={{ fontWeight: '700' }}>
        {t('del_client_q', { name })}
      </T>
      <T type="small" color={Colors.textMuted}>
        {t('del_client_hint')}
      </T>
      <Row gap={8}>
        <Button title={t('del_client_yes')} icon="trash-outline" size="sm" onPress={() => void go()} disabled={busy} style={{ flex: 1, backgroundColor: Colors.danger }} />
        <Button title={t('cancel')} variant="secondary" size="sm" onPress={() => setSure(false)} style={{ flex: 1 }} />
      </Row>
      {failed ? (
        <T type="small" color={Colors.danger}>
          {t('cash_fail')}
        </T>
      ) : null}
    </View>
  );
}
