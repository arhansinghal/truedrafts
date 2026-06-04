import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroTypewriter } from "@/components/home/HeroTypewriter";
import { BackgroundDoodles } from "@/components/home/BackgroundDoodles";
import { UniLogoGallery } from "@/components/home/UniLogoGallery";
import { BentoHowItWorks } from "@/components/home/BentoHowItWorks";
import { EssayTeaserSection } from "@/components/home/EssayTeaserSection";
import { SocialProofToast } from "@/components/home/SocialProofToast";

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative px-4 py-16 lg:py-24 overflow-hidden">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: "white" }}>
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: "600px", height: "600px",
              top: "-200px", left: "-100px",
              background: "radial-gradient(circle, rgba(219,234,254,0.7) 0%, transparent 70%)",
              animation: "blob-float-1 18s ease-in-out infinite",
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: "500px", height: "500px",
              top: "-100px", right: "-80px",
              background: "radial-gradient(circle, rgba(237,233,254,0.6) 0%, transparent 70%)",
              animation: "blob-float-2 22s ease-in-out infinite",
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: "400px", height: "400px",
              bottom: "-150px", left: "40%",
              background: "radial-gradient(circle, rgba(219,234,254,0.5) 0%, transparent 70%)",
              animation: "blob-float-3 16s ease-in-out infinite",
            }}
          />
        </div>

        {/* Background doodles */}
        <BackgroundDoodles />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1.4fr]">

            {/* Left column */}
            <div className="flex flex-col items-start">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0851A0]/20 bg-[#e8f1fa] px-3 py-1.5 text-xs font-medium text-[#0851A0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0851A0] animate-pulse" />
                500+ essays from verified admits
              </div>

              <h1 className="font-serif text-5xl font-bold leading-tight text-gray-900">
                Real essays.
                <br />
                <span className="font-serif italic text-[#0851A0]">Real admits.</span>
                <br />
                <span className="font-serif text-gray-900">Real insight.</span>
              </h1>

              <p className="mt-5 max-w-md text-base leading-relaxed text-gray-500">
                Browse successful college essays from students who actually got
                in — or share yours to earn.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/applications">
                  <Button
                    size="lg"
                    className="bg-[#0851A0] text-white hover:bg-[#063d85] rounded-xl px-6 py-3 font-semibold shadow-md shadow-blue-200 transition-all hover:shadow-lg hover:shadow-blue-300 hover:-translate-y-0.5"
                  >
                    Explore Applications →
                  </Button>
                </Link>
                <Link href="/signup/writer">
                  <Button
                    size="lg"
                    className="bg-white text-[#0851A0] border border-[#0851A0] hover:bg-blue-50 rounded-xl px-6 py-3 font-semibold transition-all hover:-translate-y-0.5"
                  >
                    Share Your Essays
                  </Button>
                </Link>
              </div>

              <p className="mt-8 text-sm text-gray-400">
                <span className="font-semibold text-gray-700">2,500+ Essays</span>
                {" · "}
                <span className="font-semibold text-gray-700">30+ Universities</span>
                {" · "}
                <span className="font-semibold text-gray-700">Writers Get Paid</span>
              </p>
            </div>

            {/* Right column — typewriter (large) */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative w-full max-w-2xl">
                <HeroTypewriter />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logo Gallery ─────────────────────────────────────────────────────── */}
      <UniLogoGallery />

      {/* ── Bento How It Works ───────────────────────────────────────────────── */}
      <div id="how-it-works">
        <BentoHowItWorks />
      </div>

      {/* ── Essay Teaser ─────────────────────────────────────────────────────── */}
      <EssayTeaserSection />

      {/* ── Writer CTA ───────────────────────────────────────────────────────── */}
      <section className="px-4 py-20" style={{ background: "#0851A0" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-3 font-serif text-3xl font-bold text-white">
            Got into your dream school? Earn from it.
          </h2>
          <p className="mb-8 text-base text-blue-200">
            Upload your essays, set your price, and earn every time a student unlocks them.
          </p>
          <Link href="/signup/writer">
            <Button
              size="lg"
              className="bg-white text-[#0851A0] hover:bg-gray-50 border-0 px-8 font-semibold shadow-lg hover:-translate-y-0.5 transition-transform"
              style={{ background: "#ffffff", color: "#0851A0" }}
            >
              Start Earning →
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────────── */}
      <section id="contact" className="px-4 py-20 bg-white border-t border-gray-100">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-3xl font-bold text-gray-900 mb-3">Get in touch</h2>
          <p className="text-gray-500 mb-10 text-base">Questions, feedback, or want to partner with us? We&apos;d love to hear from you.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            {/* Email */}
            <a
              href="mailto:team@truedrafts.com"
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#f8faff] px-6 py-4 hover:border-[#0851A0]/40 hover:bg-[#e8f1fa] transition-colors group"
            >
              <div className="h-10 w-10 rounded-xl bg-[#0851A0] flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 font-medium">Email</p>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0851A0] transition-colors">team@truedrafts.com</p>
              </div>
            </a>

            {/* Instagram */}
            <a
              href="https://www.instagram.com/truedrafts_/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#f8faff] px-6 py-4 hover:border-pink-300 hover:bg-pink-50 transition-colors group"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 font-medium">Instagram</p>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-pink-600 transition-colors">@truedrafts_</p>
              </div>
            </a>

            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/company/truedrafts/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#f8faff] px-6 py-4 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            >
              <div className="h-10 w-10 rounded-xl bg-[#0A66C2] flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 font-medium">LinkedIn</p>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0A66C2] transition-colors">TrueDrafts</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── Social proof toast (fixed) ───────────────────────────────────────── */}
      <SocialProofToast />
    </>
  );
}
