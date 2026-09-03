import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/context/ThemeContext';
import { getCurrentUserId } from '@/lib/auth';
import { goBack } from '@/lib/navigation';
import { uploadProfilePhoto } from '@/lib/storage';
import { getUserProfile, updatePhotoUrl, updatePrenom } from '@/lib/users';

/**
 * "Modifier le profil" — photo + prénom, déplacés tels quels depuis
 * l'ancien src/app/settings.tsx (même logique, même debounce d'auto-save)
 * dans leur propre écran plutôt que noyés dans le hub principal.
 */
export default function EditProfileScreen() {
  const theme = useTheme();
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

  const initial = prenom.trim().charAt(0).toUpperCase() || '?';

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          // Blanc fixe : le fond du cercle reste l'accent rouge quel que
          // soit le mode clair/sombre.
          color: '#FFFFFF',
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
          marginBottom: theme.spacing.sm,
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
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Modifier le profil</Text>
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
              {/* Blanc fixe : le badge reste sur fond accent rouge. */}
              <Feather name="camera" size={14} color="#FFFFFF" />
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
      </SafeAreaView>
    </View>
  );
}
