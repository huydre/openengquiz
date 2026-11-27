import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";
import { ThemeProvider } from "@/components/theme/theme-provider";

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

const description = "Flashcard, ôn tập ngắt quãng và luyện nói với AI bằng chính từ vựng bạn đang học. Miễn phí.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "OpenEngQuiz: Học từ vựng tiếng Anh miễn phí", template: "%s · OpenEngQuiz" },
  description,
  applicationName: "OpenEngQuiz",
  openGraph: { type: "website", siteName: "OpenEngQuiz", locale: "vi_VN", title: "OpenEngQuiz: Học từ vựng tiếng Anh miễn phí", description },
  twitter: { card: "summary_large_image" },
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
