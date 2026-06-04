// ── Writing Studio feature flag ──────────────────────────────────────────────
// The Studio (pages, API, weekly refetch cron) is temporarily disabled. All the
// code is preserved; set NEXT_PUBLIC_STUDIO_ENABLED=true in the environment to
// bring the whole feature back at once.
//
// While disabled:
//   - the navbar "Writing Studio" link is hidden
//   - every /studio page returns 404 (app/(studio)/layout.tsx)
//   - every /api/studio/* route returns 404 (proxy.ts)
//   - the studio-refetch cron no-ops (app/api/cron/studio-refetch)
export const STUDIO_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ENABLED === "true";
