import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/admin/fields';
import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { deleteAdmin, fetchAdmins, saveAdmin, type AdminRec } from '@/lib/api';
import { useApp, useI18n } from '@/store/app-context';

/** Owner: the administrators and their personal codes. A code is never shown back, only set anew. */
export function AdminsEditor({ accent }: { accent: string }) {
  const { staffCode } = useApp();
  const { t } = useI18n();
  const [list, setList] = useState<AdminRec[] | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState<string | null>(null); // admin id whose name/code is being changed
  const [sure, setSure] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetchAdmins(staffCode).then((l) => l && setList(l)), [staffCode]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    const r = await saveAdmin(staffCode, { id: editing ?? undefined, name: name.trim(), code });
    setBusy(false);
    if (r.status !== 200) return setMsg({ text: r.status === 409 ? t('admin_code_taken') : r.status === 0 ? t('cash_fail') : t('admin_bad'), bad: true });
    setMsg({ text: t('admin_saved', { name: name.trim() }), bad: false });
    setName('');
    setCode('');
    setEditing(null);
    void load();
  };

  const remove = async (id: string) => {
    if (sure !== id) return setSure(id);
    setSure(null);
    setBusy(true);
    const ok = await deleteAdmin(staffCode, id);
    setBusy(false);
    if (!ok) return setMsg({ text: t('cash_fail'), bad: true });
    setMsg(null);
    void load();
  };

  const startEdit = (a: AdminRec) => {
    setEditing(a.id);
    setName(a.name);
    setCode('');
    setMsg(null);
  };

  return (
    <View style={{ gap: Spacing.two }}>
      {list === null ? (
        <T type="small" color={Colors.textMuted}>
          …
        </T>
      ) : list.length === 0 ? (
        <T type="small" color={Colors.textMuted}>
          {t('admin_none')}
        </T>
      ) : (
        list.map((a) => (
          <Row key={a.id} style={[styles.row, editing === a.id && { borderColor: accent }]}>
            <View style={{ flex: 1 }}>
              <T type="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                {a.name}
              </T>
              <T type="small" color={Colors.textMuted}>
                {t('admin_code_set', { date: new Date(a.at).toLocaleDateString('ru-RU') })}
              </T>
            </View>
            <T type="small" color={accent} style={{ fontWeight: '700', padding: 6 }} onPress={() => startEdit(a)}>
              {t('edit')}
            </T>
            <T type="small" color={Colors.danger} style={{ fontWeight: '700', padding: 6 }} onPress={() => remove(a.id)}>
              {sure === a.id ? t('admin_del_sure') : t('admin_del')}
            </T>
          </Row>
        ))
      )}

      <View style={styles.form}>
        <T type="small" style={{ fontWeight: '700' }}>
          {editing ? t('admin_edit_title') : t('admin_add_title')}
        </T>
        <Field label={t('admin_name')} value={name} onChange={setName} placeholder="Айбол" />
        <Field label={editing ? t('admin_new_code') : t('admin_code')} value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))} keyboard="number-pad" placeholder="••••••" />
        <T type="small" color={Colors.textMuted}>
          {t('admin_code_hint')}
        </T>
        {msg ? (
          <T type="small" color={msg.bad ? Colors.danger : Colors.success} style={{ fontWeight: '700' }}>
            {msg.text}
          </T>
        ) : null}
        <Row gap={Spacing.two}>
          <Button title={editing ? t('save') : t('admin_add')} onPress={save} disabled={busy || name.trim().length < 2 || (!editing && code.length < 4) || (code.length > 0 && code.length < 4)} style={{ flex: 1, backgroundColor: accent }} />
          {editing ? (
            <Button
              title={t('cancel')}
              variant="secondary"
              onPress={() => {
                setEditing(null);
                setName('');
                setCode('');
              }}
            />
          ) : null}
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  form: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
});
