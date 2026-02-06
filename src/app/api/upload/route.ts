import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { addImage, ImageRecord } from "@/lib/db";

function generateSlug(name: string): string {
  const base = name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.",
        },
        { status: 400 }
      );
    }

    const slug = generateSlug(file.name);
    const ext = file.name.match(/\.[^/.]+$/)?.[0] ?? "";
    const blobPath = `images/${slug}${ext}`;

    // Upload to Vercel Blob
    const blob = await put(blobPath, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    const imageRecord: ImageRecord = {
      id: slug,
      slug,
      originalName: file.name,
      fileName: `${slug}${ext}`,
      blobUrl: blob.url,
      uploadedAt: new Date().toISOString(),
    };

    await addImage(imageRecord);

    return NextResponse.json({
      success: true,
      image: imageRecord,
      url: blob.url,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Upload error:", msg);
    return NextResponse.json(
      { error: `Upload failed: ${msg}` },
      { status: 500 }
    );
  }
}
