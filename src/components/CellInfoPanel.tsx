"use client";

import { useState, useRef, useEffect } from "react";

export interface CellAnnotation {
  title: string;
  description: string;
  date: string;
  imageDataUrl?: string;
}

interface CellInfoPanelProps {
  cellId: number;
  annotation: CellAnnotation | null;
  onSave: (cellId: number, data: CellAnnotation) => void;
  onDelete: (cellId: number) => void;
  onClose: () => void;
}

/**
 * Always renders as a form — used for both creating and editing.
 * Displayed as a fixed right-side panel matching the hover display style.
 */
export default function CellInfoPanel({
  cellId,
  annotation,
  onSave,
  onDelete,
  onClose,
}: CellInfoPanelProps) {
  const [title, setTitle] = useState(annotation?.title ?? "");
  const [description, setDescription] = useState(annotation?.description ?? "");
  const [date, setDate] = useState(annotation?.date ?? new Date().toISOString().split("T")[0]);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(
    annotation?.imageDataUrl
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset form when switching cells
  useEffect(() => {
    setTitle(annotation?.title ?? "");
    setDescription(annotation?.description ?? "");
    setDate(annotation?.date ?? new Date().toISOString().split("T")[0]);
    setImageDataUrl(annotation?.imageDataUrl);
  }, [annotation, cellId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on click outside the panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageDataUrl(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(cellId, {
      title: title.trim(),
      description: description.trim(),
      date: date || new Date().toISOString().split("T")[0],
      imageDataUrl,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(cellId);
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className="fixed top-0 right-0 h-full w-[340px] z-50 flex flex-col animate-fadeIn"
      style={{
        background:
          "linear-gradient(160deg, rgba(18,18,22,0.95) 0%, rgba(10,10,14,0.98) 100%)",
        backdropFilter: "blur(32px)",
        borderLeft: "1px solid rgba(255,255,255,0.04)",
        boxShadow:
          "-20px 0 60px rgba(0,0,0,0.5), -4px 0 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Top accent line */}
      <div
        className="h-[2px] w-full flex-shrink-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(200,160,60,0.5) 50%, transparent 100%)",
        }}
      />

      {/* Form content */}
      <div className="flex-1 overflow-y-auto px-10 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-6 h-px bg-amber-500/40" />
          <p className="text-[11px] text-amber-400/60 tracking-[0.15em] uppercase font-medium">
            {annotation ? "Edit piece" : "Add piece"} &mdash; #{cellId + 1}
          </p>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-[11px] text-gray-500/80 tracking-wide uppercase mb-2">
              Title <span className="text-red-400/60">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this piece…"
              autoFocus
              className="w-full px-0 py-2 text-[16px] font-light bg-transparent border-0 border-b border-white/10 text-white/90 placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-[11px] text-gray-500/80 tracking-wide uppercase mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-0 py-2 text-[14px] font-light bg-transparent border-0 border-b border-white/10 text-white/90 focus:outline-none focus:border-amber-500/40 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] text-gray-500/80 tracking-wide uppercase mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short note about this piece…"
              rows={4}
              className="w-full px-0 py-2 text-[14px] font-light bg-transparent border-0 border-b border-white/10 text-gray-400/80 placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition resize-none leading-[1.8]"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-[11px] text-gray-500/80 tracking-wide uppercase mb-2">
              Image (optional)
            </label>
            {imageDataUrl ? (
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={imageDataUrl}
                  alt="preview"
                  className="w-full object-contain"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-gray-300 hover:text-white text-sm transition"
                >
                  &times;
                </button>
              </div>
            ) : (
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-[12px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-medium file:bg-white/5 file:text-gray-400 hover:file:bg-white/10 transition"
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-10">
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 px-4 py-2.5 text-[13px] font-medium rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {annotation ? "Save" : "Add to glass"}
          </button>
          {annotation && (
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 text-[13px] font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-[13px] font-medium rounded-lg bg-white/5 text-gray-500 hover:bg-white/10 transition"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className="h-[1px] w-full flex-shrink-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}
