import { put, del, list } from "@vercel/blob";

export interface ImageRecord {
  id: string;
  slug: string;
  originalName: string;
  fileName: string;
  blobUrl: string;
  uploadedAt: string;
}

const METADATA_KEY = "metadata/images.json";

/**
 * Read the images list from the metadata blob.
 */
export async function getImages(): Promise<ImageRecord[]> {
  const { blobs } = await list({ prefix: METADATA_KEY, limit: 1 });
  if (blobs.length === 0) return [];
  const res = await fetch(blobs[0].url, { cache: "no-store" });
  if (!res.ok) return [];
  return await res.json();
}

/**
 * Persist the full images list back to the metadata blob.
 */
async function saveImages(images: ImageRecord[]): Promise<void> {
  await put(METADATA_KEY, JSON.stringify(images, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
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
  await saveImages(images);
  return true;
}
