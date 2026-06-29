"use client";
import Image from "next/image";
import { useState } from "react";

// Slugs that have a real PNG in public/uni_logos/. The `universities` table
// grows independently of this asset folder, so for any slug NOT in this set we
// render initials directly and never request the file — that avoids both the
// broken image AND the 404 network request (next/image fires the request before
// onError, so a fallback alone can't silence the console). Keep this in sync
// when adding logo files.
const LOGO_SLUGS = new Set([
  "boston-college", "brown", "caltech", "cmu", "columbia", "cornell", "dartmouth", "duke",
  "emory", "georgetown", "georgia-tech", "harvard", "jhu", "mit", "northwestern",
  "notre-dame", "nyu", "princeton", "purdue", "rice", "stanford", "tufts",
  "uc-berkeley", "uchicago", "uci", "ucla", "ucsb", "ucsd", "uiuc", "umich",
  "unc", "upenn", "usc", "uva", "vanderbilt", "washu", "wellesley", "yale",
]);

/**
 * University logo with a graceful fallback to the school's initials. Shows
 * initials (no network request) for any slug without an asset, and also falls
 * back if a present file ever fails to load.
 */
export function UniLogo({
  slug,
  name,
  size = 30,
  className,
}: {
  slug: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !slug || !LOGO_SLUGS.has(slug)) {
    const initials = name
      .replace(/^(the|university of|university)\s+/i, "")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return (
      <span
        aria-label={name}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          fontSize: size * 0.4,
          fontWeight: 600,
          color: "#475569",
          background: "#f1f5f9",
          borderRadius: 6,
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
    );
  }

  return (
    <Image
      src={`/uni_logos/${slug}.png`}
      alt={name}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
