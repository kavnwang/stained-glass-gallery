import { put, del, list } from "@vercel/blob";

export interface ImageRecord {
  id: string;
  slug: string;
  originalName: string;
  fileName: string;
  blobUrl: string;
  uploadedAt: string;
}

export interface CellAnnotation {
  title: string;
  description: string;
  date: string;
  imageDataUrl?: string;
}

export type AnnotationsMap = Record<number, CellAnnotation>;

const METADATA_KEY = "metadata/images.json";

function annotationsBlobKey(slug: string) {
  return `annotations/${slug}.json`;
}

/* ── URL caching ─────────────────────────────────────────
 * Vercel Blob `list()` is an "advanced operation" that counts
 * towards billing limits. Since we use `addRandomSuffix: false`,
 * blob URLs are deterministic — once discovered via `list()` or
 * returned from `put()`, we cache them so subsequent reads are
 * plain HTTP GETs (zero advanced operations).
 * ──────────────────────────────────────────────────────── */
let cachedMetadataUrl: string | null = null;
const cachedAnnotationUrls: Record<string, string> = {};

/**
 * Fetch a blob URL with cache-busting to avoid stale CDN responses.
 */
async function fetchBlobFresh(url: string): Promise<Response> {
  const u = new URL(url);
  u.searchParams.set("_t", Date.now().toString());
  return fetch(u.toString(), { cache: "no-store" });
}

/**
 * Discover the metadata blob URL (one `list()` call, then cached).
 */
async function resolveMetadataUrl(): Promise<string | null> {
  if (cachedMetadataUrl) return cachedMetadataUrl;
  const { blobs } = await list({ prefix: METADATA_KEY, limit: 1 });
  if (blobs.length === 0) return null;
  cachedMetadataUrl = blobs[0].url;
  return cachedMetadataUrl;
}

/**
 * Read the images list from the metadata blob.
 */
export async function getImages(): Promise<ImageRecord[]> {
  const url = await resolveMetadataUrl();
  if (!url) return [];
  const res = await fetchBlobFresh(url);
  if (!res.ok) return [];
  return await res.json();
}

/**
 * Persist the full images list back to the metadata blob.
 */
async function saveImages(images: ImageRecord[]): Promise<void> {
  const blob = await put(METADATA_KEY, JSON.stringify(images, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  // Cache the URL from the put response — zero future list() calls
  cachedMetadataUrl = blob.url;
}

export async function getImageBySlug(
  slug: string
): Promise<ImageRecord | undefined> {
  const images = await getImages();
  return images.find((img) => img.slug === slug);
}

export async function addImage(image: ImageRecord): Promise<void> {
  const images = await getImages();
  images.push(image);
  await saveImages(images);
}

export async function updateImageSlug(
  oldSlug: string,
  newSlug: string
): Promise<boolean> {
  const images = await getImages();
  const img = images.find((i) => i.slug === oldSlug);
  if (!img) return false;
  if (images.some((i) => i.slug === newSlug && i.id !== img.id)) return false;
  img.slug = newSlug;
  await saveImages(images);

  // Migrate annotations blob to new slug key
  try {
    const oldAnnotations = await getAnnotations(oldSlug);
    if (Object.keys(oldAnnotations).length > 0) {
      await saveAnnotations(newSlug, oldAnnotations);
      // Clean up cached URL for old slug
      delete cachedAnnotationUrls[oldSlug];
      await del(annotationsBlobKey(oldSlug)).catch(() => {});
    }
  } catch {
    // annotations migration is best-effort
  }

  return true;
}

export async function deleteImage(slug: string): Promise<boolean> {
  const images = await getImages();
  const idx = images.findIndex((img) => img.slug === slug);
  if (idx === -1) return false;
  const [removed] = images.splice(idx, 1);
  // Delete the image blob
  try {
    await del(removed.blobUrl);
  } catch {
    // blob may already be gone
  }
  // Delete annotations blob
  try {
    delete cachedAnnotationUrls[slug];
    await del(annotationsBlobKey(slug));
  } catch {
    // annotations blob may not exist
  }
  await saveImages(images);
  return true;
}

/* ── annotation persistence ─────────────────────────────── */

/**
 * Discover an annotation blob URL (one `list()` call, then cached).
 */
async function resolveAnnotationUrl(slug: string): Promise<string | null> {
  if (cachedAnnotationUrls[slug]) return cachedAnnotationUrls[slug];
  const key = annotationsBlobKey(slug);
  const { blobs } = await list({ prefix: key, limit: 1 });
  if (blobs.length === 0) return null;
  cachedAnnotationUrls[slug] = blobs[0].url;
  return cachedAnnotationUrls[slug];
}

export async function getAnnotations(slug: string): Promise<AnnotationsMap> {
  const url = await resolveAnnotationUrl(slug);
  if (!url) return {};
  const res = await fetchBlobFresh(url);
  if (!res.ok) return {};
  return await res.json();
}

export async function saveAnnotations(
  slug: string,
  data: AnnotationsMap
): Promise<void> {
  const blob = await put(annotationsBlobKey(slug), JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  // Cache the URL from the put response
  cachedAnnotationUrls[slug] = blob.url;
}
