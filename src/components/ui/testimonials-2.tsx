// Watermelon UI testimonials-2 (registry.watermelon.sh). Adapted to take the quotes as props
// (the demo shipped invented quotes attributed to real people) and to render nothing without any.
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";

export interface Testimonial {
  text: string;
  name: string;
  /** Short context, e.g. "Học viên IELTS, band 6.5". */
  role?: string;
  avatar?: string;
  fallback: string;
}

export interface Testimonials2Props {
  heading: string;
  description?: string;
  testimonials: Testimonial[];
}

export default function Testimonials2({ heading, description, testimonials }: Testimonials2Props) {
  if (!testimonials.length) return null;
  return (
    <section className="bg-background px-4 py-16 md:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-foreground text-4xl font-black tracking-tight md:text-5xl">{heading}</h2>
        {description ? <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">{description}</p> : null}

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Card
              key={i}
              className="border-primary/20 from-primary/30 to-primary/20 relative h-full overflow-hidden rounded-[2rem] border-2 bg-gradient-to-b p-2 text-left ring-0"
            >
              <CardContent className="bg-card flex h-full flex-col rounded-3xl px-5 py-5">
                <div className="mb-4 flex items-center gap-1">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} aria-hidden="true" className="fill-accent text-accent h-4 w-4" />
                  ))}
                </div>
                <p className="text-foreground flex-1 text-lg leading-relaxed font-semibold">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <Avatar className="h-9 w-9 rounded-xl">
                    {t.avatar ? <AvatarImage src={t.avatar} alt="" /> : null}
                    <AvatarFallback>{t.fallback}</AvatarFallback>
                  </Avatar>
                  <span className="leading-tight">
                    <span className="text-foreground block text-sm font-extrabold">{t.name}</span>
                    {t.role ? <span className="text-muted-foreground block text-xs font-semibold">{t.role}</span> : null}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
