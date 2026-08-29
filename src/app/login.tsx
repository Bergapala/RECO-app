import { useRef, useState } from 'react';
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

import { Spacing } from '@/constants/theme';

const Palette = {
  background: '#1A1A2E',
  accent: '#C0392B',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.55)',
  fieldBackground: 'rgba(255, 255, 255, 0.06)',
  fieldBorder: 'rgba(255, 255, 255, 0.12)',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

  function handleLogin() {
    // TODO: brancher l'authentification (email, password)
  }

  function handleCreateAccount() {
    // TODO: naviguer vers l'écran d'inscription
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Connexion</Text>
              <Text style={styles.subtitle}>Ravi de vous revoir</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={Palette.textMuted}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Mot de passe"
                placeholderTextColor={Palette.textMuted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={handleLogin}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Se connecter</Text>
              </Pressable>

              <Pressable
                onPress={handleCreateAccount}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Créer un compte</Text>
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.six,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    color: Palette.text,
    fontSize: 32,
    fontWeight: '600',
  },
  subtitle: {
    color: Palette.textMuted,
    fontSize: 15,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    height: 52,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: Palette.fieldBorder,
    backgroundColor: Palette.fieldBackground,
    paddingHorizontal: Spacing.three,
    color: Palette.text,
    fontSize: 16,
  },
  actions: {
    gap: Spacing.three,
  },
  primaryButton: {
    height: 52,
    borderRadius: Spacing.two,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Palette.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.7,
  },
});
