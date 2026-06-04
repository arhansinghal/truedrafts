import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { WriterSidebarNav } from "@/components/writer/WriterSidebarNav";

export default async function WriterLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/writer");
  if (session.user.role !== "writer") redirect("/dashboard");

  const firstInitial = (session.user.name ?? "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      {/* Marketing header stays visible across the writer dashboard */}
      <Navbar />

      <div className="flex">
        {/* Sidebar — sits below the sticky header */}
        <aside
          className="sticky top-16 flex h-[calc(100vh-4rem)] w-60 shrink-0 flex-col px-4 py-[22px]"
          style={{ background: "var(--surface)", borderRight: "1px solid var(--line)" }}
        >
          <div className="eyebrow px-2 pb-[10px]">Writer studio</div>

          <WriterSidebarNav />

          <Link
            href="/writer/essays/new"
            className="mt-3 flex items-center justify-center gap-2 rounded-[10px] px-[18px] py-[11px] text-sm font-semibold text-white transition-colors"
            style={{ background: "var(--td-blue)" }}
          >
            <Plus className="h-4 w-4" /> Publish application
          </Link>

          <div className="my-3 mb-3 mt-4 h-px" style={{ background: "var(--line)" }} />
          <Link href="/writer/profile" className="flex items-center gap-[10px] px-2 py-[6px]">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: "var(--blue-wash)", color: "var(--td-blue)" }}
            >
              {firstInitial}
            </span>
            <span className="min-w-0">
              <span
                className="block truncate text-[13px] font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {session.user.name}
              </span>
              <span className="block text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
                Writer
              </span>
            </span>
          </Link>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1" style={{ background: "var(--paper)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
