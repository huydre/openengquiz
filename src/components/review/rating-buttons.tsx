"use client";

import { Button } from "@/components/ui/button";
import type { ReviewInterval, ReviewRating } from "./review-types";

const RATINGS: { value: ReviewRating; label: string }[] = [
  { value: 1, label: "Học lại" },
  { value: 2, label: "Khó" },
  { value: 3, label: "Tốt" },
  { value: 4, label: "Dễ" },
];

export function RatingButtons({ intervals, disabled, onRate }: {
  intervals: Record<ReviewRating, ReviewInterval>;
  disabled: boolean;
  onRate: (rating: ReviewRating) => void;
}) {
  return (
    <div role="group" aria-label="Bạn nhớ từ này ở mức nào?" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {RATINGS.map(({ value, label }) => (
        <Button
          key={value}
          type="button"
          variant={value === 3 ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onRate(value)}
          aria-label={`${value}. ${label}, ôn lại sau ${intervals[value].label}`}
          className="h-auto min-h-16 flex-col gap-1 py-3"
        >
          <span>{value}. {label}</span>
          <span className="text-xs font-semibold normal-case">{intervals[value].label}</span>
        </Button>
      ))}
    </div>
  );
}
