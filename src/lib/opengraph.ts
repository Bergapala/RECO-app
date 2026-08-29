/**
 * Récupération best-effort des métadonnées OpenGraph (titre + image) d'une
 * URL, sans dépendance à un parseur HTML (non disponible en React Native) :
 * on va chercher les balises `<meta property="og:...">` directement dans le
 * HTML brut avec des expressions régulières. Volontairement simple — ça
 * couvre la grande majorité des sites, mais peut rater des pages qui
 * injectent leurs meta tags en JS (SPA) ou qui bloquent les requêtes sans
 * navigateur.
 *
 * Sur web, ce fetch se heurtera à CORS pour la plupart des sites tiers —
 * fonctionne surtout sur natif (iOS/Android), où `fetch` n'est pas soumis à
 * cette restriction.
 */

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export type OgMetadata = {
  title: string | null;
  image: string | null;
};

export async function fetchOpenGraphMetadata(url: string): Promise<OgMetadata | null> {
  if (!isValidHttpUrl(url)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url.trim(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const title = extractMetaContent(html, 'og:title') ?? extractTitleTag(html);
    const image = extractMetaContent(html, 'og:image');

    if (!title) {
      return null;
    }

    return { title, image };
  } catch {
    return null;
  }
}

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }

  return null;
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
