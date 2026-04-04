"use client";
import { useState } from "react";
import Link from "next/link";
import { signUp, signIn } from "@/lib/auth-client";
import { BookOpen, PenLine, Eye, EyeOff, Mail, Lock, User, ChevronRight, Check } from "lucide-react";
import { generateReferralCode } from "@/lib/utils";

type Role = "reader" | "writer";

function GoogleLogo() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function SignupPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    if (!role) return;
    await signIn.social({
      provider: "google",
      callbackURL: role === "writer" ? "/signup/writer" : "/dashboard",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setError("");
    setLoading(true);
    try {
      const result = await signUp.email({
        name,
        email,
        password,
        role,
        referralCode: generateReferralCode(),
      } as Parameters<typeof signUp.email>[0]);

      if (result.error) {
        setError(result.error.message ?? "Signup failed");
      } else {
        window.location.href = role === "writer" ? "/signup/writer" : "/dashboard";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[440px]">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-100 overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 bg-[#0851A0]" />

        <div className="px-8 py-9">
          {!role ? (
            /* ── Step 1: Role selection ── */
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create your account</h1>
                <p className="text-sm text-gray-500 mt-1">How do you want to use TrueDrafts?</p>
              </div>

              <div className="space-y-3">
                {/* Reader card */}
                <button
                  onClick={() => setRole("reader")}
                  className="w-full group relative flex items-start gap-4 rounded-2xl border-2 border-gray-100 bg-gray-50/50 p-5 text-left hover:border-[#0851A0] hover:bg-[#e8f1fa]/50 transition-all"
                >
                  <div className="flex-shrink-0 w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-[#0851A0] transition-colors">
                    <BookOpen className="h-5 w-5 text-[#0851A0] group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Read &amp; discover essays</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Browse real essays from admitted students at top-ranked universities</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#0851A0] transition-colors mt-3.5 flex-shrink-0" />
                </button>

                {/* Writer card */}
                <button
                  onClick={() => setRole("writer")}
                  className="w-full group relative flex items-start gap-4 rounded-2xl border-2 border-gray-100 bg-gray-50/50 p-5 text-left hover:border-[#0851A0] hover:bg-[#e8f1fa]/50 transition-all"
                >
                  <div className="flex-shrink-0 w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-[#0851A0] transition-colors">
                    <PenLine className="h-5 w-5 text-[#0851A0] group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Share my essays &amp; earn</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Upload your accepted applications and keep 50% of every sale</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#0851A0] transition-colors mt-3.5 flex-shrink-0" />
                </button>
              </div>

              <p className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="text-[#0851A0] font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            /* ── Step 2: Account details ── */
            <>
              {/* Role badge + back */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[#e8f1fa] border border-blue-100 rounded-full px-3 py-1">
                    {role === "reader" ? (
                      <BookOpen className="h-3 w-3 text-[#0851A0]" />
                    ) : (
                      <PenLine className="h-3 w-3 text-[#0851A0]" />
                    )}
                    <span className="text-xs font-semibold text-[#0851A0]">
                      {role === "reader" ? "Reader" : "Writer"}
                    </span>
                    <Check className="h-3 w-3 text-[#0851A0]" />
                  </div>
                </div>
                <button
                  onClick={() => { setRole(null); setError(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ← Change
                </button>
              </div>

              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create account</h1>
                <p className="text-sm text-gray-500 mt-1">Fill in your details to get started</p>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-2xl py-3 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <GoogleLogo />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Johnson"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0]/20 focus:border-[#0851A0] transition-all bg-gray-50/50"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0]/20 focus:border-[#0851A0] transition-all bg-gray-50/50"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
                      className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0]/20 focus:border-[#0851A0] transition-all bg-gray-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Password strength hint */}
                  {password.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= i * 3
                              ? password.length >= 12
                                ? "bg-green-400"
                                : password.length >= 9
                                ? "bg-yellow-400"
                                : "bg-red-400"
                              : "bg-gray-100"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
                    <span className="text-red-500 text-base leading-none mt-px">⚠</span>
                    <p className="text-xs text-red-600 leading-relaxed">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0851A0] hover:bg-[#063d85] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm tracking-wide shadow-sm mt-1"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating account…
                    </span>
                  ) : (
                    "Create account"
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-gray-400 leading-relaxed">
                By signing up you agree to our{" "}
                <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>
                {" "}and{" "}
                <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
              </p>

              <p className="mt-3 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="text-[#0851A0] font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
