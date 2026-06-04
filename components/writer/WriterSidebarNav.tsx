"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PenLine,
  Users,
  Wallet,
  User,
} from "lucide-react";

const NAV = [
  { href: "/writer", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/writer/essays", label: "My Applications", icon: PenLine },
  { href: "/writer/buyers", label: "Buyers", icon: Users },
  { href: "/writer/payout", label: "Payout", icon: Wallet },
  { href: "/writer/profile", label: "Profile", icon: User },
];

export function WriterSidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-[3px]">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-[11px] rounded-[9px] px-3 py-[9px] text-sm transition-colors"
            style={{
              fontWeight: active ? 600 : 500,
              background: active ? "var(--blue-wash)" : "transparent",
              color: active ? "var(--td-blue)" : "var(--ink-soft)",
            }}
          >
            <Icon className="h-[17px] w-[17px]" />
            {label}
            {active && (
              <span
                className="ml-auto h-[5px] w-[5px] rounded-full"
                style={{ background: "var(--td-blue)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
