"use server";
// Loaders + savers that back every page from the database. Each loader returns a
// JSON-safe, page-ready shape (style classes computed here where the UI stores them
// on the row) so pages only swap their data source — no hardcoded datasets remain.
import { prisma } from "@/lib/prisma";

// ── Projects ──────────────────────────────────────────────────────
export type AppProjectDTO = { id: string; name: string; clientName: string; location: string; pct: number; engineer: string; isDelayed: boolean };
export async function loadAppProjects(): Promise<AppProjectDTO[]> {
  const rows = await prisma.appProject.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, name: r.name, clientName: r.clientName, location: r.location, pct: r.pct, engineer: r.engineer, isDelayed: r.isDelayed }));
}
export async function saveProjectPct(id: string, pct: number): Promise<void> {
  await prisma.appProject.update({ where: { id }, data: { pct } });
}
export async function createProject(input: { name: string; clientName: string; location: string; engineer: string }): Promise<AppProjectDTO> {
  const count = await prisma.appProject.count();
  const row = await prisma.appProject.create({
    data: { id: `proj_${Date.now()}`, name: input.name, clientName: input.clientName, location: input.location, engineer: input.engineer, pct: 0, isDelayed: false, sortOrder: count + 1 },
  });
  // Record the assignment in the shared activity feed so it surfaces on the
  // dashboard and in the notifications dropdown. Written here (server-side)
  // rather than via the client logActivity so it survives the hard reload the
  // new-project page does on submit.
  await prisma.activityEntry.create({
    data: {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      icon: "assignment_ind",
      color: "#e30613",
      route: "/dashboard",
      text: `Assigned ${input.engineer} to`,
      bold: input.name,
      detail: `${input.name} (${input.clientName}, ${input.location}) was created and assigned to ${input.engineer}.`,
      by: "You",
      at: new Date(),
    },
  });
  return { id: row.id, name: row.name, clientName: row.clientName, location: row.location, pct: row.pct, engineer: row.engineer, isDelayed: row.isDelayed };
}

// ── Team ──────────────────────────────────────────────────────────
export type TeamMemberDTO = { id: string; name: string; role: string; email: string | null; phone: string | null; active: boolean };
export async function loadTeam(): Promise<TeamMemberDTO[]> {
  // Sourced from real User accounts (what the invite flow populates) so invited &
  // registered members show up in assignee/engineer/inspector dropdowns across the app.
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, email: r.email, phone: null, active: true }));
}

// ── Activity feed ─────────────────────────────────────────────────
export type ActivityDTO = { id: string; icon: string; color: string; route: string; text: string; bold: string; detail: string; by: string; at: string };
export async function loadActivities(): Promise<ActivityDTO[]> {
  const rows = await prisma.activityEntry.findMany({ orderBy: { at: "desc" } });
  return rows.map((r) => ({ id: r.id, icon: r.icon, color: r.color, route: r.route, text: r.text, bold: r.bold, detail: r.detail, by: r.by, at: r.at.toISOString() }));
}
export async function saveActivities(list: ActivityDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.activityEntry.deleteMany({}),
    prisma.activityEntry.createMany({ data: list.map((a) => ({ id: a.id, icon: a.icon, color: a.color, route: a.route, text: a.text, bold: a.bold, detail: a.detail, by: a.by, at: new Date(a.at) })) }),
  ]);
}

// ── Snags ─────────────────────────────────────────────────────────
const SNAG_PRIORITY_STYLE: Record<string, string> = {
  "HIGH PRIORITY": "bg-error/10 text-error border-error/20",
  MEDIUM: "bg-yellow-600/10 text-yellow-600 border-yellow-600/20",
  LOW: "bg-[#666666]/10 text-[#666666] border-[#666666]/20",
};
const SNAG_STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-primary/10 text-primary border-primary/20",
  CLOSED: "bg-surface-container-highest text-[#666666] border-surface-container-highest",
};
export type SnagDTO = { id: string; project: string; title: string; priority: string; priorityStyle: string; status: string; statusStyle: string; desc: string; assignee: string; time: string; closed: boolean; accent: boolean };
export async function loadSnags(): Promise<SnagDTO[]> {
  const rows = await prisma.snagEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    id: r.id, project: r.projectName, title: r.title,
    priority: r.priority, priorityStyle: SNAG_PRIORITY_STYLE[r.priority] ?? SNAG_PRIORITY_STYLE.MEDIUM,
    status: r.status, statusStyle: SNAG_STATUS_STYLE[r.status] ?? SNAG_STATUS_STYLE.OPEN,
    desc: r.description, assignee: r.assignee, time: r.displayTime, closed: r.closed, accent: r.accent,
  }));
}

// ── Design docs ───────────────────────────────────────────────────
export type DesignDocDTO = { id: string; icon: string; name: string; meta: string; by: string; date: string; status: string; feedback: string };
export async function loadDesignDocs(): Promise<DesignDocDTO[]> {
  const rows = await prisma.designDoc.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, icon: r.icon, name: r.name, meta: r.meta, by: r.by, date: r.date, status: r.status, feedback: r.feedback ?? "" }));
}
export async function saveDesignDocs(list: DesignDocDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.designDoc.deleteMany({}),
    prisma.designDoc.createMany({ data: list.map((d, i) => ({ id: d.id, icon: d.icon, name: d.name, meta: d.meta, by: d.by, date: d.date, status: d.status, feedback: d.feedback ?? "", sortOrder: i })) }),
  ]);
}

// ── Surveys + checklist ───────────────────────────────────────────
export type SurveyDTO = { id: string; project: string; date: string; conductor: string; status: string; photos: number; type: string; notes: string; checkedItems: string[] };
export type SurveyChecklistDTO = { category: string; items: string[] };
export async function loadSurveys(): Promise<SurveyDTO[]> {
  const rows = await prisma.surveyEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, project: r.projectName, date: r.date, conductor: r.conductor, status: r.status, photos: r.photos, type: r.type, notes: r.notes, checkedItems: r.checkedItems }));
}
export async function loadSurveyChecklist(): Promise<SurveyChecklistDTO[]> {
  const rows = await prisma.surveyChecklistCategory.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ category: r.category, items: r.items }));
}
export async function saveSurveys(list: SurveyDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.surveyEntry.deleteMany({}),
    prisma.surveyEntry.createMany({ data: list.map((s, i) => ({ id: s.id, projectName: s.project, date: s.date, conductor: s.conductor, status: s.status, photos: s.photos, type: s.type, notes: s.notes, checkedItems: s.checkedItems, sortOrder: i })) }),
  ]);
}
export async function saveSurveyChecklist(list: SurveyChecklistDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.surveyChecklistCategory.deleteMany({}),
    prisma.surveyChecklistCategory.createMany({ data: list.map((c, i) => ({ category: c.category, items: c.items, sortOrder: i })) }),
  ]);
}

// ── Audit ─────────────────────────────────────────────────────────
export type AuditItemDTO = { label: string; signed: boolean; signedBy: string | null; date: string | null };
export type AuditSectionDTO = { section: string; items: AuditItemDTO[] };
export type AuditProjectDTO = { name: string; completion: number; status: string };
export async function loadAudit(): Promise<AuditSectionDTO[]> {
  const rows = await prisma.auditEntry.findMany({ orderBy: { sortOrder: "asc" } });
  const sections: AuditSectionDTO[] = [];
  for (const r of rows) {
    let sec = sections.find((s) => s.section === r.section);
    if (!sec) { sec = { section: r.section, items: [] }; sections.push(sec); }
    sec.items.push({ label: r.label, signed: r.signed, signedBy: r.signedBy, date: r.date });
  }
  return sections;
}
export async function loadAuditProjects(): Promise<AuditProjectDTO[]> {
  const rows = await prisma.auditProjectRow.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ name: r.name, completion: r.completion, status: r.status }));
}
export async function saveAudit(sections: AuditSectionDTO[]): Promise<void> {
  const flat: { section: string; label: string; signed: boolean; signedBy: string | null; date: string | null; sortOrder: number }[] = [];
  let i = 0;
  for (const sec of sections) for (const it of sec.items) flat.push({ section: sec.section, label: it.label, signed: it.signed, signedBy: it.signedBy, date: it.date, sortOrder: i++ });
  await prisma.$transaction([
    prisma.auditEntry.deleteMany({}),
    prisma.auditEntry.createMany({ data: flat }),
  ]);
}

// ── DLP tickets + AMC ─────────────────────────────────────────────
const DLP_STATUS_STYLE: Record<string, string> = {
  Open: "bg-[#e30613]/10 text-[#e30613] border-[#e30613]/20",
  "In Progress": "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  "AMC Due": "bg-purple-500/10 text-purple-700 border-purple-500/20",
  Resolved: "bg-green-500/10 text-green-600 border-green-500/20",
};
const DLP_PRIORITY_STYLE: Record<string, string> = { High: "text-[#ba1a1a]", Medium: "text-yellow-700", Scheduled: "text-purple-700" };
export type DlpTicketDTO = { id: string; project: string; title: string; category: string; reportedDate: string; dueDate: string; assignee: string; status: string; statusStyle: string; priority: string; priorityStyle: string; amcDue: string | null };
export type AmcScheduleDTO = { service: string; project: string; nextDue: string; frequency: string; overdue: boolean };
export async function loadDlpTickets(): Promise<DlpTicketDTO[]> {
  const rows = await prisma.dlpTicketEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, project: r.projectName, title: r.title, category: r.category, reportedDate: r.reportedDate, dueDate: r.dueDate, assignee: r.assignee, status: r.status, statusStyle: DLP_STATUS_STYLE[r.status] ?? DLP_STATUS_STYLE.Open, priority: r.priority, priorityStyle: DLP_PRIORITY_STYLE[r.priority] ?? "text-[#666666]", amcDue: r.amcDue }));
}
export async function loadAmcSchedule(): Promise<AmcScheduleDTO[]> {
  const rows = await prisma.amcScheduleEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ service: r.service, project: r.projectName, nextDue: r.nextDue, frequency: r.frequency, overdue: r.overdue }));
}

// ── Site-progress BOQ ─────────────────────────────────────────────
const BOQ_STATUS: Record<string, { statusStyle: string; barColor: string }> = {
  "In Progress": { statusStyle: "bg-primary/10 text-primary border-primary/20", barColor: "bg-primary" },
  Completed: { statusStyle: "bg-green-500/10 text-green-600 border-green-500/20", barColor: "bg-green-500" },
  Delayed: { statusStyle: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", barColor: "bg-yellow-500" },
  Scheduled: { statusStyle: "bg-surface-container-highest text-[#666666] border-surface-container-highest", barColor: "bg-primary" },
};
export type BoqItemDTO = { name: string; category: string; status: string; statusStyle: string; budgeted: string; installed: string; pct: number; barColor: string };
export async function loadBoqItems(): Promise<BoqItemDTO[]> {
  const rows = await prisma.boqProgressItem.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => { const s = BOQ_STATUS[r.status] ?? BOQ_STATUS["In Progress"]; return { name: r.name, category: r.category, status: r.status, statusStyle: s.statusStyle, budgeted: r.budgeted, installed: r.installed, pct: r.pct, barColor: s.barColor }; });
}

// ── Site expenses + vendor scope ──────────────────────────────────
export type ExpenseDTO = { id: string; category: string; description: string; project: string; amount: string; amountNum: number; date: string; by: string; status: string; pmApprovedBy?: string; billingApprovedBy?: string; accountsApprovedBy?: string };
export type ScopeDTO = { id: string; vendor: string; project: string; scope: string; progress: number; status: string; dueDate: string };
export async function loadExpenses(): Promise<ExpenseDTO[]> {
  const rows = await prisma.siteExpenseEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, category: r.category, description: r.description, project: r.projectName, amount: r.amount, amountNum: Number(r.amountNum), date: r.date, by: r.by, status: r.status, pmApprovedBy: r.pmApprovedBy ?? undefined, billingApprovedBy: r.billingApprovedBy ?? undefined, accountsApprovedBy: r.accountsApprovedBy ?? undefined }));
}
export async function saveExpenses(list: ExpenseDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.siteExpenseEntry.deleteMany({}),
    prisma.siteExpenseEntry.createMany({ data: list.map((e, i) => ({ id: e.id, category: e.category, description: e.description, projectName: e.project, amount: e.amount, amountNum: e.amountNum, date: e.date, by: e.by, status: e.status, pmApprovedBy: e.pmApprovedBy ?? null, billingApprovedBy: e.billingApprovedBy ?? null, accountsApprovedBy: e.accountsApprovedBy ?? null, sortOrder: i })) }),
  ]);
}
export async function loadScope(): Promise<ScopeDTO[]> {
  const rows = await prisma.vendorScopeEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, vendor: r.vendor, project: r.projectName, scope: r.scope, progress: r.progress, status: r.status, dueDate: r.dueDate }));
}
export async function saveScope(list: ScopeDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.vendorScopeEntry.deleteMany({}),
    prisma.vendorScopeEntry.createMany({ data: list.map((s, i) => ({ id: s.id, vendor: s.vendor, projectName: s.project, scope: s.scope, progress: s.progress, status: s.status, dueDate: s.dueDate, sortOrder: i })) }),
  ]);
}

// ── Quality ───────────────────────────────────────────────────────
export type InspectionDTO = { id: string; project: string; area: string; category: string; inspector: string; date: string; result: string; score: number; remarks: string; workType: string };
export type QualityChecklistDTO = { name: string; items: { label: string; linked: boolean }[] };
export type QualityTemplateDTO = { id: string; name: string; discipline: string; categories: QualityChecklistDTO[] };
export async function loadInspections(): Promise<InspectionDTO[]> {
  const rows = await prisma.qualityInspection.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, project: r.projectName, area: r.area, category: r.category, inspector: r.inspector, date: r.date, result: r.result, score: r.score, remarks: r.remarks ?? "", workType: r.workType ?? "" }));
}
// Work-type checklists with their sections, ordered by discipline then name.
export async function loadQualityTemplates(): Promise<QualityTemplateDTO[]> {
  const rows = await prisma.qualityChecklistTemplate.findMany({
    orderBy: { sortOrder: "asc" },
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    discipline: t.discipline,
    categories: t.categories.map((c) => ({ name: c.name, items: c.items as { label: string; linked: boolean }[] })),
  }));
}
export async function saveInspections(list: InspectionDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.qualityInspection.deleteMany({}),
    prisma.qualityInspection.createMany({ data: list.map((q, i) => ({ id: q.id, projectName: q.project, area: q.area, category: q.category, inspector: q.inspector, date: q.date, result: q.result, score: q.score, remarks: q.remarks ?? "", workType: q.workType || "", sortOrder: i })) }),
  ]);
}

// ── ERP integration ───────────────────────────────────────────────
// `hasKey` replaces the raw apiKey in the client payload — the secret stays on
// the server and is never shipped to the browser. Writes that don't include a
// new key leave the stored one untouched.
export type IntegrationDTO = { id: string; name: string; category: string; desc: string; icon: string; iconBg: string; iconColor: string; status: string; lastSync: string | null; recordsSynced: number; enabled: boolean; hasKey: boolean; endpoint: string };
export type SyncLogDTO = { id: string; integration: string; event: string; status: string; records: number; timestamp: string; duration: string };
export type FieldMapDTO = { erp_field: string; external_field: string; integration: string; type: string; direction: string };
export type WebhookDTO = { id: string; name: string; url: string; events: string[]; status: string; lastTriggered: string; successRate: number };

function erpRowToDTO(r: { id: string; name: string; category: string; description: string; icon: string; iconBg: string; iconColor: string; status: string; lastSync: string | null; recordsSynced: number; enabled: boolean; apiKey: string; endpoint: string }): IntegrationDTO {
  return { id: r.id, name: r.name, category: r.category, desc: r.description, icon: r.icon, iconBg: r.iconBg, iconColor: r.iconColor, status: r.status, lastSync: r.lastSync, recordsSynced: r.recordsSynced, enabled: r.enabled, hasKey: r.apiKey.trim().length > 0, endpoint: r.endpoint };
}

// Timestamp label matching how the UI renders sync/trigger times, e.g. "12 Jun, 10:02".
function erpNowLabel(): string {
  return new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export async function loadIntegrations(): Promise<IntegrationDTO[]> {
  const rows = await prisma.erpIntegration.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map(erpRowToDTO);
}
export async function loadSyncLogs(): Promise<SyncLogDTO[]> {
  const rows = await prisma.erpSyncLog.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, integration: r.integration, event: r.event, status: r.status, records: r.records, timestamp: r.timestamp, duration: r.duration }));
}
export async function loadFieldMappings(): Promise<FieldMapDTO[]> {
  const rows = await prisma.erpFieldMapping.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ erp_field: r.erpField, external_field: r.externalField, integration: r.integration, type: r.type, direction: r.direction }));
}
export async function loadWebhooks(): Promise<WebhookDTO[]> {
  const rows = await prisma.erpWebhook.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, name: r.name, url: r.url, events: r.events, status: r.status, lastTriggered: r.lastTriggered, successRate: r.successRate }));
}

// Flip an integration on/off. Enabling only reports "connected" when it's actually
// configured (endpoint + key present); otherwise it stays "disconnected".
export async function toggleIntegration(id: string): Promise<IntegrationDTO> {
  const cur = await prisma.erpIntegration.findUnique({ where: { id } });
  if (!cur) throw new Error("Integration not found");
  const enabled = !cur.enabled;
  const configured = cur.apiKey.trim().length > 0 && cur.endpoint.trim().length > 0;
  const status = enabled && configured ? "connected" : "disconnected";
  const row = await prisma.erpIntegration.update({ where: { id }, data: { enabled, status } });
  return erpRowToDTO(row);
}

// Persist endpoint + (optionally) a new key. A blank apiKey keeps the existing one,
// so the saved secret never has to round-trip through the client.
export async function saveIntegrationConfig(id: string, input: { endpoint: string; apiKey: string }): Promise<IntegrationDTO> {
  const cur = await prisma.erpIntegration.findUnique({ where: { id } });
  if (!cur) throw new Error("Integration not found");
  const apiKey = input.apiKey.trim() ? input.apiKey.trim() : cur.apiKey;
  const endpoint = input.endpoint.trim();
  const configured = apiKey.trim().length > 0 && endpoint.length > 0;
  const row = await prisma.erpIntegration.update({
    where: { id },
    data: { apiKey, endpoint, status: configured ? "connected" : "disconnected", enabled: configured },
  });
  return erpRowToDTO(row);
}

// Add a custom integration from the "Add integration" dialog.
export async function createIntegration(input: { name: string; category: string; endpoint: string; apiKey: string }): Promise<IntegrationDTO> {
  const max = await prisma.erpIntegration.aggregate({ _max: { sortOrder: true } });
  const configured = input.apiKey.trim().length > 0 && input.endpoint.trim().length > 0;
  const row = await prisma.erpIntegration.create({
    data: {
      id: `intg_${Date.now()}`,
      name: input.name.trim(),
      category: input.category.trim() || "Custom",
      description: "Custom integration added from the ERP Integration page.",
      icon: "extension", iconBg: "#1b1c1c", iconColor: "#ffffff",
      status: configured ? "connected" : "disconnected",
      lastSync: null, recordsSynced: 0, enabled: configured,
      apiKey: input.apiKey.trim(), endpoint: input.endpoint.trim(),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return erpRowToDTO(row);
}

// Real connection test: actually reaches the configured endpoint server-side,
// measures latency, flips the integration to connected/error, and writes a
// genuine sync-log row reflecting the true outcome.
export async function testIntegration(id: string): Promise<{ integration: IntegrationDTO; log: SyncLogDTO }> {
  const cur = await prisma.erpIntegration.findUnique({ where: { id } });
  if (!cur) throw new Error("Integration not found");

  const start = Date.now();
  let ok = false;
  let detail: string;
  if (!cur.endpoint.trim()) {
    detail = "no endpoint configured";
  } else {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(cur.endpoint, {
        method: "GET",
        headers: cur.apiKey ? { Authorization: `Bearer ${cur.apiKey}` } : {},
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      ok = res.ok;
      detail = `HTTP ${res.status}`;
    } catch (e) {
      detail = e instanceof Error ? (e.name === "AbortError" ? "timed out after 8s" : e.message) : "request failed";
    }
  }

  const durationMs = Date.now() - start;
  const ts = erpNowLabel();
  const records = ok ? 1 : 0;
  const min = await prisma.erpSyncLog.aggregate({ _min: { sortOrder: true } });
  const logData = {
    id: `L${Date.now()}`,
    integration: cur.name,
    event: ok ? `Connection test passed (${detail})` : `Connection test failed (${detail})`,
    status: ok ? "success" : "failed",
    records,
    timestamp: ts,
    duration: `${(durationMs / 1000).toFixed(1)}s`,
    sortOrder: (min._min.sortOrder ?? 0) - 1, // newest logs sort to the top
  };
  const [log, integration] = await prisma.$transaction([
    prisma.erpSyncLog.create({ data: logData }),
    prisma.erpIntegration.update({ where: { id }, data: { status: ok ? "connected" : "error", lastSync: ts, recordsSynced: cur.recordsSynced + records } }),
  ]);
  return {
    integration: erpRowToDTO(integration),
    log: { id: log.id, integration: log.integration, event: log.event, status: log.status, records: log.records, timestamp: log.timestamp, duration: log.duration },
  };
}

// ── Per-page batched loaders ──────────────────────────────────────
// Each page used to fire its loaders as separate server actions, which Next.js
// serializes (one round-trip each). These batch a page's reads into a single
// action whose queries run concurrently server-side — one round-trip per page.
export async function loadErpIntegrationPage() {
  const [integrations, logs, fieldMappings, webhooks] = await Promise.all([
    loadIntegrations(), loadSyncLogs(), loadFieldMappings(), loadWebhooks(),
  ]);
  return { integrations, logs, fieldMappings, webhooks };
}
export async function loadDlpPage() {
  const [tickets, amcSchedule] = await Promise.all([loadDlpTickets(), loadAmcSchedule()]);
  return { tickets, amcSchedule };
}
export async function loadOrdersPage() {
  const [expenses, scope] = await Promise.all([loadExpenses(), loadScope()]);
  return { expenses, scope };
}
export async function loadAuditPage() {
  const [sections, auditProjects] = await Promise.all([loadAudit(), loadAuditProjects()]);
  return { sections, auditProjects };
}
export async function loadSurveyPage() {
  const [surveys, checklist] = await Promise.all([loadSurveys(), loadSurveyChecklist()]);
  return { surveys, checklist };
}
export async function loadQualityPage() {
  const [inspections, templates] = await Promise.all([loadInspections(), loadQualityTemplates()]);
  return { inspections, templates };
}

export async function createWebhook(input: { name: string; url: string; events?: string[] }): Promise<WebhookDTO> {
  const max = await prisma.erpWebhook.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.erpWebhook.create({
    data: {
      id: `WH${Date.now()}`,
      name: input.name.trim(),
      url: input.url.trim(),
      events: input.events && input.events.length ? input.events : ["custom.event"],
      status: "active",
      lastTriggered: "Never",
      successRate: 0,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return { id: row.id, name: row.name, url: row.url, events: row.events, status: row.status, lastTriggered: row.lastTriggered, successRate: row.successRate };
}

export async function toggleWebhook(id: string): Promise<WebhookDTO> {
  const cur = await prisma.erpWebhook.findUnique({ where: { id } });
  if (!cur) throw new Error("Webhook not found");
  const status = cur.status === "active" ? "inactive" : "active";
  const row = await prisma.erpWebhook.update({ where: { id }, data: { status } });
  return { id: row.id, name: row.name, url: row.url, events: row.events, status: row.status, lastTriggered: row.lastTriggered, successRate: row.successRate };
}

// Real delivery: actually POSTs a JSON event to the webhook URL server-side,
// then updates its status, last-triggered time, and a rolling success rate.
export async function fireWebhook(id: string): Promise<{ webhook: WebhookDTO; delivered: boolean; detail: string }> {
  const cur = await prisma.erpWebhook.findUnique({ where: { id } });
  if (!cur) throw new Error("Webhook not found");

  let delivered = false;
  let detail: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(cur.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Event": cur.events[0] ?? "test.ping" },
      body: JSON.stringify({
        event: cur.events[0] ?? "test.ping",
        source: "studio-masons-erp",
        webhook: cur.name,
        timestamp: new Date().toISOString(),
        data: { test: true },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    delivered = res.ok;
    detail = `HTTP ${res.status}`;
  } catch (e) {
    detail = e instanceof Error ? (e.name === "AbortError" ? "timed out after 8s" : e.message) : "request failed";
  }

  // Rolling success rate: first-ever delivery seeds it; afterwards an EWMA so the
  // bar reacts to recent deliveries without throwing away history.
  const sample = delivered ? 100 : 0;
  const successRate = cur.lastTriggered === "Never" ? sample : Math.round(cur.successRate * 0.7 + sample * 0.3);
  const row = await prisma.erpWebhook.update({
    where: { id },
    data: { status: delivered ? "active" : "failing", lastTriggered: erpNowLabel(), successRate },
  });
  return {
    webhook: { id: row.id, name: row.name, url: row.url, events: row.events, status: row.status, lastTriggered: row.lastTriggered, successRate: row.successRate },
    delivered,
    detail,
  };
}
