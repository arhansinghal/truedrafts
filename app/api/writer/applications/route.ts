import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, universities } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateSlug } from "@/lib/utils";
import { generateEssayTags } from "@/lib/ai";

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
  } = body;

  if (!universityId || !admissionProofUrl) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
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
      tags,
      status: "pending",
    })
    .returning();

  return Response.json(application, { status: 201 });
}
