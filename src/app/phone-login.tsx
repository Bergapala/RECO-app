import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { getCurrentUserId, sendPhoneOtp, verifyPhoneOtp } from '@/lib/auth';
import { getUserProfile } from '@/lib/users';
import { theme } from '@/theme';

/** Format E.164 minimal : + suivi de 8 à 15 chiffres. */
function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export default function PhoneLoginScreen() {
  const router = useRouter();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    if (loading) return;

    if (!isValidE164(phone)) {
      setError('Entre un numéro au format international, ex. +33612345678.');
      return;
    }

    setError(null);
    setLoading(true);
    const { error: sendError } = await sendPhoneOtp(phone.trim());
    setLoading(false);

    if (sendError) {
      setError(sendError);
      return;
    }

    setStep('code');
  }

  async function handleVerifyCode() {
    if (loading || code.trim().length === 0) return;

    setError(null);
    setLoading(true);
    const { error: verifyError } = await verifyPhoneOtp(phone.trim(), code.trim());

    if (verifyError) {
      setLoading(false);
      setError(verifyError);
      return;
    }

    const userId = await getCurrentUserId();
    const profile = userId ? await getUserProfile(userId) : null;
    setLoading(false);

    router.replace(profile?.prenom ? '/add-friends' : '/complete-profile');
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (step === 'code' ? setStep('phone') : router.back())}
            hitSlop={12}
            style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <Text style={styles.title}>
              {step === 'phone' ? 'Ton numéro' : 'Code de vérification'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? "On t'envoie un code par SMS pour te connecter."
                : `Code envoyé au ${phone}`}
            </Text>

            {step === 'phone' ? (
              <TextInput
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  if (error) setError(null);
                }}
                placeholder="+33612345678"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="send"
                onSubmitEditing={handleSendCode}
              />
            ) : (
              <TextInput
                value={code}
                onChangeText={(value) => {
                  setCode(value);
                  if (error) setError(null);
                }}
                placeholder="123456"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
              />
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              onPress={step === 'phone' ? handleSendCode : handleVerifyCode}
              disabled={loading}
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}>
              <Text style={styles.primaryButtonText}>
                {loading
                  ? 'Chargement…'
                  : step === 'phone'
                    ? 'Envoyer le code'
                    : 'Vérifier'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
  },
  subtitle: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
    marginBottom: theme.spacing.sm,
  },
  input: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
  },
  errorText: {
    color: theme.colors.error,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
  },
  primaryButton: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  primaryButtonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
});
