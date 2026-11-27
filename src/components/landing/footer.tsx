import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";
import { SectionLabel } from "./decor";

const LINK_COLUMNS = [
  {
    title: "Học",
    links: [
      { label: "Tính năng", href: "#tinh-nang" },
      { label: "Bắt đầu học", href: "/login" },
    ],
  },
  {
    title: "Tài khoản",
    links: [{ label: "Đăng nhập", href: "/login" }],
  },
  {
    title: "Pháp lý",
    links: [
      { label: "Chính sách bảo mật", href: "/privacy" },
      { label: "Điều khoản sử dụng", href: "/terms" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-background text-foreground relative overflow-hidden border-t border-white/5 font-mono">
      <div className="relative z-10 container mx-auto px-4 pt-20 pb-12 md:px-8 lg:px-12 xl:px-16">
        <div className="grid grid-cols-1 gap-12 border-b border-white/5 pb-16 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col items-start lg:col-span-6">
            <div className="mb-6">
              <SectionLabel>OpenEngQuiz</SectionLabel>
            </div>
            <h2 className="mb-6 font-sans text-3xl tracking-tight text-balance md:text-5xl">
              Bắt đầu với từ đầu tiên hôm nay
            </h2>
            <p className="mb-8 max-w-md text-sm leading-relaxed text-pretty text-white/50">
              Tạo bộ từ của riêng bạn hoặc chọn lộ trình có sẵn. Miễn phí, chỉ cần một tài khoản.
            </p>
            <Link
              href="/login"
              className="text-primary-foreground bg-primary hover:bg-primary/90 inline-flex items-center px-8 py-4 text-xs font-bold tracking-widest uppercase transition-colors active:scale-[0.96]"
            >
              Bắt đầu học <ArrowUpRight className="ml-2 size-4" />
            </Link>
          </div>

          <nav aria-label="Liên kết cuối trang" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-6 lg:pl-8">
            {LINK_COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-5">
                <SectionLabel>{col.title}</SectionLabel>
                {col.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-sm text-white/50 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-b border-white/5 py-6 md:flex-row">
          <div className="flex items-center gap-3">
            <span className="bg-primary size-2 animate-pulse rounded-full motion-reduce:animate-none" />
            <span className="text-primary text-xs tracking-widest uppercase">Học mỗi ngày một chút</span>
          </div>
          <div aria-hidden="true" className="hidden items-center gap-[2px] opacity-80 lg:flex">
            {Array.from({ length: 30 }, (_, i) => (
              <span key={i} className={cn("h-4 w-1.5", i < 12 ? "bg-primary" : "bg-white/10")} />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 md:flex-row">
          <LogoMark />
          <p className="text-xs tracking-widest text-white/30 uppercase">© OpenEngQuiz</p>
        </div>
      </div>
    </footer>
  );
}
