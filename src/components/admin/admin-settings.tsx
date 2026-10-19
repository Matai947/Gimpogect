import { View } from 'react-native';

import { AdminSection } from '@/components/admin/fields';
import { AppointmentsEditor } from '@/components/admin/appointments-editor';
import { ClassesEditor } from '@/components/admin/classes-editor';
import { PhotosEditor } from '@/components/admin/photos-editor';
import { PlansEditor } from '@/components/admin/plans-editor';
import { PromosEditor } from '@/components/admin/promos-editor';
import { RulesEditor } from '@/components/admin/rules-editor';
import { TrainersEditor } from '@/components/admin/trainers-editor';
import { T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useI18n } from '@/store/app-context';

/** Everything the administration changes without a developer. Used by the owner and by the front desk. */
export function AdminSettings({ accent }: { accent: string }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: Spacing.three }}>
      <T type="caption" color={Colors.textSecondary}>
        {t('adm_intro')}
      </T>
      <AdminSection title={t('adm_plans')} hint={t('adm_plans_hint')} accent={accent}>
        <PlansEditor accent={accent} />
      </AdminSection>
      <AdminSection title={t('adm_trainers')} hint={t('adm_trainers_hint')} accent={accent}>
        <TrainersEditor accent={accent} />
      </AdminSection>
      <AdminSection title={t('adm_schedule')} hint={t('adm_schedule_hint')} accent={accent}>
        <ClassesEditor accent={accent} />
      </AdminSection>
      <AdminSection title={t('appt_title')} hint={t('appt_title_hint')} accent={accent}>
        <AppointmentsEditor accent={accent} />
      </AdminSection>
      <AdminSection title={t('adm_promos')} hint={t('adm_promos_hint')} accent={accent}>
        <PromosEditor accent={accent} />
      </AdminSection>
      <AdminSection title={t('adm_rules')} hint={t('adm_rules_hint_short')} accent={accent}>
        <RulesEditor accent={accent} />
      </AdminSection>
      <AdminSection title={t('adm_photos')} hint={t('adm_photos_hint')} accent={accent}>
        <PhotosEditor accent={accent} />
      </AdminSection>
    </View>
  );
}
