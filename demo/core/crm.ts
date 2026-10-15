import { z } from "zod";
import { nextActionSchema, nextActionLabel, pipelineRows, minimumPauseDate } from "./next-actions.ts";
import {
  prospectFields,
  batchFields,
  prospectKeys,
  batchKeys,
} from "./prospect-contract.ts";

export type Actor = {
  id: string;
  label: string;
  permission: "read" | "write" | "owner";
  mailEnabled?: boolean;
};
export type AgentAccessEnv = { CRM_MAIL_AGENT_IDS?: string };
export const canManageMail = (actor: Actor) => actor.permission === "owner" || (actor.permission === "write" && actor.mailEnabled === true);
export function mailOperatorOnly(actor: Actor) {
  if (!canManageMail(actor)) throw new CRMError(403, "Esta conexión no tiene permiso para enviar correo ni ejecutar seguimientos.");
}
function delegatedMail(id: string, permission: string, access: AgentAccessEnv): boolean {
  if (permission !== "write" || !access.CRM_MAIL_AGENT_IDS) return false;
  try {
    const ids: unknown = JSON.parse(access.CRM_MAIL_AGENT_IDS);
    return Array.isArray(ids) && ids.every(value => typeof value === "string") && ids.includes(id);
  } catch { return false; }
}
export class CRMError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const short = z.string().trim().max(240);
const long = z.string().trim().max(10000);
const id = z.string().min(1).max(100);
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
const url = z
  .string()
  .trim()
  .max(1500)
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "Usa una dirección https:// o http://",
  );
const contactFields = z
  .object({
    name: short.min(1),
    company: short.default(""),
    contactPerson: short.default(""),
    location: short.default(""),
    businessDescription: long.default(""),
    detectedNeed: long.default(""),
    collaborationFit: long.default(""),
    sectorId: id.nullable().default(null),
    email: z
      .union([z.literal(""), z.string().trim().email().max(320)])
      .default(""),
    phone: short.default(""),
    website: url.default(""),
    source: short.default(""),
    notes: long.default(""),
    projectIds: z.array(id).max(20).default([]),
    doNotContact: z.boolean().default(false),
    doNotContactReason: long.default(""),
    relationship: z
      .enum(["prospect", "client", "partner", "other"])
      .default("prospect"),
  })
  .strict();
const opportunityFields = z
  .object({
    projectId: id,
    contactId: id,
    title: short.min(1),
    stage: z
      .enum([
        "identified",
        "contacted",
        "conversation",
        "proposal",
        "won",
        "lost",
        "paused",
      ])
      .default("identified"),
    valueCents: z
      .number()
      .int()
      .min(0)
      .max(10000000000)
      .nullable()
      .default(null),
    nextStep: nextActionSchema.default(""),
    followUpOn: day.default(""),
    notes: long.default(""),
  })
  .strict();
const taskFields = z
  .object({
    title: short.default(""),
    actionType: nextActionSchema.default(""),
    dueOn: day.default(""),
    contactId: id.nullable().default(null),
    opportunityId: id.nullable().default(null),
    projectId: id.nullable().default(null),
    completed: z.boolean().default(false),
  })
  .strict();
const projectFields = z
  .object({
    name: short.min(1),
    domain: short.default(""),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default("#517d68"),
  })
  .strict();
const revision = { id, expectedVersion: z.number().int().positive() };
export const operations = {
  "contacts.create": contactFields,
  "contacts.update": contactFields.partial().extend(revision).strict(),
  "opportunities.create": opportunityFields,
  "opportunities.update": opportunityFields.partial().extend(revision).strict(),
  "tasks.create": taskFields.extend({ actionType: nextActionSchema.refine((v) => Boolean(v), "Selecciona un próximo paso") }),
  "tasks.update": taskFields.partial().extend(revision).strict(),
  "projects.create": projectFields,
  "projects.update": projectFields.partial().extend(revision).strict(),
  "prospects.create": prospectFields,
  "prospects.update": prospectFields.partial().extend(revision).strict(),
  "batches.create": batchFields,
  "batches.update": batchFields.partial().extend(revision).strict(),
  archive: z
    .object({
      entity: z.enum([
        "contacts",
        "opportunities",
        "projects",
        "prospects",
        "batches",
        "activities",
      ]),
      ...revision,
      archived: z.boolean(),
    })
    .strict(),
  "activities.create": z
    .object({
      contactId: id,
      opportunityId: id.nullable().default(null),
      projectId: id.nullable().default(null),
      kind: z.enum(["note", "email", "call", "meeting", "message", "other"]),
      body: long.min(1),
      emailSubject: short.default(""),
      emailBody: z.string().max(50000).default(""),
      sourceRef: z.string().trim().max(1500).default(""),
      occurredAt: z.string().datetime({ offset: true }).optional(),
    })
    .strict(),
  "activities.update": z
    .object({
      ...revision,
      body: long.min(1).optional(),
      emailSubject: short.optional(),
      emailBody: z.string().max(50000).optional(),
      sourceRef: z.string().trim().max(1500).optional(),
    })
    .strict(),
};
export type Operation = keyof typeof operations;
const columns: Record<string, string[]> = {
  contacts: [
    "name",
    "company",
    "contactPerson",
    "location",
    "businessDescription",
    "detectedNeed",
    "collaborationFit",
    "sectorId",
    "email",
    "phone",
    "website",
    "source",
    "notes",
    "relationship",
    "projectIds",
    "doNotContact",
    "doNotContactReason",
  ],
  projects: ["name", "domain", "color"],
  prospects: prospectKeys,
  batches: batchKeys,
  opportunities: [
    "projectId",
    "contactId",
    "title",
    "stage",
    "valueCents",
    "nextStep",
    "followUpOn",
    "notes",
  ],
  tasks: [
    "title",
    "actionType",
    "dueOn",
    "contactId",
    "opportunityId",
    "projectId",
    "completed",
  ],
  activities: [
    "contactId",
    "opportunityId",
    "projectId",
    "kind",
    "body",
    "emailSubject",
    "emailBody",
    "sourceRef",
    "occurredAt",
    "recordedAt",
    "actor",
  ],
};
export const snake = (v: string) =>
  v.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const camelRow = (row: unknown): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row as Record<string, unknown>).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      k === "project_ids" ? (JSON.parse(String(v)) as unknown) : v,
    ]),
  );
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
function writable(actor: Actor) {
  if (actor.permission === "read")
    throw new CRMError(403, "Esta conexión solo permite consultar.");
}
export function ownerOnly(actor: Actor) {
  if (actor.permission !== "owner")
    throw new CRMError(
      403,
      "Solo el propietario puede gestionar accesos y proyectos.",
    );
}
async function get(db: D1Database, entity: string, recordId: string) {
  const row = await db
    .prepare(`SELECT * FROM ${entity} WHERE id = ?`)
    .bind(recordId)
    .first<Record<string, unknown>>();
  if (!row) throw new CRMError(404, "No se ha encontrado el registro.");
  return camelRow(row);
}
export async function snapshot(db: D1Database) {
  const tables = [
    "prospects",
    "batches",
    "projects",
    "contacts",
    "opportunities",
    "tasks",
    "activities",
  ];
  const results = await db.batch(
    tables.map((table) =>
      db.prepare(
        table === "batches" ? "SELECT b.*,(SELECT count(*) FROM batch_members m WHERE m.batch_id=b.id) AS member_count,(SELECT count(*) FROM batch_members m WHERE m.batch_id=b.id AND m.status='exported') AS exported_count,(SELECT count(*) FROM batch_members m WHERE m.batch_id=b.id AND m.status='sent') AS sent_count FROM batches b ORDER BY b.updated_at DESC LIMIT 1001" : `SELECT * FROM ${table}${table === "activities" ? " WHERE archived=0" : ""} ORDER BY ${table === "activities" ? "recorded_at" : "updated_at"} DESC LIMIT 1001`,
      ),
    ),
  );
  const data: Record<string, unknown> = {};
  results.forEach((result, i) => {
    data[tables[i]] = result.results.slice(0, 1000).map(camelRow);
  });
  data.truncated = tables.filter((_, i) => results[i].results.length > 1000);
  data.pipeline = pipelineRows(data.opportunities as Parameters<typeof pipelineRows>[0], data.prospects as Parameters<typeof pipelineRows>[1], data.contacts as Parameters<typeof pipelineRows>[2]);
  return data;
}
export async function search(db: D1Database, input: unknown) {
  const args = z
    .object({
      query: z.string().max(240).default(""),
      projectId: id.optional(),
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(30),
      includeArchived: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  const term = `%${args.query.replace(/[\\%_]/g, "\\$&")}%`;
  const statement = db
    .prepare(
      `SELECT DISTINCT c.* FROM contacts c LEFT JOIN opportunities o ON o.contact_id = c.id WHERE (? = 1 OR c.archived = 0) AND (c.name LIKE ? ESCAPE '\\' OR c.company LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.notes LIKE ? ESCAPE '\\' OR c.website LIKE ? ESCAPE '\\' OR c.contact_person LIKE ? ESCAPE '\\' OR c.location LIKE ? ESCAPE '\\' OR c.business_description LIKE ? ESCAPE '\\' OR c.collaboration_fit LIKE ? ESCAPE '\\' OR c.detected_need LIKE ? ESCAPE '\\') AND (? IS NULL OR o.project_id = ? OR EXISTS (SELECT 1 FROM json_each(c.project_ids) WHERE value=?)) ORDER BY c.name COLLATE NOCASE LIMIT ? OFFSET ?`,
    )
    .bind(
      args.includeArchived ? 1 : 0,
      term,
      term,
      term,
      term,
      term,
      term,
      term,
      term,
      term,
      term,
      args.projectId ?? null,
      args.projectId ?? null,
      args.projectId ?? null,
      args.limit + 1,
      args.offset,
    );
  const rows = (await statement.all()).results;
  return {
    records: rows.slice(0, args.limit).map(camelRow),
    nextOffset: rows.length > args.limit ? args.offset + args.limit : null,
  };
}
export async function contactContext(db: D1Database, input: unknown) {
  const args = z
    .object({
      contactId: id,
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(50),
      includeArchived: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  const contact = await get(db, "contacts", args.contactId);
  const data = await db.batch([
    db
      .prepare(
        "SELECT o.*, p.name AS project_name FROM opportunities o JOIN projects p ON p.id=o.project_id WHERE o.contact_id=? ORDER BY o.updated_at DESC",
      )
      .bind(args.contactId),
    db
      .prepare(
        "SELECT * FROM activities WHERE contact_id=? AND (?=1 OR archived=0) ORDER BY occurred_at DESC, recorded_at DESC, id DESC LIMIT ? OFFSET ?",
      )
      .bind(
        args.contactId,
        args.includeArchived ? 1 : 0,
        args.limit + 1,
        args.offset,
      ),
    db
      .prepare("SELECT * FROM tasks WHERE contact_id=? ORDER BY due_on")
      .bind(args.contactId),
    db
      .prepare(
        "SELECT * FROM prospects WHERE contact_id=? ORDER BY updated_at DESC",
      )
      .bind(args.contactId),
    db.prepare("SELECT m.id,m.batch_id,m.sector,m.run_id,m.status,m.reserved_until,m.exported_at,m.sent_at,m.sent_ref FROM batch_members m WHERE m.contact_id=? ORDER BY m.created_at DESC LIMIT 101").bind(args.contactId),
    db.prepare("SELECT m.*,c.name AS campaign_name,c.project_id,c.objective FROM campaign_members m JOIN campaigns c ON c.id=m.campaign_id WHERE m.contact_id=? ORDER BY m.updated_at DESC LIMIT 101").bind(args.contactId),
  ]);
  return {
    contact,
    nextSteps: [
      ...data[3].results.map(camelRow).filter((r) => !r.archived && (r.nextStep || r.followUpOn)).map((r) => ({ entity: "prospects", id: r.id, version: r.version, projectId: r.projectId, action: r.nextStep, label: nextActionLabel(String(r.nextStep)), dueOn: r.followUpOn })),
      ...data[0].results.map(camelRow).filter((r) => !r.archived && (r.nextStep || r.followUpOn)).map((r) => ({ entity: "opportunities", id: r.id, version: r.version, projectId: r.projectId, action: r.nextStep, label: nextActionLabel(String(r.nextStep)), dueOn: r.followUpOn })),
      ...data[2].results.map(camelRow).filter((r) => !r.completed).map((r) => ({ entity: "tasks", id: r.id, version: r.version, projectId: r.projectId, action: r.actionType, label: r.title, dueOn: r.dueOn })),
    ],
    opportunities: data[0].results.map(camelRow),
    activities: data[1].results.slice(0, args.limit).map(camelRow),
    tasks: data[2].results.map(camelRow),
    prospects: data[3].results.map(camelRow),
    batchMemberships: data[4].results.slice(0,100).map(camelRow),
    batchMembershipsTruncated: data[4].results.length>100,
    campaignMemberships: data[5].results.slice(0,100).map(camelRow),
    campaignMembershipsTruncated: data[5].results.length>100,
    nextOffset:
      data[1].results.length > args.limit ? args.offset + args.limit : null,
  };
}
export async function history(db: D1Database, input: unknown = {}) {
  // All writes, including agent changes, are retained here.
  const args = z
    .object({
      entityId: id.optional(),
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(40),
    })
    .strict()
    .parse(input);
  const data = await db
    .prepare(
      "SELECT id,entity,entity_id,action,actor,recorded_at,before_json,after_json FROM audit WHERE (? IS NULL OR entity_id=?) ORDER BY recorded_at DESC LIMIT ? OFFSET ?",
    )
    .bind(
      args.entityId ?? null,
      args.entityId ?? null,
      args.limit + 1,
      args.offset,
    )
    .all();
  return {
    records: data.results.slice(0, args.limit).map(camelRow),
    nextOffset:
      data.results.length > args.limit ? args.offset + args.limit : null,
  };
}
async function validateLinks(
  db: D1Database,
  entity: string,
  row: Record<string, unknown>,
) {
  if (entity === "contacts")
    for (const projectId of row.projectIds as string[])
      await get(db, "projects", projectId);
  if (entity === "opportunities") {
    const contact = await get(db, "contacts", String(row.contactId));
    const project = await get(db, "projects", String(row.projectId));
    if (contact.archived || project.archived)
      throw new CRMError(409, "Selecciona un contacto y un proyecto activos.");
  }
  if (entity === "batches") {
    await get(db, "projects", String(row.projectId));
    if (row.campaignId) {
      const campaign = await db.prepare("SELECT project_id FROM campaigns WHERE id=?").bind(row.campaignId).first<{project_id:string}>();
      if (!campaign || campaign.project_id !== row.projectId) throw new CRMError(400, "La campaña debe pertenecer a la misma marca que la tanda.");
    }
  }
  if (entity === "prospects") {
    const contact = await get(db, "contacts", String(row.contactId));
    await get(db, "projects", String(row.projectId));
    if (contact.archived && !row.archived)
      throw new CRMError(
        409,
        "Recupera el contacto antes de reabrir su prospección.",
      );
    if (row.batchId) {
      const batch = await get(db, "batches", String(row.batchId));
      if (batch.projectId !== row.projectId)
        throw new CRMError(400, "La tanda pertenece a otro proyecto.");
    }
    if (row.opportunityId) {
      const opportunity = await get(
        db,
        "opportunities",
        String(row.opportunityId),
      );
      if (
        opportunity.contactId !== row.contactId ||
        opportunity.projectId !== row.projectId
      )
        throw new CRMError(
          400,
          "La oportunidad no corresponde a este candidato y proyecto.",
        );
    }
    const duplicate = await db
      .prepare(
        "SELECT id FROM prospects WHERE contact_id=? AND archived=0 AND id<>?",
      )
      .bind(row.contactId, row.id)
      .first();
    if (!row.archived && duplicate)
      throw new CRMError(
        409,
        "Este contacto ya tiene una ficha de prospección activa. Reutilízala para coordinar las marcas.",
      );
    if (
      contact.doNotContact &&
      ["ready", "contacted"].includes(String(row.phase))
    )
      throw new CRMError(
        409,
        "Este contacto tiene una baja o negativa vigente en el CRM compartido.",
      );
  }
  if (entity === "activities" || entity === "tasks") {
    if (row.contactId) await get(db, "contacts", String(row.contactId));
    if (row.projectId) await get(db, "projects", String(row.projectId));
    if (row.opportunityId) {
      const opportunity = await get(
        db,
        "opportunities",
        String(row.opportunityId),
      );
      if (row.contactId && row.contactId !== opportunity.contactId)
        throw new CRMError(400, "La oportunidad pertenece a otro contacto.");
      if (row.projectId && row.projectId !== opportunity.projectId)
        throw new CRMError(400, "La oportunidad pertenece a otro proyecto.");
      row.contactId = opportunity.contactId;
      row.projectId = opportunity.projectId;
    }
  }
}
export async function mutate(
  db: D1Database,
  actor: Actor,
  operation: Operation,
  input: unknown,
  requestId: string,
) {
  writable(actor);
  if (!(operation in operations))
    throw new CRMError(400, "Operación no válida.");
  const parsed = operations[operation].parse(input) as Record<string, unknown>;
  if (
    operation.startsWith("projects.") ||
    (operation === "archive" && parsed.entity === "projects")
  )
    ownerOnly(actor);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))
    throw new CRMError(
      400,
      "La operación necesita un identificador de petición.",
    );
  const requestKey = `${actor.id}:${requestId}`;
  const inputHash = await digest(
    JSON.stringify({
      operation,
      input: Object.fromEntries(
        Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b)),
      ),
    }),
  );
  const previous = await db
    .prepare("SELECT after_json,input_hash FROM audit WHERE request_key=?")
    .bind(requestKey)
    .first<{ after_json: string; input_hash: string }>();
  if (previous) {
    if (previous.input_hash !== inputHash)
      throw new CRMError(
        409,
        "El identificador de petición ya se usó para otro cambio.",
      );
    return JSON.parse(previous.after_json);
  }
  const entity =
    operation === "archive" ? String(parsed.entity) : operation.split(".")[0];
  const editing = operation.endsWith(".update") || operation === "archive";
  const before = editing ? await get(db, entity, String(parsed.id)) : null;
  if (editing && before!.version !== parsed.expectedVersion)
    throw new CRMError(
      409,
      "El registro ha cambiado. Actualiza la ficha antes de guardar.",
    );
  const now = new Date().toISOString();
  const record: Record<string, unknown> = editing
    ? { ...before }
    : { id: crypto.randomUUID() };
  if (operation === "archive") record.archived = parsed.archived ? 1 : 0;
  else
    for (const key of columns[entity])
      if (key in parsed) record[key] = parsed[key];
  if (entity === "contacts") {
    if ("sectorId" in parsed && record.sectorId) {
      const sector = await db.prepare("SELECT id FROM sectors WHERE id=? AND archived=0").bind(record.sectorId).first();
      if (!sector) throw new CRMError(400, "Selecciona un sector activo.");
    }
    if (before?.doNotContact && parsed.doNotContact === false) ownerOnly(actor);
    record.doNotContact = record.doNotContact ? 1 : 0;
    record.email = String(record.email ?? "").toLowerCase();
    if (record.email) {
      const duplicate = await db
        .prepare("SELECT id FROM contacts WHERE lower(email)=? AND id<>?")
        .bind(record.email, record.id)
        .first();
      if (duplicate)
        throw new CRMError(
          409,
          `Ya existe un contacto con ese correo (ID ${duplicate.id}). Revisa su ficha.`,
        );
    }
  }
  if (entity === "tasks") {
    record.completed = record.completed ? 1 : 0;
    if (record.actionType) record.title = nextActionLabel(String(record.actionType));
  }
  if (entity === "activities") {
    record.archived ??= 0;
    record.version = editing ? Number(before!.version) + 1 : 1;
    record.updatedAt = now;
    if (!editing) {
      record.occurredAt ??= now;
      record.recordedAt = now;
      record.actor = actor.label;
    }
  } else {
    record.version = editing ? Number(before!.version) + 1 : 1;
    record.createdAt = editing ? before!.createdAt : now;
    record.updatedAt = now;
    if (entity !== "tasks") record.archived ??= 0;
  }
  const nextAction = entity === "tasks" ? parsed.actionType : parsed.nextStep;
  if (entity === "prospects" && nextAction === "do_not_contact") record.phase = "blocked";
  if (entity === "prospects" && nextAction === "discard") record.phase = "discarded";
  const previousAction = entity === "tasks" ? before?.actionType : before?.nextStep;
  if (nextAction === "reactivate" && previousAction === "pause_3_months") {
    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
    const dateKey = entity === "tasks" ? "dueOn" : "followUpOn";
    if (String(before?.[dateKey] || "") > day)
      throw new CRMError(400, "La pausa aún no ha terminado. Conserva la fecha de revisión.");
    if (entity === "prospects") record.phase = "found";
  }
  if (nextAction === "pause_3_months" && previousAction !== "pause_3_months") {
    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
    const minimum = minimumPauseDate(day);
    const dateKey = entity === "tasks" ? "dueOn" : "followUpOn";
    // A retained date from the previous step must not shorten a new pause.
    record[dateKey] = String(record[dateKey] || "") < minimum ? minimum : record[dateKey];
    if (entity === "prospects") record.phase = "paused";
  }
  const action = entity === "tasks" ? record.actionType : record.nextStep;
  if (action === "pause_3_months" && previousAction === "pause_3_months") {
    const dateKey = entity === "tasks" ? "dueOn" : "followUpOn";
    if (String(record[dateKey] || "") < String(before?.[dateKey] || ""))
      throw new CRMError(400, "No acortes la pausa; elige Reactivar cuando corresponda.");
  }
  await validateLinks(db, entity, record);
  if (nextAction === "do_not_contact" && record.contactId) {
    const contact = await get(db, "contacts", String(record.contactId));
    if (!contact.doNotContact)
      await mutate(db, actor, "contacts.update", {
        id: contact.id,
        expectedVersion: contact.version,
        doNotContact: true,
        doNotContactReason: contact.doNotContactReason || "No contactar registrado como próximo paso.",
      }, (await digest(`${requestId}-do-not-contact`)).slice(0, 40));
  }
  if (
    operation === "archive" &&
    parsed.archived &&
    (entity === "contacts" || entity === "projects")
  ) {
    const foreign = entity === "contacts" ? "contact_id" : "project_id";
    const open = await db
      .prepare(
        `SELECT id FROM opportunities WHERE ${foreign}=? AND archived=0 AND stage NOT IN ('won','lost') LIMIT 1`,
      )
      .bind(record.id)
      .first();
    if (open)
      throw new CRMError(
        409,
        "Hay oportunidades abiertas. Ciérralas o archívalas antes.",
      );
  }
  const values = Object.entries(record);
  const bindValue = (k: string, v: unknown) =>
    k === "projectIds" ? JSON.stringify(v) : (v as string | number | null);
  const dbValues = values.map(([k, v]) => bindValue(k, v));
  const change = editing
    ? db
        .prepare(
          `UPDATE ${entity} SET ${values
            .filter(([k]) => k !== "id")
            .map(([k]) => `${snake(k)}=?`)
            .join(",")} WHERE id=? AND version=?`,
        )
        .bind(
          ...values
            .filter(([k]) => k !== "id")
            .map(([k, v]) => bindValue(k, v)),
          record.id as string,
          parsed.expectedVersion as number,
        )
    : db
        .prepare(
          `INSERT INTO ${entity} (${values.map(([k]) => snake(k)).join(",")}) VALUES (${values.map(() => "?").join(",")})`,
        )
        .bind(...dbValues);
  const entry = db
    .prepare(
      "INSERT INTO audit (id,entity,entity_id,action,actor,recorded_at,before_json,after_json,request_key,input_hash) SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()=1",
    )
    .bind(
      crypto.randomUUID(),
      entity,
      record.id as string,
      operation,
      actor.label,
      now,
      before ? JSON.stringify(before) : null,
      JSON.stringify(record),
      requestKey,
      inputHash,
    );
  try {
    const result = await db.batch([change, entry]);
    if (result[0].meta.changes !== 1)
      throw new CRMError(
        409,
        "Otro agente acaba de modificar el registro. Actualiza y vuelve a intentarlo.",
      );
  } catch (error) {
    if (error instanceof CRMError) throw error;
    const retry = await db
      .prepare("SELECT after_json,input_hash FROM audit WHERE request_key=?")
      .bind(requestKey)
      .first<{ after_json: string; input_hash: string }>();
    if (retry?.input_hash === inputHash) return JSON.parse(retry.after_json);
    throw error;
  }
  return record;
}
