import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { getCurrentUserId, signOut } from '@/lib/auth';
import { uploadProfilePhoto } from '@/lib/storage';
import { getUserProfile, updatePhotoUrl, updatePrenom } from '@/lib/users';
import { theme } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [prenom, setPrenom] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    getCurrentUserId().then(async (userId) => {
      setCurrentUserId(userId);
      if (userId) {
        const profile = await getUserProfile(userId);
        setPrenom(profile?.prenom ?? '');
        setPhotoUrl(profile?.photoUrl ?? null);
      }
      hasLoadedRef.current = true;
    });
  }, []);

  // Sauvegarde auto du prénom, avec un léger debounce pour ne pas écrire à
  // chaque frappe. Ignore le tout premier passage (chargement initial).
  useEffect(() => {
    if (!hasLoadedRef.current || !currentUserId) return;

    const timeout = setTimeout(() => {
      updatePrenom(currentUserId, prenom.trim());
    }, 500);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prenom]);

  async function handleChangePhoto() {
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

    if (uploadedUrl) {
      setPhotoUrl(uploadedUrl);
      await updatePhotoUrl(currentUserId, uploadedUrl);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  const initial = prenom.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.content}>
          <Pressable
            onPress={handleChangePhoto}
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
            {uploadingPhoto ? 'Envoi en cours…' : 'Modifier la photo'}
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Prénom</Text>
            <TextInput
              value={prenom}
              onChangeText={setPrenom}
              placeholder="Ton prénom"
              placeholderTextColor={theme.colors.muted}
              style={styles.fieldInput}
            />
          </View>
        </View>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.md,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.sm,
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
  fieldInput: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
  },
  signOutButton: {
    height: 52,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: theme.colors.error,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  pressed: {
    opacity: 0.85,
  },
});
