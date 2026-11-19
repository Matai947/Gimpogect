import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/data/mock';
import { refundRemote } from '@/lib/api';
import { useApp, useCanManage, useI18n, useRawSales } from '@/store/app-context';

const dm = (ts: number) => new Date(ts + 5 * 3600000).toISOString().slice(5, 10).split('-').reverse().join('.');

/** Manager and owner: the client's own purchases on the card, each cancelled (money back, a plan taken off the pass) with a tap. */
export function ClientSales({ id }: { id: string }) {
  const { t, td } = useI18n();
  const { staffCode, refreshSales, refreshContent, refreshClients } = useApp();
  const canManage = useCanManage();
  const sales = useRawSales();
  const [sure, setSure] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; bad: boolean } | null>(null);
  const rows = useMemo(
    () => sales.filter((x) => x.memberId === id && ['plan', 'shop', 'personal'].includes(x.kind) && (x.amount - (x.refunded ?? 0) > 0 || (x.disc === 100 && !x.amount && !x.cancelled))).sort((a, b) => b.ts - a.ts).slice(0, 6),
    [sales, id],
  );
  if (!canManage || !rows.length) return null;

  const cancel = async (saleId: string) => {
    if (sure !== saleId) {
      setSure(saleId);
      setTimeout(() => setSure((k) => (k === saleId ? null : k)), 5000);
      return;
    }
    setSure(null);
    setBusy(saleId);
    const ok = !!(await refundRemote(staffCode, saleId, t('refund_r1')));
    await Promise.all([refreshSales(), refreshContent(), refreshClients()]);
    setBusy(null);
    setMsg({ id: saleId, text: ok ? t('pos_cancel_done') : t('pos_cancel_fail'), bad: !ok });
  };

  return (
    <View style={{ gap: 6, padding: Spacing.two, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt }}>
      <T type="label" color={Colors.textSecondary}>
        {t('cs_title')}
      </T>
      {rows.map((s) => (
        <View key={s.id} style={{ gap: 4 }}>
          <Row gap={8} style={{ alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T type="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                {td(s.title)}
              </T>
              <T type="small" color={Colors.textMuted}>
                {dm(s.ts)} • {formatPrice(s.amount - (s.refunded ?? 0))} • {s.staff}
              </T>
            </View>
            <Button title={sure === s.id ? t('rt_cancel_sure') : t('cs_cancel')} icon="arrow-undo-outline" size="sm" variant="danger" onPress={() => void cancel(s.id)} disabled={busy === s.id} />
          </Row>
          {msg?.id === s.id ? (
            <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
              {msg.text}
            </T>
          ) : null}
        </View>
      ))}
    </View>
  );
}
