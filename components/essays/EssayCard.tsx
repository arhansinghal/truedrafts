import Link from "next/link";
import Image from "next/image";
import { Star, Eye, ShoppingBag, CheckCircle, Clock } from "lucide-react";
import { essayTypeLabel } from "@/lib/utils";
import { formatReadingTime } from "@/lib/reading-time";
import type { Essay, University, User } from "@/lib/db/schema";

type EssayWithRelations = Essay & {
  university: University;
  writer: Pick<User, "id" | "name" | "username" | "verifiedAdmit">;
};

export function EssayCard({ essay }: { essay: EssayWithRelations }) {
  const stars = (essay.avgRating ?? 0) / 10;
  const writerInitial = essay.writer.name?.[0]?.toUpperCase() ?? "?";

  return (
    <Link href={`/essays/${essay.slug}`}>
      <article className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5">
        {/* Top row: logo + uni name + badge */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {essay.university.logoUrl ? (
              <Image
                src={essay.university.logoUrl}
                alt={essay.university.name}
                width={32}
                height={32}
                className="rounded-lg object-contain shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                {essay.university.name[0]}
              </div>
            )}
            <span className="text-xs font-medium text-gray-500 truncate">{essay.university.name}</span>
          </div>
          <span className="shrink-0 bg-blue-50 text-[#0851A0] border-0 text-[11px] font-medium px-2 py-0.5 rounded-full">
            {essayTypeLabel(essay.essayType)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base text-gray-900 line-clamp-2 mb-2 leading-snug group-hover:text-[#0851A0] transition-colors">
          {essay.title}
        </h3>

        {/* Preview snippet */}
        <p className="essay-protected text-xs text-gray-400 line-clamp-2 mb-4 flex-1 leading-relaxed">
          {essay.previewContent?.slice(0, 120)}...
        </p>

        {/* Writer row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-full bg-[#e8f1fa] flex items-center justify-center text-[10px] font-bold text-[#0851A0] shrink-0">
            {writerInitial}
          </div>
          <span className="text-xs text-gray-500 truncate">{essay.writer.name}</span>
          {essay.writer.verifiedAdmit && (
            <CheckCircle className="h-3.5 w-3.5 text-[#0851A0] shrink-0" aria-label="Verified Admit" />
          )}
          {essay.admittedYear && (
            <span className="text-xs text-gray-400 shrink-0">· {essay.admittedYear}</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {essay.views}
            </span>
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" />
              {essay.purchases}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatReadingTime(essay.wordCount)}
            </span>
            {(essay.ratingCount ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                {stars.toFixed(1)} ({essay.ratingCount})
              </span>
            )}
          </div>
          <span className="text-sm font-bold text-[#0851A0]">
            ${(essay.priceCents / 100).toFixed(2)} →
          </span>
        </div>
      </article>
    </Link>
  );
}
