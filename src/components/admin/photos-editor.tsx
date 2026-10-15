import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PhotoPicker } from '@/components/admin/fields';
import { T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { clubs } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

/** Administrators: the photo gallery of each club. The first photo is the cover. */
export function PhotosEditor({ accent }: { accent: string }) {
  const { content, saveContent } = useApp();
  const { t } = useI18n();
  const photos = content.photos ?? {};

  const setList = (clubId: string, list: string[]) => saveContent('photos', { ...photos, [clubId]: list });

  return (
    <View style={{ gap: Spacing.three }}>
      {clubs.map((c) => {
        const mine = photos[c.id] ?? [];
        return (
          <View key={c.id} style={{ gap: Spacing.two }}>
            <T type="small" style={{ fontWeight: '700' }}>
              {c.name}
            </T>
            <View style={styles.grid}>
              {(mine.length ? mine : c.photos).map((u, i) => (
                <View key={u + i}>
                  <Image source={{ uri: u }} style={styles.photo} contentFit="cover" />
                  {mine.length ? (
                    <T type="small" color={Colors.danger} style={{ textAlign: 'center', fontWeight: '700' }} onPress={() => setList(c.id, mine.filter((x) => x !== u))}>
                      {t('adm_photo_remove')}
                    </T>
                  ) : null}
                </View>
              ))}
            </View>
            {!mine.length ? (
              <T type="small" color={Colors.textMuted}>
                {t('adm_photos_default')}
              </T>
            ) : null}
            <PhotoPicker url={undefined} onChange={(u) => u && setList(c.id, [...mine, u])} accent={accent} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photo: { width: 96, height: 72, borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt },
});
