"use client";

// Watermelon UI newsletter-2 (registry.watermelon.sh). Adapted: the form posts to a server action
// passed in as a prop and shows its result; a hidden honeypot field filters simple bots.
import React, { useActionState } from "react";
import { Input } from "@/components/ui/input";

export type NewsletterActionState = { status: "idle" | "success" | "error"; message: string };

export interface Newsletter2Props {
  action: (state: NewsletterActionState, formData: FormData) => Promise<NewsletterActionState>;
  heading?: string;
  description?: string;
  label?: string;
  placeholder?: string;
  buttonText?: string;
  disclaimer?: React.ReactNode;
  className?: string;
}

const initialState: NewsletterActionState = { status: "idle", message: "" };

const Newsletter2: React.FC<Newsletter2Props> = ({
  action,
  heading = "Subscribe to our newsletter",
  description,
  label = "Stay Informed",
  placeholder = "Enter your email",
  buttonText = "Subscribe",
  disclaimer,
  className,
}) => {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <section className={`flex h-full w-full items-center justify-center py-12 md:py-16 ${className ?? ""}`}>
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="from-secondary to-secondary/70 flex flex-col items-center justify-between gap-10 rounded-[2rem] bg-gradient-to-b p-8 text-white shadow-[0_8px_0_var(--secondary-edge)] md:p-12 lg:flex-row lg:gap-16 lg:p-16">
          <div className="flex w-full max-w-xl flex-col space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-balance md:text-4xl lg:text-5xl">
              {heading}
            </h2>
            {description ? (
              <p className="max-w-md text-base leading-relaxed text-white/85 md:text-lg">
                {description}
              </p>
            ) : null}
          </div>

          <div className="w-full max-w-md flex-1 lg:w-auto">
            <div className="flex flex-col space-y-3">
              {label && (
                <label htmlFor="newsletter-email" className="mb-1 block text-sm font-extrabold text-white md:text-base">
                  {label}
                </label>
              )}

              <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Input
                    id="newsletter-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={placeholder}
                    className="bg-background text-foreground h-12 rounded-xl pl-3 text-base sm:h-14 sm:w-full"
                    required
                  />
                  {/* Honeypot: hidden from people, filled by simple bots. */}
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="text-secondary-edge h-12 rounded-xl bg-white px-6 font-extrabold uppercase shadow-[0_4px_0_rgb(0_0_0/0.15)] transition-all active:translate-y-1 active:shadow-none disabled:opacity-70 sm:h-14 sm:px-8"
                >
                  {pending ? "Đang gửi..." : buttonText}
                </button>
              </form>

              {state.message ? (
                <p role={state.status === "error" ? "alert" : "status"} className="text-sm font-extrabold">
                  {state.message}
                </p>
              ) : null}

              {disclaimer && (
                <p className="mt-3 text-xs text-white/75 md:text-sm">
                  {disclaimer}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Newsletter2;
