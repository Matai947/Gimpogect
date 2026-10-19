import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LangSwitch } from '@/components/lang-switch';
import { StaffAccent } from '@/components/member-result';
import { Button, Chip, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { trainers } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

/** A trainer picks their name and enters the PIN the administrators gave them. */
export default function TrainerLoginScreen() {
  const { trainerLogin } = useApp();
  const { t } = useI18n();
  const [id, setId] = useState(trainers[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    setBusy(true);
    setError(null);
    const r = await trainerLogin(id, pin);
    setBusy(false);
    if (r === 'ok') router.replace('/mytrainer' as Href);
    else setError(t(r === 'wrong' ? 'tm_wrong' : r === 'locked' ? 'tm_locked' : r === 'nopin' ? 'tm_nopin' : 'tm_offline'));
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#FFF1E9', Colors.background]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth'))} hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
            <LangSwitch compact />
          </Row>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.badge}>
              <Ionicons name="barbell-outline" size={30} color={Colors.onAccent} />
            </View>
            <T type="title">{t('tm_enter')}</T>
            <T type="caption">{t('tm_login_sub')}</T>

            <Row gap={6} style={{ flexWrap: 'wrap', marginTop: Spacing.three }}>
              {trainers.map((tr) => (
                <Chip key={tr.id} label={tr.name.split(' ').slice(0, 2).join(' ')} active={id === tr.id} onPress={() => { setId(tr.id); setError(null); }} />
              ))}
            </Row>

            <View style={[styles.input, { marginTop: Spacing.three }]}>
              <Ionicons name="keypad-outline" size={18} color={Colors.textSecondary} />
              <TextInput
                value={pin}
                onChangeText={(v) => {
                  setPin(v.replace(/\D/g, '').slice(0, 8));
                  setError(null);
                }}
                keyboardType="number-pad"
                secureTextEntry
                style={[styles.inputText, { letterSpacing: 6 }]}
                placeholder={t('tm_pin_ph')}
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={() => void enter()}
              />
            </View>
            {error ? (
              <T type="small" color={Colors.danger}>
                {error}
              </T>
            ) : null}
            <Button title={t('tm_go')} icon="log-in-outline" size="lg" onPress={() => void enter()} disabled={pin.length < 4 || busy || !id} style={{ marginTop: Spacing.three, backgroundColor: StaffAccent }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.six, gap: 4 },
  badge: { width: 64, height: 64, borderRadius: 20, backgroundColor: StaffAccent, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  input: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 54, borderWidth: 1, borderColor: Colors.border },
  inputText: { flex: 1, color: Colors.text, fontSize: 17, fontWeight: '600' },
});
