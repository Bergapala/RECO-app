import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { getCurrentUserId } from '@/lib/auth';
import { fetchOpenGraphMetadata, isValidHttpUrl } from '@/lib/opengraph';
import { createReco } from '@/lib/recos';
import { uploadRecoImage } from '@/lib/storage';
import { theme } from '@/theme';

const CATEGORIES = [
  { emoji: '🎬', label: 'Film/Série' },
  { emoji: '📺', label: 'YouTube' },
  { emoji: '🎧', label: 'Podcast' },
  { emoji: '🎶', label: 'Musique' },
  { emoji: '📃', label: 'Article' },
  { emoji: '📚', label: 'Livre' },
  { emoji: '🍽️', label: 'Resto' },
  { emoji: '🎮', label: 'Jeu vidéo' },
  { emoji: '📱', label: 'App' },
  { emoji: '🌍', label: 'Autre' },
];

type Step = 1 | 2 | 3 | 'confirmation';

export default function AddRecoScreen() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);

  // Étape 1
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [checkingUrl, setCheckingUrl] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);

  // Étape 2
  const [commentaire, setCommentaire] = useState('');

  // Étape 3
  const [categorie, setCategorie] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  function confirmLeave() {
    Alert.alert('Tu veux vraiment annuler ?', 'Ta reco ne sera pas publiée.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  async function handleValidateLink() {
    if (checkingUrl) return;

    if (!isValidHttpUrl(url)) {
      setUrlError('Ce lien ne semble pas valide.');
      setManualMode(true);
      return;
    }

    setUrlError(null);
    setCheckingUrl(true);
    const metadata = await fetchOpenGraphMetadata(url);
    setCheckingUrl(false);

    if (!metadata?.title) {
      setUrlError("Impossible de récupérer un aperçu pour ce lien — complète-le à la main.");
      setManualMode(true);
      return;
    }

    setPreviewTitle(metadata.title);
    setPreviewImage(metadata.image);
    setStep(2);
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPickedImageUri(result.assets[0].uri);
    }
  }

  async function handleContinueManual() {
    if (previewTitle.trim().length === 0 || checkingUrl) return;

    let finalImage: string | null = null;
    if (pickedImageUri && currentUserId) {
      setCheckingUrl(true);
      finalImage = await uploadRecoImage(currentUserId, pickedImageUri);
      setCheckingUrl(false);
    }

    setPreviewImage(finalImage);
    setStep(2);
  }

  function handlePublish() {
    if (!categorie || !currentUserId || publishing) return;

    setPublishing(true);
    createReco({
      userId: currentUserId,
      titre: previewTitle.trim(),
      url: isValidHttpUrl(url) ? url.trim() : null,
      apercuImage: previewImage,
      commentaire: commentaire.trim(),
      categorie,
    }).then(() => {
      setPublishing(false);
      setStep('confirmation');
      setTimeout(() => router.replace('/feed'), 2000);
    });
  }

  if (step === 'confirmation') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.confirmationSafeArea}>
          <Text style={styles.confirmationTitle}>Reco publiée 🔴</Text>
          <Text style={styles.confirmationSubtitle}>Tes potes vont adorer</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={confirmLeave} hitSlop={12} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Nouvelle reco</Text>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            {step === 1 && (
              <StepUrl
                url={url}
                onChangeUrl={(value) => {
                  setUrl(value);
                  setUrlError(null);
                }}
                urlError={urlError}
                checking={checkingUrl}
                manualMode={manualMode}
                previewTitle={previewTitle}
                onChangePreviewTitle={setPreviewTitle}
                pickedImageUri={pickedImageUri}
                onPickImage={handlePickImage}
                onValidateLink={handleValidateLink}
                onContinueManual={handleContinueManual}
              />
            )}

            {step === 2 && (
              <StepComment
                previewTitle={previewTitle}
                previewImage={previewImage ?? pickedImageUri}
                commentaire={commentaire}
                onChangeCommentaire={setCommentaire}
                onNext={() => setStep(3)}
              />
            )}

            {step === 3 && (
              <StepCategory
                categorie={categorie}
                onSelectCategorie={setCategorie}
                onPublish={handlePublish}
                publishing={publishing}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

type StepUrlProps = {
  url: string;
  onChangeUrl: (value: string) => void;
  urlError: string | null;
  checking: boolean;
  manualMode: boolean;
  previewTitle: string;
  onChangePreviewTitle: (value: string) => void;
  pickedImageUri: string | null;
  onPickImage: () => void;
  onValidateLink: () => void;
  onContinueManual: () => void;
};

function StepUrl({
  url,
  onChangeUrl,
  urlError,
  checking,
  manualMode,
  previewTitle,
  onChangePreviewTitle,
  pickedImageUri,
  onPickImage,
  onValidateLink,
  onContinueManual,
}: StepUrlProps) {
  const canContinueManual = previewTitle.trim().length > 0;

  return (
    <View style={styles.stepGap}>
      <TextInput
        value={url}
        onChangeText={onChangeUrl}
        placeholder="Colle ton lien ici 🔗"
        placeholderTextColor={theme.colors.muted}
        style={styles.urlInput}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={onValidateLink}
      />

      {urlError && <Text style={styles.errorText}>{urlError}</Text>}

      {!manualMode && (
        <PrimaryButton label="Valider le lien" onPress={onValidateLink} loading={checking} />
      )}

      {manualMode && (
        <View style={styles.manualForm}>
          <TextInput
            value={previewTitle}
            onChangeText={onChangePreviewTitle}
            placeholder="Titre de ta reco"
            placeholderTextColor={theme.colors.muted}
            style={styles.urlInput}
          />

          <Pressable
            onPress={onPickImage}
            style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}>
            <Feather name="image" size={18} color={theme.colors.accent} />
            <Text style={styles.uploadButtonText}>
              {pickedImageUri ? 'Changer l’image' : 'Ajouter une image (optionnel)'}
            </Text>
          </Pressable>

          {pickedImageUri && <Image source={{ uri: pickedImageUri }} style={styles.pickedImage} />}

          <PrimaryButton
            label="Continuer"
            onPress={onContinueManual}
            disabled={!canContinueManual}
            loading={checking}
          />
        </View>
      )}
    </View>
  );
}

type StepCommentProps = {
  previewTitle: string;
  previewImage: string | null;
  commentaire: string;
  onChangeCommentaire: (value: string) => void;
  onNext: () => void;
};

function StepComment({
  previewTitle,
  previewImage,
  commentaire,
  onChangeCommentaire,
  onNext,
}: StepCommentProps) {
  const isFilled = commentaire.trim().length > 0;

  return (
    <View style={styles.stepGap}>
      <View style={styles.previewCard}>
        {previewImage ? (
          <Image source={{ uri: previewImage }} style={styles.previewCardImage} />
        ) : (
          <View style={[styles.previewCardImage, styles.previewCardImagePlaceholder]}>
            <Feather name="link" size={24} color={theme.colors.muted} />
          </View>
        )}
        <Text style={styles.previewCardTitle} numberOfLines={2}>
          {previewTitle}
        </Text>
      </View>

      <View>
        <TextInput
          value={commentaire}
          onChangeText={onChangeCommentaire}
          placeholder="Pourquoi tu recommandes ça ?"
          placeholderTextColor={theme.colors.muted}
          style={styles.commentInput}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{commentaire.length}</Text>
      </View>

      <PrimaryButton label="Suivant" onPress={onNext} disabled={!isFilled} />
    </View>
  );
}

type StepCategoryProps = {
  categorie: string | null;
  onSelectCategorie: (value: string) => void;
  onPublish: () => void;
  publishing: boolean;
};

function StepCategory({
  categorie,
  onSelectCategorie,
  onPublish,
  publishing,
}: StepCategoryProps) {
  return (
    <View style={styles.stepGap}>
      <Text style={styles.categoryTitle}>Quelle catégorie ?</Text>

      <View style={styles.categoryGrid}>
        {CATEGORIES.map((item) => {
          const selected = categorie === item.label;
          return (
            <Pressable
              key={item.label}
              onPress={() => onSelectCategorie(item.label)}
              style={[styles.categoryTag, selected && styles.categoryTagSelected]}>
              <Text
                style={[styles.categoryTagText, selected && styles.categoryTagTextSelected]}>
                {item.emoji} {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton
        label="Publier"
        onPress={onPublish}
        disabled={!categorie}
        loading={publishing}
      />
    </View>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

function PrimaryButton({ label, onPress, disabled, loading }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.primaryButton, isDisabled && styles.primaryButtonDisabled]}>
      {loading ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <Text
          style={[styles.primaryButtonText, isDisabled && styles.primaryButtonTextDisabled]}>
          {label}
        </Text>
      )}
    </Pressable>
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
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  stepGap: {
    gap: theme.spacing.md,
  },
  urlInput: {
    height: 56,
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
    fontSize: theme.fontSizes.sm,
  },
  manualForm: {
    gap: theme.spacing.md,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  uploadButtonText: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.sm,
  },
  pickedImage: {
    width: '100%',
    height: 160,
    borderRadius: theme.borderRadius.md,
  },
  previewCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  previewCardImage: {
    width: '100%',
    height: 160,
  },
  previewCardImagePlaceholder: {
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCardTitle: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.md,
    padding: theme.spacing.md,
  },
  commentInput: {
    minHeight: 96,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
  },
  charCount: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.xs,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  categoryTitle: {
    color: theme.colors.text,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.lg,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryTag: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryTagSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  categoryTagText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_500Medium`,
    fontSize: theme.fontSizes.sm,
  },
  categoryTagTextSelected: {
    color: theme.colors.text,
  },
  primaryButton: {
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.muted,
  },
  primaryButtonText: {
    color: theme.colors.text,
    fontFamily: `${theme.fontBody}_600SemiBold`,
    fontSize: theme.fontSizes.md,
  },
  primaryButtonTextDisabled: {
    color: theme.colors.background,
  },
  pressed: {
    opacity: 0.85,
  },
  confirmationSafeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  confirmationTitle: {
    color: theme.colors.accent,
    fontFamily: `${theme.fontTitle}_700Bold`,
    fontSize: theme.fontSizes.xl,
  },
  confirmationSubtitle: {
    color: theme.colors.muted,
    fontFamily: `${theme.fontBody}_400Regular`,
    fontSize: theme.fontSizes.md,
  },
});
