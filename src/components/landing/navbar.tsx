"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";

const CTA =
  "bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 items-center px-6 font-mono text-xs font-bold tracking-widest uppercase transition-colors active:scale-[0.96]";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "bg-background/80 border-border/50 py-3 shadow-sm backdrop-blur-md"
          : "border-transparent bg-transparent py-5",
      )}
    >
      <div className="container mx-auto flex items-center justify-between px-4 md:px-8 lg:px-12 xl:px-16">
        <Link href="/" aria-label="OpenEngQuiz trang chủ">
          <LogoMark />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <a
            href="#tinh-nang"
            className="font-mono text-xs tracking-widest text-white/50 uppercase transition-colors hover:text-white"
          >
            Tính năng
          </a>
          <Link
            href="/login"
            className="font-mono text-xs tracking-widest text-white/50 uppercase transition-colors hover:text-white"
          >
            Đăng nhập
          </Link>
          <Link href="/login" className={CTA}>
            Bắt đầu học
          </Link>
        </nav>

        <button
          type="button"
          className="text-foreground p-1 md:hidden"
          aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="bg-background border-border/50 absolute top-full right-0 left-0 flex flex-col gap-3 border-b p-4 shadow-lg md:hidden">
          <a
            href="#tinh-nang"
            onClick={() => setMobileOpen(false)}
            className="py-2 text-center font-mono text-xs tracking-widest text-white/60 uppercase"
          >
            Tính năng
          </a>
          <Link
            href="/login"
            className="py-2 text-center font-mono text-xs tracking-widest text-white/60 uppercase"
          >
            Đăng nhập
          </Link>
          <Link href="/login" className={cn(CTA, "justify-center py-4")}>
            Bắt đầu học
          </Link>
        </div>
      )}
    </header>
  );
}
