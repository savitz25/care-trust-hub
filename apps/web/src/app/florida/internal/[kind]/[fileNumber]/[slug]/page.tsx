import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FloridaProfileQaDetail } from "@/components/florida-profile-qa";
import { findFloridaQaProfile, floridaInternalQaAllowed } from "@/server/care/florida-internal-qa";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ kind: string; fileNumber: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!floridaInternalQaAllowed()) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  const { kind, fileNumber, slug } = await params;
  const profile = findFloridaQaProfile(kind, fileNumber, slug);
  if (!profile) return { title: "Not found", robots: { index: false, follow: false } };
  return {
    title: `Internal QA · ${profile.official_name}`,
    robots: { index: false, follow: false },
  };
}

export default async function FloridaInternalQaDetailPage({ params }: Props) {
  if (!floridaInternalQaAllowed()) notFound();
  const { kind, fileNumber, slug } = await params;
  const profile = findFloridaQaProfile(kind, fileNumber, slug);
  if (!profile) notFound();
  return (
    <main className="page-shell">
      <FloridaProfileQaDetail profile={profile} />
    </main>
  );
}
