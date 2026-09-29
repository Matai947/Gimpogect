import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Dimensions, View } from 'react-native';

import { Button, Card, EmptyState, Screen, SectionHeader, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { formatDateLong, news } from '@/data/mock';

const W = Dimensions.get('window').width;

export default function NewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = news.find((n) => n.id === id);
  if (!item) {
    return (
      <Screen>
        <EmptyState icon="newspaper-outline" title="Новость не найдена" />
      </Screen>
    );
  }
  const others = news.filter((n) => n.id !== id);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Новости' }} />
      <Image source={{ uri: item.image }} style={{ width: W, height: 220 }} contentFit="cover" transition={200} />
      <View style={{ padding: Spacing.three }}>
        <T type="caption">{formatDateLong(item.date)}</T>
        <T type="title" style={{ marginTop: 4 }}>
          {item.title}
        </T>
        <T type="body" color={Colors.textSecondary} style={{ marginTop: Spacing.three, fontSize: 16, lineHeight: 24 }}>
          {item.body}
        </T>
        <Button title="К расписанию" icon="calendar-outline" style={{ marginTop: Spacing.four }} onPress={() => router.push('/(tabs)/schedule')} />

        <View style={{ marginTop: Spacing.five }}>
          <SectionHeader title="Другие новости" />
          <View style={{ gap: Spacing.two }}>
            {others.map((n) => (
              <Card key={n.id} onPress={() => router.replace(`/news/${n.id}`)} style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
                <Image source={{ uri: n.image }} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <T type="subheading" numberOfLines={2}>
                    {n.title}
                  </T>
                  <T type="small" color={Colors.textSecondary}>
                    {n.subtitle}
                  </T>
                </View>
              </Card>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}
