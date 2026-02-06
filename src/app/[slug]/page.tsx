import { notFound } from "next/navigation";
import { getImageBySlug } from "@/lib/db";
import StainedGlassWrapper from "./StainedGlassWrapper";

interface PageProps {
  params: { slug: string };
}

export default function ImagePage({ params }: PageProps) {
  const image = getImageBySlug(params.slug);

  if (!image) {
    notFound();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-2">
      <StainedGlassWrapper imageUrl={`/uploads/${image.fileName}`} slug={params.slug} />
    </main>
  );
}

export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";
