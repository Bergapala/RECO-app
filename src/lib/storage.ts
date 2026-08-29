import { supabase } from '@/lib/supabase';

const RECO_IMAGES_BUCKET = 'reco-images';

/**
 * Upload une image locale (uri renvoyée par expo-image-picker) vers le
 * bucket Supabase Storage `reco-images`, dans un dossier propre à
 * `userId` (`<userId>/<fileName>`, requis par la policy RLS du bucket —
 * voir supabase/migrations), et renvoie son URL publique.
 */
async function uploadToRecoImages(
  userId: string,
  localUri: string,
  fileNamePrefix: string,
): Promise<string | null> {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();

    const extensionMatch = localUri.split('?')[0]?.match(/\.(\w+)$/);
    const extension = extensionMatch?.[1] ?? 'jpg';
    const path = `${userId}/${fileNamePrefix}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from(RECO_IMAGES_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/jpeg' });

    if (error) {
      return null;
    }

    const { data } = supabase.storage.from(RECO_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** Image d'aperçu d'une reco (voir src/app/add-reco.tsx). */
export async function uploadRecoImage(userId: string, localUri: string): Promise<string | null> {
  return uploadToRecoImages(userId, localUri, 'reco');
}

/** Photo de profil (voir src/app/settings.tsx). */
export async function uploadProfilePhoto(userId: string, localUri: string): Promise<string | null> {
  return uploadToRecoImages(userId, localUri, 'avatar');
}
