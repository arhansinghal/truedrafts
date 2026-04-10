import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Eye, FileText, User as UserIcon, Sparkles } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { CollegeApplication, University, User } from "@/lib/db/schema";

interface InsightBrief {
  essay_focus:       string;
  applicant_profile: string;
  why_it_worked:     string;
  tone_signature:    string;
  standout_quote:    string;
}

type AppWithRelations = CollegeApplication & {
  university: University;
  writer: Pick<User, "id" | "name" | "username" | "verifiedAdmit">;
};

export function ApplicationCard({ application: app }: { application: AppWithRelations }) {
  let supplementalCount = 0;
  try { supplementalCount = JSON.parse(app.supplementals ?? "[]").length; } catch { supplementalCount = 0; }
  const essayCount = (app.submittedCommonApp ? 1 : 0) + supplementalCount;

  let brief: InsightBrief | null = null;
  try { brief = app.insightBrief ? JSON.parse(app.insightBrief) : null; } catch { brief = null; }

  return (
    <Link href={`/applications/${app.slug}`}>
      <article className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5">
        {/* Top row: logo + uni name */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 bg-white">
              <Image
                src={`/uni_logos/${app.university.slug}.png`}
                alt={app.university.name}
                width={28}
                height={28}
                className="object-contain"
                unoptimized
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

        {/* Insight Brief — AI-generated, shown when available */}
        {brief ? (
          <div className="mb-3 rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles className="h-3 w-3 text-[#0851A0]" />
              <span className="text-[10px] font-semibold text-[#0851A0] uppercase tracking-wide">AI Insight</span>
            </div>
            <p className="text-xs text-gray-700 leading-snug line-clamp-2">
              <span className="font-medium">Focus:</span> {brief.essay_focus}
            </p>
            <p className="text-xs text-gray-500 leading-snug line-clamp-1">
              <span className="font-medium">Profile:</span> {brief.applicant_profile}
            </p>
            <p className="text-[10px] text-gray-400 italic leading-snug line-clamp-1">
              &ldquo;{brief.standout_quote}&rdquo;
            </p>
          </div>
        ) : (app.tags ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-3">
            {(app.tags ?? []).slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{t}</span>
            ))}
          </div>
        ) : null}

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
