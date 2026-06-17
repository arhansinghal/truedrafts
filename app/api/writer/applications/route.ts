import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, universities, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateSlug } from "@/lib/utils";
import { generateEssayTags } from "@/lib/ai";
import { sendApplicationSubmittedEmail } from "@/lib/email";
import {
  bodyExceedsLimit,
  tooLong,
  MAX_IMAGE_CHARS,
  MAX_TEXT_CHARS,
} from "@/lib/request-limits";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apps = await db.query.collegeApplications.findMany({
    where: eq(collegeApplications.writerId, session.user.id),
    with: { university: true },
    orderBy: [desc(collegeApplications.createdAt)],
  });

  return Response.json(apps);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (bodyExceedsLimit(req)) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  const body = await req.json();
  const {
    universityId,
    admittedYear,
    priceCents,
    admissionProofUrl,
    submittedCommonApp,
    commonAppPrompt,
    commonAppContent,
    commonAppScreenshotUrl,
    supplementals,
    numSupplementals,
    major,
    activities,
    honors,
  } = body;

  if (!universityId || !admissionProofUrl) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Server-side size caps (the wizard caps client-side; a raw POST does not).
  if (
    tooLong(admissionProofUrl, MAX_IMAGE_CHARS) ||
    tooLong(commonAppScreenshotUrl, MAX_IMAGE_CHARS) ||
    tooLong(commonAppContent, MAX_TEXT_CHARS) ||
    tooLong(JSON.stringify(supplementals ?? []), MAX_TEXT_CHARS)
  ) {
    return Response.json({ error: "A field exceeds the maximum allowed size" }, { status: 413 });
  }

  // Every supplemental essay must have both a prompt and content.
  const supplementalsList = (supplementals ?? []) as { prompt?: string; content?: string }[];
  if (supplementalsList.some((s) => !s.prompt?.trim() || !s.content?.trim())) {
    return Response.json(
      { error: "Each supplemental essay needs both a prompt and the essay text." },
      { status: 400 },
    );
  }

  const university = await db.query.universities.findFirst({
    where: eq(universities.id, universityId),
  });

  if (!university) {
    return Response.json({ error: "University not found" }, { status: 404 });
  }

  const title = `${university.name} Application (${admittedYear ?? new Date().getFullYear()})`;
  const slug = generateSlug(`${title}-${session.user.id.slice(0, 8)}`);

  // Generate tags from combined content
  const allContent = [commonAppContent, ...(supplementals ?? []).map((s: { content: string }) => s.content)]
    .filter(Boolean)
    .join(" ");
  const tags = allContent
    ? await generateEssayTags(allContent, university.name, "common_app").catch(() => [])
    : [];

  const [application] = await db
    .insert(collegeApplications)
    .values({
      writerId: session.user.id,
      universityId,
      title,
      slug,
      admittedYear: admittedYear ?? null,
      priceCents: 0, // Admin sets price after review
      admissionProofUrl,
      submittedCommonApp: submittedCommonApp ?? false,
      commonAppPrompt: commonAppPrompt ?? null,
      commonAppContent: commonAppContent ?? null,
      commonAppScreenshotUrl: commonAppScreenshotUrl ?? null,
      supplementals: JSON.stringify(supplementals ?? []),
      numSupplementals: numSupplementals ?? 0,
      // Writer-provided intended major (application-level). The approve pipeline
      // only AI-infers a major when this is empty (see approve/retag guards).
      major: typeof major === "string" && major.trim() ? major.trim() : null,
      tags,
      status: "pending",
    })
    .returning();

  // Stamp the bundle-inclusion consent timestamp on the writer's user row, and
  // persist their edited activities/honors (the writer's canonical profile data
  // — overwrite is intentional; the wizard always seeds the list from the
  // current profile so it can't clobber existing entries). Skip the profile
  // overwrite when both lists are empty (e.g. the writer skipped step 4).
  const userUpdates: Record<string, unknown> = { writersAgreedBundlesAt: new Date() };
  if (Array.isArray(activities) && activities.length > 0) userUpdates.activities = JSON.stringify(activities);
  if (Array.isArray(honors) && honors.length > 0) userUpdates.honors = JSON.stringify(honors);
  await db.update(users).set(userUpdates).where(eq(users.id, session.user.id));

  // Confirmation that we received the submission (fire-and-forget).
  sendApplicationSubmittedEmail(session.user.id, application.id).catch(console.error);

  return Response.json(application, { status: 201 });
}
