// Sandbox PDF-import lab. Dev-only (404s in production), no auth — lives
// outside every route group so it inherits only the root layout. The single
// DB touch is a read-only universities SELECT to mirror the real wizard's
// dropdown; nothing here writes to the database.

import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { universities } from "@/lib/db/schema";
import { PdfImportClient } from "./PdfImportClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "PDF Import Lab" };
export const dynamic = "force-dynamic";

export default async function PdfImportLabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const allUniversities = await db.query.universities.findMany({
    orderBy: [asc(universities.displayOrder)],
    columns: { id: true, name: true, aliases: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 pb-20 pt-10">
      <p className="font-mono text-xs uppercase tracking-widest text-amber-600">
        Sandbox · dev only
      </p>
      <h1 className="mt-1 font-serif text-3xl font-medium">PDF Import Lab</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Upload your Common App submission PDFs. The system extracts the essays,
        prompts, activities and details, builds a submission preview, and lets
        you submit — entirely in a sandbox. Nothing touches the real app.
      </p>
      <PdfImportClient universities={allUniversities} />
    </div>
  );
}
