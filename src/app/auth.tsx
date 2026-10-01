import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LangSwitch } from '@/components/lang-switch';
import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useApp, useI18n } from '@/store/app-context';

const DEMO_CODE = '1234';

function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return parts.length ? `+7 ${parts.join(' ')}` : '+7 ';
}

export default function AuthScreen() {
  const { login } = useApp();
  const { t } = useI18n();
  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const phoneReady = digits.length === 10;

  const sendCode = () => {
    if (!phoneReady) return;
    setError(null);
    setStep('code');
  };

  const verify = () => {
    if (code === DEMO_CODE) {
      setError(null);
      setStep('name');
    } else {
      setError(t('auth_code_wrong'));
    }
  };

  const finish = () => {
    login(formatPhone(digits), name || t('guest'));
    router.replace('/onboarding');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1C1230', Colors.background]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.topBar}>
            <LangSwitch compact />
          </View>
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Ionicons name="barbell" size={34} color={Colors.onAccent} />
            </View>
            <T type="display" style={{ fontSize: 34, lineHeight: 40 }}>Gym Project</T>
            <T type="body" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 280 }}>
              {t('auth_tagline')}
            </T>
          </View>

          <View style={styles.sheet}>
            {step === 'phone' && (
              <>
                <T type="heading">{t('auth_phone_title')}</T>
                <T type="caption">{t('auth_phone_sub')}</T>
                <View style={styles.input}>
                  <Ionicons name="call-outline" size={18} color={Colors.textSecondary} />
                  <TextInput
                    value={formatPhone(digits)}
                    onChangeText={(v) => setDigits(v.replace(/\D/g, '').replace(/^7/, '').slice(0, 10))}
                    keyboardType="phone-pad"
                    style={styles.inputText}
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                  />
                </View>
                <Button title={t('auth_get_code')} onPress={sendCode} disabled={!phoneReady} size="lg" />
              </>
            )}

            {step === 'code' && (
              <>
                <Pressable onPress={() => setStep('phone')} hitSlop={8}>
                  <Row gap={4}>
                    <Ionicons name="chevron-back" size={16} color={Colors.textSecondary} />
                    <T type="small" color={Colors.textSecondary}>
                      {formatPhone(digits)}
                    </T>
                  </Row>
                </Pressable>
                <T type="heading">{t('auth_code_title')}</T>
                <T type="caption">{t('auth_code_sub')}</T>
                <View style={styles.input}>
                  <Ionicons name="keypad-outline" size={18} color={Colors.textSecondary} />
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    style={[styles.inputText, { letterSpacing: 8 }]}
                    placeholder="••••"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                  />
                </View>
                {error ? (
                  <T type="small" color={Colors.danger}>
                    {error}
                  </T>
                ) : null}
                <Button title={t('auth_confirm')} onPress={verify} disabled={code.length < 4} size="lg" />
              </>
            )}

            {step === 'name' && (
              <>
                <T type="heading">{t('auth_name_title')}</T>
                <T type="caption">{t('auth_name_sub')}</T>
                <View style={styles.input}>
                  <Ionicons name="person-outline" size={18} color={Colors.textSecondary} />
                  <TextInput value={name} onChangeText={setName} style={styles.inputText} placeholder={t('auth_name_ph')} placeholderTextColor={Colors.textMuted} autoFocus autoCapitalize="words" />
                </View>
                <Button title={t('auth_start')} onPress={finish} size="lg" icon="arrow-forward" />
              </>
            )}

            <T type="small" color={Colors.textMuted} style={{ textAlign: 'center', marginTop: Spacing.two }}>
              {t('auth_terms')}
            </T>
            <Pressable onPress={() => router.push('/staff-login')} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Row gap={6}>
                <Ionicons name="id-card-outline" size={14} color={Colors.textSecondary} />
                <T type="small" color={Colors.textSecondary} style={{ fontWeight: '700' }}>
                  {t('staff_entry')}
                </T>
              </Row>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputText: { flex: 1, color: Colors.text, fontSize: 18, fontWeight: '600' },
});
