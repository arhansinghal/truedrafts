import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/layout/navbar";

export default async function ReaderLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/dashboard");
  // The library is reader-only. Writers have a dashboard; admins have the admin
  // console. Send each non-reader to their own home so roles stay distinct.
  if (session.user.role === "writer") redirect("/writer");
  if (session.user.role === "admin") redirect("/admin");

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
