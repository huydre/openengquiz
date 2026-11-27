import Footer from "@/components/landing/footer";
import { LandingFaq, LandingNewsletter, LandingTestimonials } from "@/components/landing/landing-extras";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNavigation } from "@/components/landing/landing-navigation";
import { LandingProgressFeature } from "@/components/landing/landing-progress-feature";
import { LandingCoursePath, LandingFeatures, LandingFinalCta, LandingSteps } from "@/components/landing/landing-sections";

// Public landing in the app's own style; follows the visitor's light or dark theme.
export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <LandingNavigation />
      <main>
        <LandingHero />
        <LandingSteps />
        <LandingFeatures />
        <LandingProgressFeature />
        <LandingCoursePath />
        <LandingTestimonials />
        <LandingNewsletter />
        <LandingFaq />
        <LandingFinalCta />
      </main>
      <Footer />
    </div>
  );
}
