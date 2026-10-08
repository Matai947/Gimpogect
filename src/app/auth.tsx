import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LangSwitch } from '@/components/lang-switch';
import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useApp, useI18n } from '@/store/app-context';

function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return parts.length ? `+7 ${parts.join(' ')}` : '+7 ';
}

export default function AuthScreen() {
  const { restore, login } = useApp();
  const { t } = useI18n();
  const [step, setStep] = useState<'phone' | 'password' | 'name'>('phone');
  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const phoneReady = digits.length === 10;

  const sendCode = () => {
    if (!phoneReady) return;
    setError(null);
    setStep('password');
  };

  const [checking, setChecking] = useState(false);

  // Known phone: the account comes back from the server (name, questionnaire, plan). Unknown phone: ask the name and create it.
  const verify = async () => {
    if (password.length < 6) {
      setError(t('auth_pass_short'));
      return;
    }
    setError(null);
    setChecking(true);
    const r = await restore(formatPhone(digits), password);
    setChecking(false);
    if (r === 'ok') router.replace('/(tabs)');
    else if (r === 'unknown') setStep('name');
    else setError(t(r === 'wrong' ? 'auth_pass_wrong' : r === 'reset' ? 'auth_reset_needed' : 'auth_offline'));
  };

  const finish = async () => {
    setChecking(true);
    const ok = await login(formatPhone(digits), name || t('guest'), password);
    setChecking(false);
    if (ok) router.replace('/onboarding');
    else setError(t('auth_offline'));
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#F6F6F6', Colors.background]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.topBar}>
            <LangSwitch compact />
          </View>
          <View style={styles.hero}>
            <Image source={require('../../assets/images/logo-primary.png')} style={styles.logoImg} contentFit="contain" accessibilityLabel="Seven Gym" />
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

            {step === 'password' && (
              <>
                <Pressable onPress={() => setStep('phone')} hitSlop={8}>
                  <Row gap={4}>
                    <Ionicons name="chevron-back" size={16} color={Colors.textSecondary} />
                    <T type="small" color={Colors.textSecondary}>
                      {formatPhone(digits)}
                    </T>
                  </Row>
                </Pressable>
                <T type="heading">{t('auth_pass_title')}</T>
                <T type="caption">{t('auth_pass_sub')}</T>
                <View style={styles.input}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    style={styles.inputText}
                    placeholder={t('auth_pass_ph')}
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                    onSubmitEditing={() => void verify()}
                  />
                  <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
                  </Pressable>
                </View>
                {error ? (
                  <T type="small" color={Colors.danger}>
                    {error}
                  </T>
                ) : null}
                <Button title={t('auth_confirm')} onPress={() => void verify()} disabled={password.length < 6 || checking} size="lg" />
              </>
            )}

            {step === 'name' && (
              <>
                <T type="heading">{t('auth_name_title')}</T>
                <T type="caption">{t('auth_new_sub')}</T>
                <View style={styles.input}>
                  <Ionicons name="person-outline" size={18} color={Colors.textSecondary} />
                  <TextInput value={name} onChangeText={setName} style={styles.inputText} placeholder={t('auth_name_ph')} placeholderTextColor={Colors.textMuted} autoFocus autoCapitalize="words" />
                </View>
                {error ? (
                  <T type="small" color={Colors.danger}>
                    {error}
                  </T>
                ) : null}
                <Button title={t('auth_start')} onPress={() => void finish()} disabled={checking} size="lg" icon="arrow-forward" />
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
  logoImg: { width: 240, height: 128, marginBottom: Spacing.two },
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
