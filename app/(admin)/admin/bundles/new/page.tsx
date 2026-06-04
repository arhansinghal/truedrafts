import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BundleAdminForm } from "@/components/admin/BundleAdminForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New bundle — Admin" };

export default async function NewBundlePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New bundle</h1>
        <p className="text-gray-500 text-sm mt-1">
          Create a discounted package of college applications.
        </p>
      </div>
      <BundleAdminForm initial={null} />
    </div>
  );
}
