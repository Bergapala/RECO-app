import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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

import { signInWithEmail, signUpWithEmail } from '@/lib/auth';

const Palette = {
  background: '#1A1A1A',
  accent: '#C0392B',
  text: '#F5F2EE',
  textMuted: 'rgba(245, 242, 238, 0.5)',
  fieldBackground: '#262626',
  disabledBackground: 'rgba(245, 242, 238, 0.08)',
  disabledText: 'rgba(245, 242, 238, 0.35)',
  separator: 'rgba(245, 242, 238, 0.15)',
};

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<'login' | 'signup' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFormValid = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password],
  );
  const loading = pendingAction !== null;

  async function handleLogin() {
    if (!isFormValid || loading) return;

    setError(null);
    setPendingAction('login');
    const { error: signInError } = await signInWithEmail(email.trim(), password);
    setPendingAction(null);

    if (signInError) {
      setError(signInError);
      return;
    }

    router.replace('/add-friends');
  }

  async function handleCreateAccount() {
    if (!isFormValid || loading) return;

    setError(null);
    setPendingAction('signup');
    const { error: signUpError } = await signUpWithEmail(email.trim(), password);
    setPendingAction(null);

    if (signUpError) {
      setError(signUpError);
      return;
    }

    router.replace('/onboarding');
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <Text style={styles.logo}>RECO</Text>

            <View style={styles.form}>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (error) setError(null);
                }}
                placeholder="Adresse email"
                placeholderTextColor={Palette.textMuted}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <View style={styles.passwordField}>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (error) setError(null);
                  }}
                  placeholder="Mot de passe"
                  placeholderTextColor={Palette.textMuted}
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={12}
                  style={styles.eyeButton}>
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={Palette.textMuted}
                  />
                </Pressable>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={handleLogin}
                disabled={!isFormValid || loading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  !isFormValid && styles.primaryButtonDisabled,
                  pressed && isFormValid && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.primaryButtonText,
                    !isFormValid && styles.primaryButtonTextDisabled,
                  ]}>
                  {loading ? 'Connexion…' : 'Se connecter'}
                </Text>
              </Pressable>

              <View style={styles.separatorRow}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>ou</Text>
                <View style={styles.separatorLine} />
              </View>

              <Pressable
                onPress={handleCreateAccount}
                disabled={!isFormValid || loading}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  !isFormValid && styles.secondaryButtonDisabled,
                  pressed && isFormValid && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.secondaryButtonText,
                    !isFormValid && styles.secondaryButtonTextDisabled,
                  ]}>
                  {pendingAction === 'signup' ? 'Création…' : 'Créer un compte'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  safeArea: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 48,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  logo: {
    color: Palette.accent,
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 44,
    letterSpacing: 2,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Palette.fieldBackground,
    paddingHorizontal: 18,
    color: Palette.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  passwordField: {
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    height: 52,
    justifyContent: 'center',
  },
  errorText: {
    color: Palette.accent,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  actions: {
    gap: 20,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: Palette.disabledBackground,
  },
  primaryButtonText: {
    color: Palette.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  primaryButtonTextDisabled: {
    color: Palette.disabledText,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.separator,
  },
  separatorText: {
    color: Palette.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonDisabled: {
    borderColor: Palette.disabledText,
  },
  secondaryButtonText: {
    color: Palette.accent,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  secondaryButtonTextDisabled: {
    color: Palette.disabledText,
  },
  pressed: {
    opacity: 0.8,
  },
});
