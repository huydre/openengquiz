"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Stepper } from "@/components/watermelon/stepper";
import { saveNewCardLimit, type LimitActionState } from "./actions";

const INITIAL: LimitActionState = { message: "", saved: false };
const STEP = 5;
const MIN = 5;
const MAX = 100;

export function NewCardLimitSetting({ currentLimit }: { currentLimit: number }) {
  const [state, action, pending] = useActionState(saveNewCardLimit, INITIAL);
  const [value, setValue] = useState(currentLimit);

  return (
    <Collapsible className="bg-card w-full rounded-3xl border-2 shadow-[0_4px_0_var(--border)]">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-3xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span aria-hidden="true" className="bg-brand-orange/15 text-brand-orange grid size-10 shrink-0 place-items-center rounded-2xl">
          <Sparkles className="size-5" />
        </span>
        <span className="flex-1">
          <span className="block font-extrabold">Giới hạn thẻ mới</span>
          <span className="text-muted-foreground block text-sm">Số thẻ chưa học được đưa vào ôn mỗi ngày</span>
        </span>
        <span className="bg-primary/15 text-sidebar-accent-foreground rounded-full px-3 py-1 text-sm font-extrabold">
          {currentLimit}/ngày
        </span>
        <ChevronDown aria-hidden="true" className="text-muted-foreground size-5 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <form action={action} className="flex flex-wrap items-center gap-4 border-t-2 px-4 pt-4 pb-5">
          <Stepper
            value={value}
            onChange={setValue}
            min={MIN}
            max={MAX}
            step={STEP}
            label="Thẻ mới mỗi ngày"
          />
          <input type="hidden" name="newCardsPerDay" value={value} />
          <Button type="submit" disabled={pending || value === currentLimit}>
            {pending ? "Đang lưu..." : "Lưu"}
          </Button>
          <p className="text-muted-foreground w-full text-sm">
            Mỗi lần bấm thay đổi {STEP} thẻ, từ {MIN} đến {MAX}. Ít thẻ mới giúp ôn đều hơn.
          </p>
          {state.message ? (
            <p role={state.saved ? "status" : "alert"} className={state.saved ? "text-primary w-full text-sm font-bold" : "text-destructive w-full text-sm font-bold"}>
              {state.message}
            </p>
          ) : null}
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
