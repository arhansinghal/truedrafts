import type { Metadata } from "next";
import Link from "next/link";
import { SavedSearchList } from "@/components/reader/SavedSearchList";

export const metadata: Metadata = { title: "Saved searches" };

export const dynamic = "force-dynamic";

export default function SavedSearchesPage() {
  // The reader layout already gates on session and role; the list fetches its
  // own data so cadence changes and deletes don't need a full navigation.
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Saved searches
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            We&apos;ll email you when a new application matches one of these.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[#0851A0] hover:underline"
        >
          Back to library
        </Link>
      </div>

      <SavedSearchList />
    </div>
  );
}
