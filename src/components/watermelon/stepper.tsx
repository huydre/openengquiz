'use client';

// modified: buttons are type="button" (safe inside forms), aria labels + live value, `step` and
// `label` props, edtech styling (light track, rounded-2xl, 3D buttons) instead of a primary-filled bar.

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HiMinus, HiPlus } from 'react-icons/hi';

export interface StepperProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange?: (val: number) => void;
  /** Amount added or removed per click. Default 1. */
  step?: number;
  /** Accessible name of the value, e.g. "Thẻ mới mỗi ngày". */
  label?: string;
}

const digitVariants = {
  initial: (dir: number) => ({
    y: dir > 0 ? 20 : -20,
    opacity: 0,
    scale: 0.5,
    z: 0,
    filter: 'blur(2px)',
  }),
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    z: 10,
    filter: 'blur(0px)',
  },
  exit: (dir: number) => ({
    y: dir > 0 ? -20 : 20,
    opacity: 0,
    scale: 0.5,
    z: 0,
    filter: 'blur(2px)',
  }),
};

export function Stepper({
  value,
  defaultValue = 0,
  min = 0,
  max = 999,
  onChange,
  step: stepSize = 1,
  label = 'Giá trị',
}: StepperProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue);
  const [direction, setDirection] = React.useState(0);

  const current = isControlled ? value! : internal;
  const digits = current.toString().split('');

  const [prevDigits, setPrevDigits] = React.useState<string[]>([]);
  const [prevTicks, setPrevTicks] = React.useState<number[]>([]);

  const len = digits.length;
  const lenDiff = len - prevDigits.length;

  const nextTicks = digits.map((digit, i) => {
    const prevI = i - lenDiff;
    const prevDigit = prevI >= 0 ? prevDigits[prevI] : undefined;
    const prevTick = prevI >= 0 ? prevTicks[prevI] : 0;

    return digit !== prevDigit ? (prevTick ?? 0) + 1 : (prevTick ?? 0);
  });

  if (prevDigits.join("") !== digits.join("")) {
    setPrevTicks(nextTicks);
    setPrevDigits(digits);
  }

  const step = (dir: number) => {
    const next = Math.min(max, Math.max(min, current + dir * stepSize));
    if (next === current) return;
    setDirection(dir);
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <div className="theme-injected flex w-fit">
      <div role="group" aria-label={label} className="border-border bg-background flex items-center gap-3 rounded-2xl border-2 p-1.5 shadow-[0_3px_0_var(--border)] sm:gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          type="button"
          aria-label={`Giảm ${label}`}
          onClick={() => step(-1)}
          disabled={current <= min}
          className="bg-primary text-primary-foreground flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl shadow-[0_3px_0_var(--primary-edge)] active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HiMinus aria-hidden="true" className="size-5" />
        </motion.button>

        <div aria-live="polite" aria-label={`${label}: ${current}`} className="text-foreground relative flex h-8 min-w-12 shrink-0 items-center justify-center gap-0 text-2xl font-black perspective-midrange transform-3d">
          {digits.map((digit, index) => (
            <div
              key={`${index}-${len}`}
              aria-hidden="true" className="relative h-8 w-3.5 transform-3d"
            >
              <AnimatePresence
                mode="popLayout"
                initial={false}
                custom={direction}
              >
                <motion.span
                  key={nextTicks[index]}
                  custom={direction}
                  variants={digitVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 16,
                    mass: 1.2,
                  }}
                  className="absolute inset-0 flex items-center justify-center tabular-nums"
                >
                  {digit}
                </motion.span>
              </AnimatePresence>
            </div>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          type="button"
          aria-label={`Tăng ${label}`}
          onClick={() => step(1)}
          disabled={current >= max}
          className="bg-primary text-primary-foreground flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl shadow-[0_3px_0_var(--primary-edge)] active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HiPlus aria-hidden="true" className="size-5" />
        </motion.button>
      </div>
    </div>
  );
}
