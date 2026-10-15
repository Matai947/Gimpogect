import { useState } from 'react';
import { View } from 'react-native';

import { Field, fromLines, toLines } from '@/components/admin/fields';
import { Button, Row, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { rules } from '@/data/rules';
import { useApp, useI18n } from '@/store/app-context';
import type { Lang } from '@/i18n';

const LANGS: { key: Lang; label: string }[] = [
  { key: 'ru', label: 'Русский' },
  { key: 'kk', label: 'Қазақша' },
  { key: 'en', label: 'English' },
];

/** Administrators: the club rules clients accept at sign-up, one rule per line, in each language. */
export function RulesEditor({ accent }: { accent: string }) {
  const { content, saveContent } = useApp();
  const { t } = useI18n();
  const [text, setText] = useState<Record<Lang, string>>({ ru: fromLines(rules.ru), kk: fromLines(rules.kk), en: fromLines(rules.en) });

  const save = () => saveContent('rules', { ru: toLines(text.ru), kk: toLines(text.kk), en: toLines(text.en) });
  const reset = () => {
    saveContent('rules', {});
    setText({ ru: '', kk: '', en: '' });
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <T type="small" color={Colors.textSecondary}>
        {t('adm_rules_hint')}
      </T>
      {LANGS.map((l) => (
        <Field key={l.key} label={l.label} value={text[l.key]} onChange={(v) => setText((x) => ({ ...x, [l.key]: v }))} multiline />
      ))}
      <Row gap={Spacing.two}>
        <Button title={t('adm_rules_reset')} variant="secondary" onPress={reset} disabled={!content.rules} style={{ flex: 1 }} />
        <Button title={t('save')} icon="checkmark" onPress={save} style={{ flex: 1, backgroundColor: accent }} />
      </Row>
    </View>
  );
}
