import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LangSwitch } from '@/components/lang-switch';
import { StaffAccent } from '@/components/member-result';
import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { STAFF_DEMO_CODE } from '@/data/members';
import { clubs } from '@/data/mock';
import { useApp, useI18n } from '@/store/app-context';

export default function StaffLoginScreen() {
  const { staffLogin, staff } = useApp();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [name, setName] = useState(staff?.name ?? '');
  const [clubId, setClubId] = useState(staff?.clubId ?? 'c1');
  const [error, setError] = useState<string | null>(null);

  const enter = () => {
    if (code !== STAFF_DEMO_CODE) {
      setError(t('staff_code_wrong'));
      return;
    }
    staffLogin(name.trim() || t('staff_name_default'), clubId);
    router.replace('/staff');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#2A1600', Colors.background]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }} />
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
              <Ionicons name="id-card-outline" size={30} color={Colors.onAccent} />
            </View>
            <T type="title">{t('staff_title')}</T>
            <T type="caption">{t('staff_login_sub')}</T>

            <T type="label" style={{ marginTop: Spacing.four }}>
              {t('staff_code')}
            </T>
            <View style={styles.input}>
              <Ionicons name="keypad-outline" size={18} color={Colors.textSecondary} />
              <TextInput
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                keyboardType="number-pad"
                secureTextEntry
                style={[styles.inputText, { letterSpacing: 6 }]}
                placeholder="••••"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>
            <T type="small" color={error ? Colors.danger : Colors.textMuted}>
              {error ?? t('staff_code_hint')}
            </T>

            <View style={[styles.input, { marginTop: Spacing.three }]}>
              <Ionicons name="person-outline" size={18} color={Colors.textSecondary} />
              <TextInput value={name} onChangeText={setName} style={styles.inputText} placeholder={t('staff_name_ph')} placeholderTextColor={Colors.textMuted} />
            </View>

            <T type="label" style={{ marginTop: Spacing.four, marginBottom: Spacing.two }}>
              {t('staff_club')}
            </T>
            <View style={{ gap: Spacing.two }}>
              {clubs.map((c) => {
                const active = clubId === c.id;
                return (
                  <Pressable key={c.id} onPress={() => setClubId(c.id)} style={[styles.club, active && { borderColor: StaffAccent, backgroundColor: 'rgba(255,133,98,0.08)' }]}>
                    <Ionicons name="business-outline" size={18} color={active ? StaffAccent : Colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <T type="body" style={{ fontWeight: '600' }}>
                        {c.name}
                      </T>
                      <T type="small" color={Colors.textSecondary}>
                        {c.address}
                      </T>
                    </View>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? StaffAccent : Colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            <Button title={t('staff_enter')} icon="log-in-outline" size="lg" onPress={enter} disabled={code.length < 4} style={{ marginTop: Spacing.four, backgroundColor: StaffAccent }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.six, gap: 4 },
  badge: { width: 64, height: 64, borderRadius: 20, backgroundColor: StaffAccent, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  input: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.three, height: 54, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.two },
  inputText: { flex: 1, color: Colors.text, fontSize: 17, fontWeight: '600' },
  club: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
});
