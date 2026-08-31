import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

import { getCurrentUserId } from '@/lib/auth';
import { uploadProfilePhoto } from '@/lib/storage';
import {
  getUserProfile,
  isUsernameAvailable,
  isValidUsernameFormat,
  updatePhone,
  updatePhotoUrl,
  updatePrenom,
  updateUsername,
} from '@/lib/users';
import { theme } from '@/theme';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function CompleteProfileScreen() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [prenom, setPrenom] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [phone, setPhone] = useState('');
  const [hasExistingPhone, setHasExistingPhone] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        const profile = await getUserProfile(userId);
        setPrenom(profile?.prenom ?? '');
        setPhotoUrl(profile?.photoUrl ?? null);
        setHasExistingPhone(Boolean(profile?.phone));
        // Le username n'est volontairement pas pré-rempli : celui déjà en
        // base à ce stade n'est qu'un placeholder généré à l'inscription
        // (voir la migration username_and_friend_requests), pas un vrai
        // choix de l'utilisateur.
      }
    });
  }, []);

  // Vérification de disponibilité en temps réel, avec un léger debounce
  // pour ne pas interroger la base à chaque frappe.
  useEffect(() => {
    if (username.length === 0) {
      setUsernameStatus('idle');
      return;
    }

    if (!isValidUsernameFormat(username)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const available = await isUsernameAvailable(username, currentUserId);
      if (!cancelled) setUsernameStatus(available ? 'available' : 'taken');
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [username, currentUserId]);

  async function handlePickPhoto() {
    if (!currentUserId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    const uploadedUrl = await uploadProfilePhoto(currentUserId, result.assets[0].uri);
    setUploadingPhoto(false);

    if (uploadedUrl) setPhotoUrl(uploadedUrl);
  }

  async function handleContinue() {
    if (!currentUserId || !isValid || saving) return;

    setSaving(true);
    await Promise.all([
      updatePrenom(currentUserId, prenom.trim()),
      updateUsername(currentUserId, username),
    ]);
    if (photoUrl) await updatePhotoUrl(currentUserId, photoUrl);
    if (!hasExistingPhone && phone.trim().length > 0) {
      await updatePhone(currentUserId, phone.trim());
    }
    setSaving(false);

    router.replace('/add-friends');
  }

  const initial = prenom.trim().charAt(0).toUpperCase() || '?';
  const isValid = prenom.trim().length > 0 && usernameStatus === 'available';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <Text style={styles.title}>Complète ton profil</Text>
            <Text style={styles.subtitle}>Pour que tes potes te reconnaissent</Text>

            <Pressable
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
              style={styles.avatarWrapper}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Feather name="camera" size={14} color={theme.colors.text} />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>
              {uploadingPhoto ? 'Envoi en cours…' : 'Photo de profil (facultatif)'}
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Prénom</Text>
              <TextInput
                value={prenom}
                onChangeText={setPrenom}
                placeholder="Ton prénom"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nom d&rsquo;utilisateur</Text>
              <View style={styles.usernameInputRow}>
                <Text style={styles.usernamePrefix}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={(value) => setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="tonpseudo"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.usernameInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
                {usernameStatus === 'checking' && (
                  <ActivityIndicator size="small" color={theme.colors.muted} />
                )}
                {usernameStatus === 'available' && (
                  <Feather name="check" size={20} color={theme.colors.success} />
                )}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                  <Feather name="x" size={20} color={theme.colors.error} />
                )}
              </View>
              {usernameStatus === 'taken' && (
                <Text style={styles.usernameHintError}>Ce nom d&rsquo;utilisateur est déjà pris.</Text>
              )}
              {usernameStatus === 'invalid' && username.length > 0 && (
                <Text style={styles.usernameHintError}>
                  3 à 20 caractères : lettres minuscules, chiffres, underscore.
                </Text>
              )}
            </View>

            {!hasExistingPhone && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Numéro de téléphone (facultatif)</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+33612345678"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
              </View>
            )}

            <Pressable
              onPress={handleContinue}
              disabled={!isValid || saving}
              style={[styles.primaryButton, (!isValid || saving) && styles.primaryButtonDisabled]}>
              <Text
                style={[styles.primaryButtonText, !isValid && styles.primaryButtonTextDisabled]}>
                {saving ? 'Enregistrement…' : 'Continuer'}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.full,
  },
  avatarFallback: {
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    borderWidth: 2,
    borderColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
    marginBottom: theme.spacing.lg,
  },
  field: {
    width: '100%',
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.xs,
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
  usernameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
  },
  usernamePrefix: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.md,
  },
  usernameInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
  },
  usernameHintError: {
    color: theme.colors.error,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
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
});
