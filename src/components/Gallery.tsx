"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ImageRecord {
  id: string;
  slug: string;
  originalName: string;
  fileName: string;
  blobUrl: string;
  uploadedAt: string;
}

export default function Gallery() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /* ── fetch images ──────────────────────────────────────── */
  const fetchImages = async () => {
    try {
      const res = await fetch("/api/images");
      const data = await res.json();
      setImages(data);
    } catch (err) {
      console.error("Failed to load images:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
    const interval = setInterval(fetchImages, 2000);
    return () => clearInterval(interval);
  }, []);

  /* ── upload handling ───────────────────────────────────── */
  const handleFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) return;

    setIsUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        await fetchImages();
        router.refresh();
      } else {
        const data = await res.json();
        setUploadError(data.error || "Upload failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleBgClick = (e: React.MouseEvent) => {
    // Only trigger if clicking background, not an image link or button
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) return;
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const handleDelete = async (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this image?")) return;
    try {
      await fetch(`/api/images/${slug}`, { method: "DELETE" });
      setImages((prev) => prev.filter((img) => img.slug !== slug));
    } catch {
      // silently fail
    }
  };

  /* ── render ────────────────────────────────────────────── */
  return (
    <main
      className="min-h-screen px-16 py-12 cursor-pointer"
      onClick={handleBgClick}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-amber-500/10 border-2 border-dashed border-amber-400 pointer-events-none flex items-center justify-center">
          <p className="text-amber-300 text-lg font-medium">Drop image here</p>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-900/90 border border-red-500/30 text-red-300 text-sm max-w-md text-center">
          {uploadError}
          <button onClick={() => setUploadError("")} className="ml-3 text-red-400 hover:text-red-200">&times;</button>
        </div>
      )}

      {/* Upload spinner */}
      {isUploading && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/90 border border-white/10">
          <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-amber-400 text-xs">Uploading…</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : images.length === 0 ? (
        <div className="h-[80vh]" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {images.map((image) => (
            <Link
              key={image.id}
              href={`/${image.slug}`}
              className="group relative aspect-[4/3] overflow-hidden"
            >
              <img
                src={image.blobUrl}
                alt={image.originalName}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Delete button on hover */}
              <button
                onClick={(e) => handleDelete(image.slug, e)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-gray-400 hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                title="Delete"
              >
                &times;
              </button>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
