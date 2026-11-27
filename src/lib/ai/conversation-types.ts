import { z } from "zod";

/** Client-safe types and schemas for AI Call (no server-only imports here). */

export const CALL_SCENARIOS = [
  { id: "interview", label: "Phỏng vấn xin việc", role: "a friendly interviewer at a small company" },
  { id: "restaurant", label: "Gọi món ở nhà hàng", role: "a waiter taking an order" },
  { id: "travel", label: "Hỏi đường du lịch", role: "a helpful local guiding a tourist" },
  { id: "hotel", label: "Nhận phòng khách sạn", role: "a hotel receptionist" },
  { id: "shopping", label: "Mua sắm", role: "a shop assistant helping a customer" },
  { id: "airport", label: "Ở sân bay", role: "an airport staff member helping a passenger" },
] as const;

export type CallScenarioId = (typeof CALL_SCENARIOS)[number]["id"];

export const callScenarioSchema = z.enum(CALL_SCENARIOS.map((s) => s.id) as [CallScenarioId, ...CallScenarioId[]]);

/** Hard cap on user turns per call; the DB RPC enforces the same limit. */
export const MAX_CALL_TURNS = 15;

export interface CallTargetTerm {
  term: string;
  definition_vi?: string | null;
}

export interface CallMessage {
  role: "user" | "assistant";
  content: string;
}

const summarySchema = z.object({
  used_terms: z.array(z.string().trim().min(1).max(200)).max(60),
  unused_terms: z.array(z.string().trim().min(1).max(200)).max(60),
  errors: z.array(z.object({
    original: z.string().trim().min(1).max(400),
    correction: z.string().trim().min(1).max(400),
    explanation_vi: z.string().trim().min(1).max(300),
  })).max(10),
  note_vi: z.string().trim().min(1).max(600),
});
export type CallSummary = z.infer<typeof summarySchema>;
export const callSummarySchema = summarySchema;
