import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bundles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { BundleAdminForm } from "@/components/admin/BundleAdminForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit bundle — Admin" };

export default async function EditBundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  const bundle = await db.query.bundles.findFirst({ where: eq(bundles.id, id) });
  if (!bundle) notFound();

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{bundle.title}</h1>
        <p className="text-gray-500 text-sm mt-1">Edit bundle configuration.</p>
      </div>
      <BundleAdminForm initial={bundle} />
    </div>
  );
}
