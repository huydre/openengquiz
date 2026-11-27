import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

// Rounded, friendly typeface with full Vietnamese diacritics support.
const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "OpenEngQuiz: Học từ vựng tiếng Anh miễn phí", template: "%s · OpenEngQuiz" },
  description:
    "Flashcard, ôn tập ngắt quãng và luyện nói với AI bằng chính từ vựng bạn đang học. Miễn phí.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions often add attributes to <html>/<body> before React hydrates
    // (e.g. `__processed_*`, `bis_skin_checked`). This only ignores attribute mismatches
    // on these two tags; mismatches inside the app still surface.
    <html
      lang="vi"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
