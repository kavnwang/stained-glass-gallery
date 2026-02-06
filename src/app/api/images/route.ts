import { NextResponse } from "next/server";
import { getImages } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const images = getImages();
  return NextResponse.json(images);
}
