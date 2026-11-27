import { Languages, MessageCircleQuestion } from "lucide-react";
import { Footer5 } from "@/components/ui/footer-5";

/** Landing footer built on the Watermelon footer-5 block. */
export default function Footer() {
  return (
    <Footer5
      logo={<Languages aria-hidden="true" className="size-6" />}
      brandName="OpenEngQuiz"
      topNavLabel="Học mỗi ngày một chút"
      contactCta={{
        icon: <MessageCircleQuestion aria-hidden="true" className="size-5" />,
        title: "Góp ý hoặc báo lỗi",
        description: "Gặp lỗi hay có ý tưởng hay? Gửi cho nhóm phát triển qua GitHub.",
        href: "https://github.com/huydre/openengquiz/issues",
      }}
      linkGroups={[
        { title: "Học", links: [{ label: "Tính năng", href: "/#tinh-nang" }, { label: "Lộ trình", href: "/#lo-trinh" }, { label: "Bắt đầu học", href: "/login" }] },
        { title: "Tài khoản", links: [{ label: "Đăng nhập", href: "/login" }, { label: "Tạo tài khoản", href: "/login" }] },
        { title: "Pháp lý", links: [{ label: "Chính sách bảo mật", href: "/privacy" }, { label: "Điều khoản sử dụng", href: "/terms" }] },
      ]}
      brandWatermark="EngQuiz"
      copyright="© OpenEngQuiz. Miễn phí cho người học tiếng Anh."
      legalLinks={[{ label: "Bảo mật", href: "/privacy" }, { label: "Điều khoản", href: "/terms" }]}
    />
  );
}
