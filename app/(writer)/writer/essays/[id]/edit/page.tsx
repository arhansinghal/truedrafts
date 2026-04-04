import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { essays, universities } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { EssayUploadForm } from "@/components/writer/EssayUploadForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Essay" };

export default async function EditEssayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  const [essay, allUniversities] = await Promise.all([
    db.query.essays.findFirst({
      where: and(eq(essays.id, id), eq(essays.writerId, session.user.id)),
    }),
    db.query.universities.findMany({ orderBy: [asc(universities.displayOrder)] }),
  ]);

  if (!essay) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Edit Essay</h1>
        <p className="text-gray-500 text-sm mt-1">
          Changes will be re-submitted for review if content is modified.
        </p>
      </div>
      <EssayUploadForm
        universities={allUniversities}
        mode="edit"
        initialValues={{
          id: essay.id,
          title: essay.title,
          universityId: essay.universityId,
          essayType: essay.essayType,
          fullContent: essay.fullContent,
          priceCents: essay.priceCents,
          admittedYear: essay.admittedYear,
        }}
      />
    </div>
  );
}
