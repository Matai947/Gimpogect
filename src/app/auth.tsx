import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Row, T } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/store/app-context';

const DEMO_CODE = '1234';

function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return parts.length ? `+7 ${parts.join(' ')}` : '+7 ';
}

export default function AuthScreen() {
  const { login } = useApp();
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
      setError('Неверный код. Для демо введите 1234');
    }
  };

  const finish = () => {
    login(formatPhone(digits), name);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1B2A12', Colors.background]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Ionicons name="barbell" size={34} color={Colors.onAccent} />
            </View>
            <T type="display">GYM PROJECT</T>
            <T type="body" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 280 }}>
              Абонемент, QR-вход, расписание и тренеры — в одном приложении
            </T>
          </View>

          <View style={styles.sheet}>
            {step === 'phone' && (
              <>
                <T type="heading">Вход по номеру телефона</T>
                <T type="caption">Отправим SMS с кодом подтверждения</T>
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
                <Button title="Получить код" onPress={sendCode} disabled={!phoneReady} size="lg" />
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
                <T type="heading">Введите код из SMS</T>
                <T type="caption">Демо-режим: код 1234</T>
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
                <Button title="Подтвердить" onPress={verify} disabled={code.length < 4} size="lg" />
              </>
            )}

            {step === 'name' && (
              <>
                <T type="heading">Как вас называть?</T>
                <T type="caption">Имя будет видно тренерам при записи</T>
                <View style={styles.input}>
                  <Ionicons name="person-outline" size={18} color={Colors.textSecondary} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.inputText}
                    placeholder="Ваше имя"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                    autoCapitalize="words"
                  />
                </View>
                <Button title="Начать" onPress={finish} size="lg" icon="arrow-forward" />
              </>
            )}

            <T type="small" color={Colors.textMuted} style={{ textAlign: 'center', marginTop: Spacing.two }}>
              Продолжая, вы соглашаетесь с условиями членства и политикой конфиденциальности
            </T>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
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
