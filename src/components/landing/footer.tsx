import Link from "next/link";
import { BrandLogo } from "./brand-logo";

const LINK_COLUMNS = [
  { title: "Học", links: [{ label: "Tính năng", href: "/#tinh-nang" }, { label: "Lộ trình", href: "/#lo-trinh" }, { label: "Bắt đầu học", href: "/login" }] },
  { title: "Tài khoản", links: [{ label: "Đăng nhập", href: "/login" }] },
  { title: "Pháp lý", links: [{ label: "Chính sách bảo mật", href: "/privacy" }, { label: "Điều khoản sử dụng", href: "/terms" }] },
];

export default function Footer() {
  return (
    <footer className="border-t-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_2fr] md:px-6">
        <div className="space-y-3">
          <BrandLogo />
          <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">Học từ vựng tiếng Anh và luyện nói với AI. Miễn phí cho người Việt.</p>
        </div>
        <nav aria-label="Liên kết cuối trang" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {LINK_COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-extrabold tracking-wide uppercase">{column.title}</h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}><Link href={link.href} className="text-muted-foreground hover:text-foreground text-sm font-semibold">{link.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <p className="text-muted-foreground border-t-2 py-5 text-center text-xs font-semibold">© OpenEngQuiz</p>
    </footer>
  );
}
