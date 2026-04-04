import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col items-start gap-8 md:flex-row md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-[#0851A0]" />
              <span className="font-bold text-gray-900">TrueDrafts</span>
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              Real essays. Real admits. Real insight.
            </p>
          </div>
          <div className="flex gap-12 text-sm">
            <div className="flex flex-col gap-2">
              <span className="font-medium text-gray-700">Platform</span>
              <Link href="/applications" className="text-gray-500 hover:text-gray-900">Browse Applications</Link>
              <Link href="/#how-it-works" className="text-gray-500 hover:text-gray-900">How It Works</Link>
              <Link href="/signup/writer" className="text-gray-500 hover:text-gray-900">Sell Your Essays</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-medium text-gray-700">Legal</span>
              <Link href="/privacy" className="text-gray-500 hover:text-gray-900">Privacy Policy</Link>
              <Link href="/terms" className="text-gray-500 hover:text-gray-900">Terms of Service</Link>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-200 pt-6 text-xs text-gray-400">
          © {new Date().getFullYear()} TrueDrafts. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
