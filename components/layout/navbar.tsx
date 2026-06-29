"use client";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { PenLine, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

function LogoutConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Sign out?</h2>
        <p className="text-sm text-gray-500 mb-5">You'll need to sign in again to access your account.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}

export function Navbar() {
  const { data: session, isPending } = useSession();
  const user = session?.user as ({ role?: string; name: string; email: string } & Record<string, unknown>) | undefined;
  const [showConfirm, setShowConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Render the auth skeleton until mounted so the server prerender and the first
  // client paint are identical — the session can resolve before hydration commits,
  // which otherwise produces a server(skeleton)→client(link) hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const settingsHref =
    user?.role === "writer" ? "/writer/profile" :
    user?.role === "admin" ? "/admin" :
    "/dashboard/settings";

  const dashboardHref =
    user?.role === "writer" ? "/writer" :
    user?.role === "admin" ? "/admin" :
    "/dashboard";

  function handleSignOut() {
    setShowConfirm(false);
    signOut().then(() => (window.location.href = "/"));
  }

  return (
    <>
      {showConfirm && <LogoutConfirm onConfirm={handleSignOut} onCancel={() => setShowConfirm(false)} />}

      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <Image src="/td_text_logo.png" alt="TrueDrafts" width={120} height={36} className="object-contain" priority />
          </Link>

          {/* Nav links */}
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/applications" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Browse Applications
            </Link>
            {/* Writing Studio temporarily disabled — see app/(studio)/layout.tsx feature gate. */}
            <Link href="/#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              How It Works
            </Link>
            <Link href="/#contact" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Contact Us
            </Link>
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-2">
            {!mounted || isPending ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
            ) : user ? (
              <>
                <Link href={dashboardHref}>
                  <Button variant="ghost" size="sm" className="hidden sm:flex">
                    <LayoutDashboard className="mr-1 h-4 w-4" />
                    {user.role === "writer" ? "Dashboard" : user.role === "admin" ? "Admin" : "My Library"}
                  </Button>
                </Link>

                {/* Account name dropdown */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <span className="h-6 w-6 rounded-full bg-[#e8f1fa] flex items-center justify-center text-[#0851A0] text-xs font-bold shrink-0">
                      {user.name[0].toUpperCase()}
                    </span>
                    <span className="max-w-[100px] truncate hidden sm:block">{user.name}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-50">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      <Link
                        href={settingsHref}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Settings
                      </Link>
                      <button
                        onClick={() => { setMenuOpen(false); setShowConfirm(true); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link href="/signup/writer">
                  <Button size="sm">
                    <PenLine className="mr-1 h-4 w-4" />
                    Start Earning
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
