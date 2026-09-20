import Link from "next/link";
import type { MajorCount, TagCount } from "@/lib/university-insights/stats";

/**
 * What these essays are about: themes, and the majors applicants named.
 *
 * Horizontal bars with the share printed on each row — a magnitude comparison
 * where the labels are long, which is exactly what bars are for.
 */
export function ThemeList({
  tags,
  majors,
  universitySlug,
}: {
  tags: TagCount[];
  majors: MajorCount[];
  universitySlug: string;
}) {
  if (tags.length === 0 && majors.length === 0) return null;

  const widest = Math.max(1, ...tags.map((tag) => tag.count));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">
        What they wrote about
      </h3>

      {tags.length > 0 && (
        <ul className="mt-4 space-y-2">
          {tags.map((tag) => (
            <li key={tag.tag}>
              <Link
                href={`/applications?university=${universitySlug}&tags=${encodeURIComponent(tag.tag)}`}
                className="group block"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] capitalize text-gray-700 group-hover:text-[#0851A0]">
                    {tag.tag}
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-gray-400">
                    {tag.count} · {tag.sharePct}%
                  </span>
                </div>
                <div className="mt-1 h-[6px] w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (tag.count / widest) * 100)}%`,
                      background: "rgba(8, 81, 160, 0.6)",
                    }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {majors.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Majors named
          </h4>
          <p className="mt-0.5 text-[11px] text-gray-400">
            Share of the applications that named one.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {majors.map((major) => (
              <span
                key={major.major}
                className="rounded-full bg-gray-50 px-2.5 py-1 text-[11.5px] capitalize text-gray-600"
                title={`${major.count} application${major.count === 1 ? "" : "s"}`}
              >
                {major.major}
                <span className="ml-1.5 tabular-nums text-gray-400">
                  {major.sharePct}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
