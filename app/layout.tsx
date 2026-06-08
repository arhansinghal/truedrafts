import type { Metadata } from "next";
import {
  Hanken_Grotesk,
  Newsreader,
  Spline_Sans_Mono,
  Architects_Daughter,
} from "next/font/google";
import "./globals.css";

// "Manuscript" type system (from the redesign):
//   sans  → Hanken Grotesk (UI)
//   serif → Newsreader, with italics (display + essay reading)
//   mono  → Spline Sans Mono (eyebrow / marginalia labels)
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});
const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});
// Retained for the few non-redesigned surfaces that still use the hand font.
const architectsDaughter = Architects_Daughter({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
});

export const metadata: Metadata = {
  title: {
    default: "TrueDrafts — Real College Essays from Real Admits",
    template: "%s | TrueDrafts",
  },
  description:
    "Browse and purchase successful college application essays from students who got into Harvard, MIT, Stanford, and other top universities.",
  keywords: ["college essays", "college application", "Harvard essays", "Stanford essays", "MIT essays"],
  // Favicon / tab + Google icons come from the file conventions:
  // app/favicon.ico (16/32/48), app/icon.png (512²), app/apple-icon.png (180²).
  metadataBase: new URL("https://truedrafts.com"),
  openGraph: {
    type: "website",
    siteName: "TrueDrafts",
    title: "TrueDrafts — Real College Essays from Real Admits",
    description: "Browse successful college essays from admitted students.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning silences the harmless attribute mismatch caused by
  // browser extensions (Grammarly, Solvely, etc.) that inject attributes onto
  // <html>/<body> before React hydrates. It only suppresses one level deep on
  // these elements — it does NOT hide real hydration bugs in page components.
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable} ${architectsDaughter.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
