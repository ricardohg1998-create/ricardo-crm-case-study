import { z } from "zod";

export const nextActions = [
  { id: "wait_reply", name: "Esperar respuesta" },
  { id: "first_follow_up", name: "1.º seguimiento (5–7 días)" },
  { id: "second_follow_up", name: "2.º seguimiento (~10 días)" },
  { id: "pause_3_months", name: "Pausar 3+ meses" },
  { id: "reactivate", name: "Reactivar" },
  { id: "draft_reply", name: "Borrador de respuesta" },
  { id: "await_their_reply", name: "Esperar su respuesta" },
  { id: "call_whatsapp", name: "Llamar / WhatsApp" },
  { id: "discard", name: "Descartar" },
  { id: "do_not_contact", name: "No contactar" },
  { id: "initial_contact", name: "Enviar primer contacto" },
  { id: "partner_proposal", name: "Colaborador: propuesta / comisión" },
  { id: "meeting_proposal", name: "Cita / propuesta comercial" },
] as const;
export const nextActionSchema = z.enum(["", ...nextActions.map((a) => a.id)] as [string, ...string[]]);
export const nextActionLabel = (value: string) => nextActions.find((a) => a.id === value)?.name ?? value;
export const isNextAction = (value: string) => !value || nextActions.some((a) => a.id === value);
export function minimumPauseDate(day: string) {
  const start = new Date(`${day}T12:00:00Z`);
  const month = start.getUTCMonth() + 3;
  const target = new Date(Date.UTC(start.getUTCFullYear(), month, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}

type Relation = { id: string; contactId: string; projectId: string; archived: number };
export function pipelineRows(opportunities: (Relation & { stage: string })[], prospects: (Relation & { phase: string; opportunityId: string | null })[], contacts: { id: string; archived: number; doNotContact: number }[]) {
  const activeContacts = new Set(contacts.filter((c) => !c.archived && !c.doNotContact).map((c) => c.id));
  const live = opportunities.filter((o) => !o.archived && activeContacts.has(o.contactId));
  const pairs = new Set(live.map((o) => `${o.contactId}:${o.projectId}`));
  return [
    ...live.map((o) => {
      const p = prospects.find((p) => !p.archived && p.contactId === o.contactId && p.projectId === o.projectId);
      const phaseStage = p && ["replied", "qualified"].includes(p.phase) ? "conversation" : p?.phase === "contacted" ? "contacted" : "identified";
      const progress = ["identified", "contacted", "conversation"];
      const stage = progress.includes(o.stage) && progress.indexOf(phaseStage) > progress.indexOf(o.stage) ? phaseStage : o.stage;
      return { id: o.id, contactId: o.contactId, projectId: o.projectId, stage };
    }),
    ...prospects.filter((p) => !p.archived && activeContacts.has(p.contactId) && !pairs.has(`${p.contactId}:${p.projectId}`) && !["paused", "discarded", "blocked", "uncertain"].includes(p.phase)).map((p) => ({ id: p.id, contactId: p.contactId, projectId: p.projectId, stage: ["replied", "qualified"].includes(p.phase) ? "conversation" : p.phase === "contacted" ? "contacted" : "identified" })),
  ];
}
