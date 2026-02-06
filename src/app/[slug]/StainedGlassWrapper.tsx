"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StainedGlass from "@/components/StainedGlass";

interface StainedGlassWrapperProps {
  imageUrl: string;
  slug: string;
  viewMode?: boolean;
}

export default function StainedGlassWrapper({
  imageUrl,
  slug,
  viewMode = false,
}: StainedGlassWrapperProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [slugValue, setSlugValue] = useState(slug);
  const [error, setError] = useState("");
  const [panelVisible, setPanelVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setError("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus input when menu opens
  useEffect(() => {
    if (menuOpen) inputRef.current?.focus();
  }, [menuOpen]);

  const handleRename = useCallback(async () => {
    const newSlug = slugValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!newSlug || newSlug === slug) {
      setMenuOpen(false);
      setError("");
      return;
    }
    try {
      const res = await fetch(`/api/images/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Rename failed");
        return;
      }
      const data = await res.json();
      router.replace(`/${data.slug}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rename failed";
      setError(msg);
    }
  }, [slugValue, slug, router]);

  return (
    <div className="relative w-full">
      {/* Back button – centered vertically in the left margin */}
      <Link
        href={viewMode ? `/${slug}` : "/"}
        className="fixed left-16 top-1/2 -translate-y-1/2 z-40 text-white hover:text-amber-300 transition-colors"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
      </Link>

      {/* Rename button – centered vertically in the right margin, hidden in view mode or when panel is showing */}
      <div ref={menuRef} className={`fixed right-16 top-1/2 -translate-y-1/2 z-40 transition-opacity duration-200 ${viewMode || panelVisible ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <button
          onClick={() => {
            setMenuOpen((v) => !v);
            setError("");
          }}
          className="text-white hover:text-amber-300 transition-colors"
          title="Rename"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2 w-56 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-3 space-y-2">
              <input
                ref={inputRef}
                type="text"
                value={slugValue}
                onChange={(e) => {
                  setSlugValue(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setMenuOpen(false);
                    setSlugValue(slug);
                    setError("");
                  }
                }}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-amber-500/50 transition"
              />
              {error && (
                <p className="text-red-400 text-xs">{error}</p>
              )}
              <div className="flex gap-1.5">
                <button
                  onClick={handleRename}
                  className="flex-1 px-2 py-1 text-xs font-medium rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setSlugValue(slug);
                    setError("");
                  }}
                  className="px-2 py-1 text-xs font-medium rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <StainedGlass imageUrl={imageUrl} viewMode={viewMode} onHoverAnnotation={setPanelVisible} />
    </div>
  );
}
