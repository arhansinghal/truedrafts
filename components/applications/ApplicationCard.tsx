import Link from "next/link";
import { ShoppingBag, Eye, FileText, User as UserIcon, Package } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { UniLogo } from "@/components/ui/uni-logo";
import type { Bundle, CollegeApplication, University, User } from "@/lib/db/schema";

// Only the columns the card actually renders. Deliberately narrow: list queries
// must NOT pull heavyweight per-row columns (the 1024-dim insightBriefEmbedding
// vector, full essay text, supplementals JSON) — doing so made Browse take ~8s.
// The AI summary (insightBrief) is intentionally NOT shown on browse cards —
// only on the application detail page. See lib/db column-selection notes.
export type AppWithRelations = Pick<
  CollegeApplication,
  | "id"
  | "slug"
  | "title"
  | "major"
  | "tags"
  | "admittedYear"
  | "priceCents"
  | "views"
  | "purchases"
  | "submittedCommonApp"
  | "numSupplementals"
> & {
  university: University;
  writer: Pick<User, "id" | "name" | "username" | "verifiedAdmit">;
};

export function ApplicationCard({
  application: app,
  bundles,
}: {
  application: AppWithRelations;
  bundles?: Bundle[];
}) {
  const supplementalCount = app.numSupplementals ?? 0;
  const essayCount = (app.submittedCommonApp ? 1 : 0) + supplementalCount;

  return (
    <Link href={`/applications/${app.slug}`}>
      <article className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5">
        {/* Top row: logo + uni name */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 bg-white">
              <UniLogo
                slug={app.university.slug}
                name={app.university.name}
                size={28}
                className="object-contain"
              />
            </div>
            <span className="text-xs font-medium text-gray-500 truncate">{app.university.name}</span>
          </div>
          <span className="shrink-0 bg-blue-50 text-[#0851A0] text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {essayCount} essay{essayCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base text-gray-900 line-clamp-2 mb-2 leading-snug group-hover:text-[#0851A0] transition-colors">
          {app.title}
        </h3>
        {app.major && (
          <p className="text-[11px] text-gray-500 mb-2 line-clamp-1">{app.major}</p>
        )}

        {/* Bundle membership pill — first matching bundle wins */}
        {bundles && bundles.length > 0 && (
          <div className="mb-2">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-[#0851A0] text-[10px] font-semibold px-2 py-0.5 border border-blue-100"
              onClickCapture={(e) => e.preventDefault()}
            >
              <Package className="h-2.5 w-2.5" />
              Part of: {bundles[0].title}
              {bundles.length > 1 && ` +${bundles.length - 1}`}
            </span>
          </div>
        )}

        {/* Tags (the AI summary lives only on the detail page, not here) */}
        {(app.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {(app.tags ?? []).slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{t}</span>
            ))}
          </div>
        )}

        {/* Writer row — anonymous */}
        <div className="flex items-center gap-2 mb-3 mt-auto">
          <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <UserIcon className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <span className="text-xs text-gray-400 italic">Anonymous</span>
          {app.admittedYear && (
            <span className="text-xs text-gray-400 shrink-0">· {app.admittedYear}</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {app.views}
            </span>
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" /> {app.purchases}
            </span>
          </div>
          <span className="text-sm font-bold text-[#0851A0]">
            {formatCents(app.priceCents)} →
          </span>
        </div>
      </article>
    </Link>
  );
}
