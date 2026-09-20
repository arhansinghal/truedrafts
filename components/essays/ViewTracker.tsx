"use client";

import { useEffect } from "react";

type Props =
  | { essayId: string; applicationId?: never }
  | { applicationId: string; essayId?: never };

/**
 * Fire-and-forget view beacon.
 *
 * Mounted on public listing pages. Runs once per mount; the server applies a
 * 30-minute per-IP throttle on top, so a reader flicking between tabs does not
 * inflate a writer's numbers.
 */
export function ViewTracker(props: Props) {
  const { essayId, applicationId } = props;

  useEffect(() => {
    const path = essayId
      ? `/api/essays/${essayId}/view`
      : `/api/applications/${applicationId}/view`;

    // `keepalive` so the beacon still lands if the reader navigates away
    // immediately after the page paints.
    fetch(path, { method: "POST", keepalive: true }).catch(() => {});
  }, [essayId, applicationId]);

  return null;
}
