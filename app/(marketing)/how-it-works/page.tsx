import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen, PenLine, Shield, DollarSign, CheckCircle, Star, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works",
  description: "Learn how TrueDrafts connects students with real college essays from admitted students.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-[#f8faff] to-white px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">How TrueDrafts Works</h1>
          <p className="mt-4 text-lg text-gray-500">
            A marketplace connecting college applicants with real essays from admitted students.
          </p>
        </div>
      </section>

      {/* For Readers */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-full bg-[#e8f1fa] flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-[#0851A0]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">For Students Applying</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Browse real essays",
                desc: "Search by university, essay type, or topic. Every essay comes from a student who was actually admitted.",
              },
              {
                step: "2",
                title: "Preview for free",
                desc: "Read the first 25% of every essay before you decide to unlock. No surprises.",
              },
              {
                step: "3",
                title: "Unlock & learn",
                desc: "Pay once to access the full essay. Use it for inspiration, structure, and tone — not to copy.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-gray-200 p-5">
                <div className="h-8 w-8 rounded-full bg-[#0851A0] text-white text-sm font-bold flex items-center justify-center mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/applications">
              <Button className="gap-2">
                Browse Applications <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* For Writers */}
      <section className="px-4 py-16 bg-[#f8faff]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <PenLine className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">For Admitted Students</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Create your profile",
                desc: "Sign up as a writer, list your admitted schools, and tell your story.",
              },
              {
                step: "2",
                title: "Upload your essays",
                desc: "Submit your essays with title, type, and price. Our team reviews them within 48 hours.",
              },
              {
                step: "3",
                title: "Earn 50% of every sale",
                desc: "When a student unlocks your application, you keep 50%. Withdraw anytime once you hit $10.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="h-8 w-8 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/signup">
              <Button variant="outline" className="gap-2">
                <PenLine className="h-4 w-4" />
                Start Earning
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Why TrueDrafts?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, title: "Verified admits only", desc: "Writers confirm their admission before publishing." },
              { icon: CheckCircle, title: "Quality reviewed", desc: "Every essay is reviewed by our team before going live." },
              { icon: Star, title: "Rated by buyers", desc: "Essays are rated by students who purchased them." },
              { icon: DollarSign, title: "Secure payments", desc: "Powered by Polar — payments go directly to writers." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-gray-100 p-4 text-left">
                <Icon className="h-5 w-5 text-[#0851A0] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
