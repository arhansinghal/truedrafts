import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Highlighter } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, highlights, universities } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { previewQuote, type HighlightColor } from "@/lib/highlights/anchor";

export const metadata: Metadata = { title: "Your notes" };

export const dynamic = "force-dynamic";

const SWATCH: Record<HighlightColor, string> = {
  yellow: "#F7CD46",
  blue: "#0851A0",
  green: "#1C7A57",
  pink: "#B23A2E",
};

export default async function NotesLibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/dashboard/notes");

  // Only the caller's own rows, joined to the application they belong to so the
  // list can link back into the reader.
  const rows = await db
    .select({
      id: highlights.id,
      quote: highlights.quote,
      note: highlights.note,
      color: highlights.color,
      createdAt: highlights.createdAt,
      applicationId: collegeApplications.id,
      applicationTitle: collegeApplications.title,
      applicationSlug: collegeApplications.slug,
      universityName: universities.name,
    })
    .from(highlights)
    .innerJoin(
      collegeApplications,
      eq(highlights.applicationId, collegeApplications.id),
    )
    .innerJoin(
      universities,
      eq(collegeApplications.universityId, universities.id),
    )
    .where(eq(highlights.userId, session.user.id))
    .orderBy(desc(highlights.createdAt));

  // Group by application, preserving the newest-first order of first appearance.
  const groups = new Map<
    string,
    { title: string; slug: string; university: string; items: typeof rows }
  >();
  for (const row of rows) {
    const existing = groups.get(row.applicationId);
    if (existing) {
      existing.items.push(row);
    } else {
      groups.set(row.applicationId, {
        title: row.applicationTitle,
        slug: row.applicationSlug,
        university: row.universityName,
        items: [row],
      });
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Your notes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length === 0
              ? "Everything you highlight will collect here."
              : `${rows.length} highlight${rows.length === 1 ? "" : "s"} across ${groups.size} application${groups.size === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[#0851A0] hover:underline"
        >
          Back to library
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <Highlighter className="mx-auto h-6 w-6 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            Nothing highlighted yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Open an application you&apos;ve unlocked and select any passage.
            What you mark shows up here, ready to export.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([applicationId, group]) => (
            <section key={applicationId}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <Link
                  href={`/applications/${group.slug}`}
                  className="text-sm font-semibold text-gray-900 hover:text-[#0851A0]"
                >
                  {group.title}
                </Link>
                <span className="text-xs text-gray-400">
                  {group.university} · {group.items.length} highlight
                  {group.items.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <p
                      className="text-sm italic text-gray-600"
                      style={{
                        borderLeft: `3px solid ${SWATCH[item.color]}`,
                        paddingLeft: 10,
                        margin: 0,
                      }}
                    >
                      {previewQuote(item.quote, 260)}
                    </p>
                    {item.note && (
                      <p className="mt-2 text-sm text-gray-900">{item.note}</p>
                    )}
                    <p className="mt-2 text-[11px] text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
