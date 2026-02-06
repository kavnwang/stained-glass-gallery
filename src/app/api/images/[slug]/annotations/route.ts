import { NextRequest, NextResponse } from "next/server";
import { getAnnotations, saveAnnotations, getImageBySlug } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const image = await getImageBySlug(params.slug);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    const annotations = await getAnnotations(params.slug);
    return NextResponse.json(annotations);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const image = await getImageBySlug(params.slug);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    const data = await request.json();
    await saveAnnotations(params.slug, data);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
