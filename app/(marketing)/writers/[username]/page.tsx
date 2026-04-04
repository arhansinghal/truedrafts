import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { essays, users, writerUniversities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { EssayCard } from "@/components/essays/EssayCard";
import { CheckCircle, BookOpen } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const writer = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!writer) return {};
  return {
    title: `${writer.name} — TrueDrafts`,
    description: writer.bio ?? `Browse college essays by ${writer.name} on TrueDrafts.`,
  };
}

export default async function WriterProfilePage({ params }: Props) {
  const { username } = await params;

  const writer = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!writer || writer.role !== "writer") notFound();

  const [writerEssays, writerUnis] = await Promise.all([
    db.query.essays.findMany({
      where: and(eq(essays.writerId, writer.id), eq(essays.status, "approved")),
      with: {
        university: true,
        writer: { columns: { id: true, name: true, username: true, verifiedAdmit: true } },
      },
      orderBy: (e, { desc }) => [desc(e.purchases)],
    }),
    db.query.writerUniversities.findMany({
      where: eq(writerUniversities.writerId, writer.id),
      with: { university: true },
    }),
  ]);

  const totalPurchases = writerEssays.reduce((sum, e) => sum + (e.purchases ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#f8faff]">
      {/* Profile header */}
      <div className="bg-white border-b border-gray-200 px-4 py-10">
        <div className="mx-auto max-w-4xl flex items-start gap-6">
          <div className="h-16 w-16 rounded-full bg-[#e8f1fa] flex items-center justify-center text-2xl font-bold text-[#0851A0] shrink-0">
            {writer.profilePhoto ? (
              <Image src={writer.profilePhoto} alt={writer.name} width={64} height={64} className="rounded-full object-cover" />
            ) : (
              writer.name[0]
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{writer.name}</h1>
              {writer.verifiedAdmit && (
                <CheckCircle className="h-5 w-5 text-[#0851A0]" aria-label="Verified Admit" />
              )}
            </div>
            {writer.bio && <p className="text-gray-600 text-sm mt-2 max-w-lg">{writer.bio}</p>}

            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {writerEssays.length} essay{writerEssays.length !== 1 ? "s" : ""}
              </span>
              <span>{totalPurchases} total purchases</span>
            </div>

            {/* Admitted schools */}
            {writerUnis.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {writerUnis.map(({ university, admittedYear }) => (
                  <span
                    key={university.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f1fa] px-3 py-1 text-xs font-medium text-[#0851A0]"
                  >
                    {university.logoUrl && (
                      <Image src={university.logoUrl} alt={university.name} width={14} height={14} className="object-contain" />
                    )}
                    {university.name}
                    {admittedYear && <span className="text-blue-400">'{String(admittedYear).slice(2)}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Essays */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Essays by {writer.name}</h2>
        {writerEssays.length === 0 ? (
          <p className="text-gray-400">No published essays yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {writerEssays.map((essay) => (
              <EssayCard key={essay.id} essay={essay} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
