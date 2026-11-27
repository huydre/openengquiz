import Features from "@/components/landing/features";
import Footer from "@/components/landing/footer";
import Hero from "@/components/landing/hero";
import Navbar from "@/components/landing/navbar";
import Stats from "@/components/landing/stats";

// Dark landing built from Watermelon's landing-01 template. Only this page uses the `dark` theme;
// the login page and the app keep the light edtech style.
export default function LandingPage() {
  return (
    <div className="dark bg-[#101010] text-foreground flex flex-1 flex-col overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
      </main>
      <Footer />
    </div>
  );
}
