import { notFound } from "next/navigation";
import { getImageBySlug } from "@/lib/db";
import StainedGlassWrapper from "../StainedGlassWrapper";

interface PageProps {
  params: { slug: string };
}

export default async function ViewPage({ params }: PageProps) {
  const image = await getImageBySlug(params.slug);

  if (!image) {
    notFound();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-2">
      <StainedGlassWrapper imageUrl={image.blobUrl} slug={params.slug} viewMode />
    </main>
  );
}

export function generateStaticParams() {
  return [];
}

export const dynamic = "force-dynamic";
