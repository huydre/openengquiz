"use client";

// Built from Watermelon UI navigation-6 (registry.watermelon.sh): a floating pill bar whose menu
// opens as a panel anchored under it. Content is OpenEngQuiz's; colours use the theme tokens.
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Menu, User, X } from "lucide-react";
import { Popover, PopoverAnchorPrimitive as PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";

const LEVEL_LINKS = ["Lấy gốc", "Band 6", "Band 7"];
const FEATURE_LINKS = [
  { label: "Gọi điện với gia sư AI", href: "/#tinh-nang" },
  { label: "Chấm phát âm", href: "/#tinh-nang" },
  { label: "Ôn tập ngắt quãng", href: "/#tinh-nang" },
  { label: "Tra từ", href: "/#tinh-nang" },
];
const RESOURCE_LINKS = [
  { label: "Câu hỏi thường gặp", href: "/#cau-hoi" },
  { label: "Chính sách bảo mật", href: "/privacy" },
  { label: "Điều khoản sử dụng", href: "/terms" },
];
const MENU_LINK = "text-muted-foreground hover:text-foreground text-sm font-bold transition-colors";

export function LandingNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  return (
    <div className="sticky top-0 z-50 w-full px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-center">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverAnchor asChild>
            <div className="bg-card/90 flex h-16 w-full items-center justify-between gap-2 rounded-full border-2 pr-3 pl-3 shadow-[0_4px_0_var(--border)] backdrop-blur-md md:pl-4">
              <div className="flex items-center gap-2">
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-foreground hover:bg-muted grid size-10 place-items-center rounded-xl transition-colors"
                    aria-label={isOpen ? "Đóng menu" : "Mở menu"}
                  >
                    {isOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
                  </button>
                </PopoverTrigger>
                <BrandLogo />
              </div>

              <div className="flex items-center gap-1.5">
                <ThemeToggle />
                <Link href="/login" aria-label="Đăng nhập" className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-xl">
                  <User className="size-5" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="bg-primary text-primary-foreground hidden h-10 items-center rounded-full px-6 text-sm font-extrabold uppercase shadow-[0_3px_0_var(--primary-edge)] active:translate-y-0.5 active:shadow-none sm:flex"
                >
                  Bắt đầu
                </Link>
              </div>
            </div>
          </PopoverAnchor>

          <PopoverContent
            align="center"
            sideOffset={14}
            className={cn(
              "bg-card max-h-[82dvh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto overscroll-contain rounded-3xl border-2 p-0 shadow-[0_6px_0_var(--border)] sm:w-2xl",
              "lg:w-[calc(100vw-3rem)] lg:max-w-5xl lg:rounded-[2.5rem]",
            )}
          >
            <div className="grid grid-cols-1 gap-0 px-7 py-6 lg:grid-cols-4 lg:px-10 lg:py-10">
              <div className="flex flex-col pb-8 lg:pr-8 lg:pb-0">
                <div className="bg-primary/15 text-primary mb-3 grid size-10 place-items-center rounded-xl">
                  <BookOpen className="size-5" aria-hidden="true" />
                </div>
                <h4 className="mb-1 text-sm font-extrabold">Khoá học IELTS</h4>
                <p className="text-muted-foreground mb-3 text-sm">7 cấp độ, mỗi bài xen kẽ học từ và luyện nói với AI.</p>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_LINKS.map((level) => (
                    <Link key={level} href="/#lo-trinh" onClick={close} className="hover:bg-muted rounded-full border-2 px-3 py-1 text-xs font-extrabold">
                      {level}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t-2 py-8 lg:border-t-0 lg:border-l-2 lg:py-0 lg:pl-8">
                <h4 className="text-muted-foreground mb-1 text-xs font-extrabold uppercase">Tính năng</h4>
                {FEATURE_LINKS.map((link) => <Link key={link.label} href={link.href} onClick={close} className={MENU_LINK}>{link.label}</Link>)}
              </div>

              <div className="flex flex-col gap-3 border-t-2 py-8 lg:border-t-0 lg:border-l-2 lg:py-0 lg:pl-8">
                <h4 className="text-muted-foreground mb-1 text-xs font-extrabold uppercase">Tài nguyên</h4>
                {RESOURCE_LINKS.map((link) => <Link key={link.label} href={link.href} onClick={close} className={MENU_LINK}>{link.label}</Link>)}
              </div>

              <div className="flex flex-col border-t-2 pt-8 lg:border-t-0 lg:border-l-2 lg:pt-0 lg:pl-8">
                <h4 className="text-muted-foreground mb-4 text-xs font-extrabold uppercase">Nổi bật</h4>
                <Link
                  href="/login"
                  onClick={close}
                  className="group bg-muted/60 ring-primary/50 relative flex h-full min-h-[160px] flex-col justify-between overflow-hidden rounded-2xl p-5 ring-2"
                >
                  <div>
                    <Badge variant="outline" className="border-primary text-primary bg-card mb-3">Mới</Badge>
                    <h4 className="mb-2 text-sm font-extrabold">Gọi điện với gia sư AI</h4>
                    <p className="text-muted-foreground text-sm">Nói rảnh tay về chủ đề bài học, dùng đúng những từ vừa học.</p>
                  </div>
                  <span className="text-primary-edge mt-4 flex items-center text-sm font-extrabold">
                    Thử ngay <ArrowUpRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </div>
            </div>

            <div className="px-6 pb-8 sm:hidden">
              <Link href="/login" onClick={close} className="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center rounded-2xl font-extrabold uppercase shadow-[0_4px_0_var(--primary-edge)]">
                Bắt đầu học
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
