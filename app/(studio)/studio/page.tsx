import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps, universities } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { CreateAppForm } from "@/components/studio/CreateAppForm";
import { ArrowUpRight } from "lucide-react";

export const metadata = { title: "Writing Studio" };

export default async function StudioDashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/studio");

  const [apps, allUnis] = await Promise.all([
    db.query.studioApps.findMany({
      where: eq(studioApps.userId, session.user.id),
      with: {
        university: true,
        essays: { columns: { id: true, wordCount: true } },
      },
      orderBy: [desc(studioApps.updatedAt)],
    }),
    db.query.universities.findMany({ orderBy: [asc(universities.displayOrder), asc(universities.name)] }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400 mb-3">
          Writing Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Your workspaces
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-lg leading-relaxed">
          One workspace per school. Drop in research, draft essays, and let
          grounded AI completions ride alongside as you write.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Workspaces
            </p>
            <p className="text-[11px] text-gray-400">{apps.length} total</p>
          </div>
          {apps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-8 py-14 text-center">
              <p className="text-sm text-gray-500">No workspaces yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Pick a school on the right to start your first.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {apps.map((app) => {
                const essayCount = app.essays.length;
                const totalWords = app.essays.reduce((sum, e) => sum + (e.wordCount ?? 0), 0);
                return (
                  <li key={app.id}>
                    <Link
                      href={`/studio/${app.id}`}
                      className="group flex items-center gap-4 py-4 hover:bg-gray-50/50 -mx-3 px-3 rounded-lg transition-colors"
                    >
                      <div className="w-9 h-9 rounded-md border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 bg-white">
                        <Image
                          src={`/uni_logos/${app.university.slug}.png`}
                          alt={app.university.name}
                          width={28}
                          height={28}
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{app.title}</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {app.university.name} · {essayCount} essay{essayCount !== 1 ? "s" : ""} · {totalWords} words
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-gray-700 transition-colors" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-4">
            New workspace
          </p>
          <CreateAppForm
            universities={allUnis.map((u) => ({ id: u.id, name: u.name, slug: u.slug }))}
          />
        </div>
      </div>
    </div>
  );
}
