import { NextRequest, NextResponse } from "next/server";
import { getImageBySlug, deleteImage, updateImageSlug } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const image = await getImageBySlug(params.slug);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json(image);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const newSlug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!newSlug) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }
    const updated = await updateImageSlug(params.slug, newSlug);
    if (!updated) {
      return NextResponse.json(
        { error: "Image not found or slug already taken" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, slug: newSlug });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Rename error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const deleted = await deleteImage(params.slug);
    if (!deleted) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
