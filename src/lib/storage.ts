import { supabase } from '@/lib/supabase';

const RECO_IMAGES_BUCKET = 'reco-images';

/**
 * Upload une image locale (uri renvoyée par expo-image-picker) vers le
 * bucket Supabase Storage `reco-images`, dans un dossier propre à
 * `userId`, et renvoie son URL publique.
 *
 * Nécessite que le bucket et ses policies existent côté Supabase — voir
 * supabase/migrations (bucket reco-images).
 */
export async function uploadRecoImage(userId: string, localUri: string): Promise<string | null> {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();

    const extensionMatch = localUri.split('?')[0]?.match(/\.(\w+)$/);
    const extension = extensionMatch?.[1] ?? 'jpg';
    const path = `${userId}/${Date.now()}.${extension}`;

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
