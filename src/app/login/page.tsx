import { Suspense } from "react";
import Link from "next/link";
import { DotGrid } from "@/components/landing/decor";
import { LogoMark } from "@/components/landing/logo-mark";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    // Same dark theme as the landing page.
    <div className="dark text-foreground relative flex flex-1 flex-col overflow-hidden bg-[#101010]">
      <DotGrid />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_70%)]"
      />

      <header className="relative z-10 container mx-auto px-4 py-5 md:px-8 lg:px-12 xl:px-16">
        <Link href="/" aria-label="Về trang chủ OpenEngQuiz" className="inline-flex">
          <LogoMark />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        {/* LoginForm reads ?next and ?error from the URL, which is request-time data. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
