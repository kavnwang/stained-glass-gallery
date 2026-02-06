"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { generateVoronoiCells, VoronoiCell } from "@/lib/delaunay";
import CellInfoPanel, { CellAnnotation } from "./CellInfoPanel";

const NUM_CELLS = 120;

interface StainedGlassProps {
  imageUrl: string;
  shuffleKey?: number;
  onHoverAnnotation?: (hovering: boolean) => void;
}

/* ── localStorage helpers ────────────────────────────────── */

function storageKey(imageUrl: string) {
  return `sg-annotations-${imageUrl}`;
}

function loadAnnotations(imageUrl: string): Record<number, CellAnnotation> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(imageUrl));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAnnotations(
  imageUrl: string,
  data: Record<number, CellAnnotation>
) {
  localStorage.setItem(storageKey(imageUrl), JSON.stringify(data));
}

/* ── component ───────────────────────────────────────────── */

export default function StainedGlass({ imageUrl, shuffleKey = 0, onHoverAnnotation }: StainedGlassProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cells, setCells] = useState<VoronoiCell[]>([]);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Record<number, CellAnnotation>>({});
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);

  // Load persisted annotations on mount
  useEffect(() => {
    setAnnotations(loadAnnotations(imageUrl));
  }, [imageUrl]);

  /* ── load image & generate cells ──────────────────────── */
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;

      const maxWidth = window.innerWidth - 20;
      const maxHeight = window.innerHeight - 40;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      scaleRef.current = scale;

      const displayWidth = Math.round(img.width * scale);
      const displayHeight = Math.round(img.height * scale);
      setDimensions({ width: displayWidth, height: displayHeight });

      const seed = `${imageUrl}__${shuffleKey}`;
      setCells(generateVoronoiCells(displayWidth, displayHeight, NUM_CELLS, seed));
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  /* ── draw ──────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || cells.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;
    canvas.width = width;
    canvas.height = height;

    // Draw source image to an offscreen canvas for colour sampling
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d")!;
    offCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height);
    const imageData = offCtx.getImageData(0, 0, width, height);

    ctx.clearRect(0, 0, width, height);

    // Draw the source image as the base layer
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height);

    /* ---- overlay each cell with a low-opacity colour tint ---- */
    for (const cell of cells) {
      const { vertices, seed, id } = cell;

      // Sample colour at the cell's seed point
      const sx = Math.round(Math.max(0, Math.min(width - 1, seed.x)));
      const sy = Math.round(Math.max(0, Math.min(height - 1, seed.y)));
      const idx = (sy * width + sx) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];

      // Boost saturation for a vivid stained-glass tint
      const [h, s, l] = rgbToHsl(r, g, b);
      const filled = !!annotations[id];
      const enhS = Math.min(1, filled ? s * 1.8 + 0.15 : s * 1.5 + 0.1);
      const enhL = filled
        ? Math.max(0.35, Math.min(0.85, l * 1.3))
        : Math.max(0.18, Math.min(0.78, l));
      const [er, eg, eb] = hslToRgb(h, enhS, enhL);

      // Build path helper
      const buildPath = () => {
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
          ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();
      };

      const opacity = filled ? 0.85 : 0.5;

      // Colour overlay – filled cells are vivid, unfilled are nearly transparent
      buildPath();
      ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${opacity})`;
      ctx.fill();
    }

    /* ---- coloured borders between cells -------------------- */
    ctx.lineJoin = "round";

    for (const cell of cells) {
      const { vertices, seed, id } = cell;
      const filled = !!annotations[id];

      // Sample the cell's colour for the border
      const sx = Math.round(Math.max(0, Math.min(width - 1, seed.x)));
      const sy = Math.round(Math.max(0, Math.min(height - 1, seed.y)));
      const idx = (sy * width + sx) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      const enhS = Math.min(1, s * 1.5 + 0.1);
      const enhL = Math.max(0.35, Math.min(0.85, l * 1.3));
      const [er, eg, eb] = hslToRgb(h, enhS, enhL);

      const buildPath = () => {
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
          ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();
      };

      if (filled) {
        // Full glow border for filled cells
        buildPath();
        ctx.shadowColor = `rgba(${er}, ${eg}, ${eb}, 0.7)`;
        ctx.shadowBlur = 4;
        ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, 0.5)`;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        buildPath();
        ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, 0.8)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Subtle thin border for unfilled cells
        buildPath();
        ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, 0.25)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }, [cells, annotations, dimensions]);

  useEffect(() => {
    draw();
  }, [draw]);

  /* ── hit-testing ──────────────────────────────────────── */
  const findCellAtPoint = useCallback(
    (x: number, y: number): number | null => {
      for (const cell of cells) {
        if (pointInPolygon(x, y, cell.vertices)) return cell.id;
      }
      return null;
    },
    [cells]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const id = findCellAtPoint(
        e.clientX - canvasRect.left,
        e.clientY - canvasRect.top
      );
      setHoveredCell(id);
      setMousePos({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      });
    },
    [findCellAtPoint]
  );

  const handleMouseLeave = useCallback(() => setHoveredCell(null), []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const id = findCellAtPoint(e.clientX - rect.left, e.clientY - rect.top);
      setSelectedCell(id);
    },
    [findCellAtPoint]
  );

  /* ── annotation CRUD ──────────────────────────────────── */
  const handleSave = useCallback(
    (cellId: number, data: CellAnnotation) => {
      setAnnotations((prev) => {
        const next = { ...prev, [cellId]: data };
        saveAnnotations(imageUrl, next);
        return next;
      });
    },
    [imageUrl]
  );

  const handleDelete = useCallback(
    (cellId: number) => {
      setAnnotations((prev) => {
        const next = { ...prev };
        delete next[cellId];
        saveAnnotations(imageUrl, next);
        return next;
      });
    },
    [imageUrl]
  );

  const handleClosePanel = useCallback(() => setSelectedCell(null), []);

  // Tooltip data for the hovered cell
  const hoveredAnnotation =
    hoveredCell !== null ? annotations[hoveredCell] ?? null : null;

  // Notify parent when hovering a filled cell
  useEffect(() => {
    onHoverAnnotation?.(hoveredAnnotation !== null);
  }, [hoveredAnnotation, onHoverAnnotation]);

  /* ── render ───────────────────────────────────────────── */
  if (!imageLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Creating stained glass...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-visible shadow-2xl"
        style={{
          boxShadow:
            "0 0 40px rgba(200,150,50,0.15), 0 0 80px rgba(200,150,50,0.05)",
        }}
      >
        {/* decorative frame */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            border: "3px solid rgba(120,100,60,0.6)",
            borderRadius: "8px",
            boxShadow:
              "inset 0 0 20px rgba(0,0,0,0.3), inset 0 0 60px rgba(0,0,0,0.1)",
          }}
        />
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="cursor-pointer block rounded-lg"
          style={{ width: dimensions.width, height: dimensions.height }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />

        {/* Fixed right-side panel for hovered filled cells */}
        {hoveredAnnotation && hoveredCell !== null && (
          <div
            className="fixed top-0 right-0 h-full w-[340px] z-30 pointer-events-none flex flex-col"
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

            {/* Content area */}
            <div className="flex-1 flex flex-col px-10 pt-12">
              {/* Title */}
              <p
                className="text-[22px] font-light text-white/90 leading-tight tracking-tight"
                style={{ fontVariantLigatures: "common-ligatures" }}
              >
                {hoveredAnnotation.title}
              </p>

              {/* Date with decorative dash */}
              <div className="flex items-center gap-3 mt-4">
                <div className="w-6 h-px bg-amber-500/40" />
                <p className="text-[11px] text-amber-400/60 tracking-[0.15em] uppercase font-medium">
                  {new Date(hoveredAnnotation.date).toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" }
                  )}
                </p>
              </div>

              {/* Description */}
              {hoveredAnnotation.description && (
                <p className="mt-6 text-[14px] text-gray-400/80 leading-[1.8] font-light">
                  {hoveredAnnotation.description}
                </p>
              )}

              {/* Image with soft edges */}
              {hoveredAnnotation.imageDataUrl && (
                <div className="mt-8 rounded-xl overflow-hidden flex-shrink-0">
                  <img
                    src={hoveredAnnotation.imageDataUrl}
                    alt={hoveredAnnotation.title}
                    className="w-full object-contain"
                  />
                </div>
              )}
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
        )}
      </div>

      {/* Edit / add form (click opens directly) */}
      {selectedCell !== null && (
        <CellInfoPanel
          cellId={selectedCell}
          annotation={annotations[selectedCell] ?? null}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}

/* ── geometry util ───────────────────────────────────────── */

function pointInPolygon(
  x: number,
  y: number,
  vertices: { x: number; y: number }[]
): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x,
      yi = vertices[i].y;
    const xj = vertices[j].x,
      yj = vertices[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/* ── colour helpers ──────────────────────────────────────── */

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}
