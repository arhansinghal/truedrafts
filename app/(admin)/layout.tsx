import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { LayoutDashboard, FileText, Users, DollarSign, AlertTriangle, Banknote, Package, Shield } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/applications", label: "Applications", icon: FileText },
  { href: "/admin/bundles", label: "Bundles", icon: Package },
  { href: "/admin/essays", label: "Old Essays", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { href: "/admin/payouts", label: "Payouts", icon: Banknote },
  { href: "/admin/disputes", label: "Disputes", icon: AlertTriangle },
  { href: "/admin/audit", label: "Audit log", icon: Shield },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/admin");
  if (session.user.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <Navbar />
      <div className="flex">
        <aside className="sticky top-16 h-[calc(100vh-4rem)] w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col py-6 px-4">
          <div className="mb-4 px-2">
            <span className="text-xs rounded bg-red-100 text-red-600 px-1.5 py-0.5 font-medium">Admin Panel</span>
          </div>
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
        </aside>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
