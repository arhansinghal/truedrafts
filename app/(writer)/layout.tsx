import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/layout/navbar";
import { PenLine, Users, DollarSign, Settings, LayoutDashboard, BookOpen } from "lucide-react";

const NAV = [
  { href: "/writer", label: "Overview", icon: LayoutDashboard },
  { href: "/writer/essays", label: "My Applications", icon: PenLine },
  { href: "/writer/library", label: "My Library", icon: BookOpen },
  { href: "/writer/buyers", label: "Buyers", icon: Users },
  { href: "/writer/revenue", label: "Revenue", icon: DollarSign },
  { href: "/writer/settings", label: "Settings", icon: Settings },
];

export default async function WriterLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/writer");
  if (session.user.role !== "writer") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <Navbar />
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-16 h-[calc(100vh-4rem)] w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col py-6 px-4">
          <nav className="flex-1 space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto px-0">
            <Link href="/writer/essays/new">
              <div className="flex items-center gap-2 rounded-lg bg-[#0851A0] px-3 py-2 text-sm font-medium text-white hover:bg-[#063d85] transition-colors">
                <PenLine className="h-4 w-4" />
                Upload Application
              </div>
            </Link>
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
