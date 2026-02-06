import fs from "fs";
import path from "path";

export interface ImageRecord {
  id: string;
  slug: string;
  originalName: string;
  fileName: string;
  width: number;
  height: number;
  uploadedAt: string;
}

const DB_PATH = path.join(process.cwd(), "data", "images.json");

export function getImages(): ImageRecord[] {
  try {
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function getImageBySlug(slug: string): ImageRecord | undefined {
  const images = getImages();
  return images.find((img) => img.slug === slug);
}

export function addImage(image: ImageRecord): void {
  const images = getImages();
  images.push(image);
  fs.writeFileSync(DB_PATH, JSON.stringify(images, null, 2));
}

export function updateImageSlug(oldSlug: string, newSlug: string): boolean {
  const images = getImages();
  const img = images.find((i) => i.slug === oldSlug);
  if (!img) return false;
  // Check for conflicts
  if (images.some((i) => i.slug === newSlug && i.id !== img.id)) return false;
  img.slug = newSlug;
  fs.writeFileSync(DB_PATH, JSON.stringify(images, null, 2));
  return true;
}

export function deleteImage(slug: string): boolean {
  const images = getImages();
  const idx = images.findIndex((img) => img.slug === slug);
  if (idx === -1) return false;
  const [removed] = images.splice(idx, 1);
  fs.writeFileSync(DB_PATH, JSON.stringify(images, null, 2));
  // Also delete the file
  const filePath = path.join(process.cwd(), "public", "uploads", removed.fileName);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // file may already be gone
  }
  return true;
}
