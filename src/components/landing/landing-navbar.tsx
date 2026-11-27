import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { BrandLogo } from "./brand-logo";

const LINKS = [
  { label: "Tính năng", href: "#tinh-nang" },
  { label: "Lộ trình", href: "#lo-trinh" },
];

export function LandingNavbar() {
  return (
    <header className="bg-background/85 sticky top-0 z-50 border-b-2 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
        <BrandLogo />
        <nav aria-label="Trang chủ" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl px-3 py-2 text-sm font-extrabold">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="text-muted-foreground hover:text-foreground hidden px-3 text-sm font-extrabold sm:block">Đăng nhập</Link>
          <Link
            href="/login"
            className="bg-primary text-primary-foreground flex h-10 items-center rounded-2xl px-5 text-sm font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)] active:translate-y-1 active:shadow-none"
          >
            Bắt đầu
          </Link>
        </div>
      </div>
    </header>
  );
}
