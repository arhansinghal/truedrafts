import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { EssayCard } from "@/components/essays/EssayCard";
import { Bookmark, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const saved = await db.query.bookmarks.findMany({
    where: eq(bookmarks.userId, session.user.id),
    with: {
      essay: {
        with: {
          university: true,
          writer: { columns: { id: true, name: true, username: true, verifiedAdmit: true } },
        },
      },
    },
    orderBy: [desc(bookmarks.createdAt)],
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bookmarks</h1>
        <p className="text-gray-500 text-sm mt-1">{saved.length} saved essay{saved.length !== 1 ? "s" : ""}</p>
      </div>

      {saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Bookmark className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700 mb-2">No bookmarks yet</h3>
          <p className="text-sm text-gray-400 mb-5">Save applications you want to revisit.</p>
          <Link href="/applications">
            <Button className="gap-2">Browse Applications <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {saved.map(({ essay }) => (
            <EssayCard key={essay.id} essay={essay} />
          ))}
        </div>
      )}
    </div>
  );
}
