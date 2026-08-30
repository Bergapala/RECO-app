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
import { theme } from '@/theme';

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

    router.replace('/complete-profile');
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
                placeholderTextColor={theme.colors.muted}
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
                  placeholderTextColor={theme.colors.muted}
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
                    color={theme.colors.muted}
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
                  {loading && pendingAction === 'login' ? 'Connexion…' : 'Se connecter'}
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

              <Pressable
                onPress={() => router.push('/phone-login')}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.phoneLinkText}>Continuer avec mon numéro</Text>
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
    backgroundColor: theme.colors.background,
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
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xxl,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  logo: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontTitle}_800ExtraBold`,
    fontSize: theme.fontSizes.xxl,
    letterSpacing: 2,
    textAlign: 'center',
  },
  form: {
    gap: theme.spacing.md,
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
  passwordField: {
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: theme.spacing.md,
    height: 52,
    justifyContent: 'center',
  },
  errorText: {
    color: theme.colors.error,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
  },
  actions: {
    gap: theme.spacing.lg,
  },
  primaryButton: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  primaryButtonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  primaryButtonTextDisabled: {
    color: theme.colors.muted,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  separatorText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
  },
  secondaryButton: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonDisabled: {
    borderColor: theme.colors.muted,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  secondaryButtonTextDisabled: {
    color: theme.colors.muted,
  },
  phoneLinkText: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.8,
  },
});
