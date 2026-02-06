import { NextRequest, NextResponse } from "next/server";
import { getImageBySlug, deleteImage, updateImageSlug } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const image = getImageBySlug(params.slug);
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  return NextResponse.json(image);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const body = await request.json();
  const newSlug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!newSlug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const updated = updateImageSlug(params.slug, newSlug);
  if (!updated) {
    return NextResponse.json(
      { error: "Image not found or slug already taken" },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true, slug: newSlug });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const deleted = deleteImage(params.slug);
  if (!deleted) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
