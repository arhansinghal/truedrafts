import type { Metadata } from "next";
import { Inter, Playfair_Display, Architects_Daughter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });
const architectsDaughter = Architects_Daughter({ subsets: ["latin"], weight: "400", variable: "--font-hand" });

export const metadata: Metadata = {
  title: {
    default: "TrueDrafts — Real College Essays from Real Admits",
    template: "%s | TrueDrafts",
  },
  description:
    "Browse and purchase successful college application essays from students who got into Harvard, MIT, Stanford, and other top universities.",
  keywords: ["college essays", "college application", "Harvard essays", "Stanford essays", "MIT essays"],
  icons: {
    icon: "/td-logo.png",
    apple: "/td-logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "TrueDrafts",
    title: "TrueDrafts — Real College Essays from Real Admits",
    description: "Browse successful college essays from admitted students.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${architectsDaughter.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
