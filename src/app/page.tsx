import Footer from "@/components/landing/footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingCoursePath, LandingFeatures, LandingFinalCta, LandingSteps } from "@/components/landing/landing-sections";

// Public landing in the app's own style; follows the visitor's light or dark theme.
export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col overflow-x-hidden">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingSteps />
        <LandingFeatures />
        <LandingCoursePath />
        <LandingFinalCta />
      </main>
      <Footer />
    </div>
  );
}
