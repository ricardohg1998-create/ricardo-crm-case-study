import { z } from "zod";
import { nextActionSchema } from "./next-actions.ts";
const text = z.string().trim().max(10000),
  short = z.string().trim().max(240),
  ref = z.string().trim().max(1500),
  id = z.string().min(1).max(100);
const day = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Fecha no válida (AAAA-MM-DD)",
  );
export const prospectDefaults = {
  phase: "found",
  assignedTo: "Busca",
  signal: "",
  signalUrl: "",
  observedOn: "",
  hypothesis: "",
  researchNotes: "",
  channel: "email",
  channelState: "pending",
  channelBasis: "",
  draftSubject: "",
  draftBody: "",
  lastContactOn: "",
  lastContactRef: "",
  replyOn: "",
  replySummary: "",
  nextStep: "",
  followUpOn: "",
  decisionReason: "",
  batchId: null,
  opportunityId: null,
};
export const prospectFields = z
  .object({
    contactId: id,
    projectId: id,
    batchId: id.nullable().default(null),
    opportunityId: id.nullable().default(null),
    phase: z
      .enum([
        "found",
        "research",
        "draft",
        "ready",
        "contacted",
        "uncertain",
        "replied",
        "qualified",
        "paused",
        "discarded",
        "blocked",
      ])
      .default("found"),
    assignedTo: short.default("Busca"),
    signal: text.default(""),
    signalUrl: ref.default(""),
    observedOn: day.default(""),
    hypothesis: text.default(""),
    researchNotes: text.default(""),
    channel: z
      .enum(["email", "form", "linkedin", "whatsapp", "phone", "other"])
      .default("email"),
    channelState: z.enum(["pending", "enabled", "blocked"]).default("pending"),
    channelBasis: text.default(""),
    draftSubject: short.default(""),
    draftBody: text.default(""),
    lastContactOn: day.default(""),
    lastContactRef: ref.default(""),
    replyOn: day.default(""),
    replySummary: text.default(""),
    nextStep: nextActionSchema.default(""),
    followUpOn: day.default(""),
    decisionReason: text.default(""),
  })
  .strict();
export const batchDefaults = {
  campaignId: null,
  status: "planned",
  focus: "",
  review: "",
  decision: "pending",
};
export const batchFields = z
  .object({
    projectId: id,
    campaignId: id.nullable().default(null),
    name: short.min(1),
    status: z
      .enum(["planned", "active", "paused", "closed"])
      .default("planned"),
    focus: text.default(""),
    review: text.default(""),
    decision: z
      .enum(["pending", "keep", "investigate", "change", "close"])
      .default("pending"),
  })
  .strict();
export const prospectKeys = Object.keys(prospectFields.shape);
export const batchKeys = Object.keys(batchFields.shape);
export type Prospect = z.infer<typeof prospectFields> & {
  id: string;
  archived: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type Batch = z.infer<typeof batchFields> & {
  memberCount?: number;
  exportedCount?: number;
  sentCount?: number;
  id: string;
  archived: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};
