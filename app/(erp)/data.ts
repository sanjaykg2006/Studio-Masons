"use server";
// Loaders + savers that back every page from the database. Each loader returns a
// JSON-safe, page-ready shape (style classes computed here where the UI stores them
// on the row) so pages only swap their data source — no hardcoded datasets remain.
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@/app/generated/prisma";

// ── Current user ──────────────────────────────────────────────────
// Lightweight current-user shape for client-side role gating (the real
// enforcement stays in the server actions via requireRole). Returns null when
// not authenticated / provisioned.
export type CurrentUserDTO = { id: string; name: string; role: string } | null;
export async function loadCurrentUser(): Promise<CurrentUserDTO> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.id, name: user.name, role: user.role };
}

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
export type TeamMemberDTO = { id: string; name: string; role: string; email: string | null; phone: string | null; active: boolean; team: string | null };
export async function loadTeam(): Promise<TeamMemberDTO[]> {
  // Sourced from real User accounts (what the invite flow populates) so invited &
  // registered members show up in assignee/engineer/inspector dropdowns across the app.
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, email: r.email, phone: null, active: true, team: r.team }));
}

// Sets a member's design sub-team tag (Concept | Project | Site | null). Used by
// the Settings team table so people can be slotted into the Project Tracker pickers.
export async function setMemberTeam(userId: string, team: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { team } });
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
  HIGH: "bg-error/10 text-error border-error/20",
  MEDIUM: "bg-yellow-600/10 text-yellow-600 border-yellow-600/20",
  LOW: "bg-[#666666]/10 text-[#666666] border-[#666666]/20",
};
const SNAG_STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-primary/10 text-primary border-primary/20",
  CLOSED: "bg-surface-container-highest text-[#666666] border-surface-container-highest",
};
export type SnagDTO = { id: string; project: string; title: string; category: string; priority: string; priorityStyle: string; status: string; statusStyle: string; desc: string; assignee: string; time: string; evidenceName: string | null; evidenceUrl: string | null; closed: boolean; accent: boolean };
export async function loadSnags(): Promise<SnagDTO[]> {
  const rows = await prisma.snagEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    id: r.id, project: r.projectName, title: r.title, category: r.category,
    priority: r.priority, priorityStyle: SNAG_PRIORITY_STYLE[r.priority] ?? SNAG_PRIORITY_STYLE.MEDIUM,
    status: r.status, statusStyle: SNAG_STATUS_STYLE[r.status] ?? SNAG_STATUS_STYLE.OPEN,
    desc: r.description, assignee: r.assignee, time: r.displayTime,
    evidenceName: r.evidenceName, evidenceUrl: r.evidenceUrl, closed: r.closed, accent: r.accent,
  }));
}
// Raise a new snag and persist it. The evidence image is stored as a (downscaled)
// data URL produced client-side so the photo survives reloads without object storage.
export type CreateSnagInput = { project: string; title: string; category: string; priority: string; description: string; assignee: string; evidenceName: string; evidenceUrl: string };
export async function createSnag(input: CreateSnagInput): Promise<SnagDTO> {
  const max = await prisma.snagEntry.aggregate({ _max: { sortOrder: true } });
  const id = `#SN-${Math.floor(100 + Math.random() * 900)}-${Date.now().toString().slice(-4)}`;
  const row = await prisma.snagEntry.create({
    data: {
      id,
      projectName: input.project,
      title: input.title.trim(),
      category: input.category,
      priority: input.priority,
      status: "OPEN",
      description: input.description.trim(),
      assignee: input.assignee,
      displayTime: "JUST NOW",
      evidenceName: input.evidenceName,
      evidenceUrl: input.evidenceUrl,
      accent: input.priority === "HIGH",
      closed: false,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return {
    id: row.id, project: row.projectName, title: row.title, category: row.category,
    priority: row.priority, priorityStyle: SNAG_PRIORITY_STYLE[row.priority] ?? SNAG_PRIORITY_STYLE.MEDIUM,
    status: row.status, statusStyle: SNAG_STATUS_STYLE[row.status] ?? SNAG_STATUS_STYLE.OPEN,
    desc: row.description, assignee: row.assignee, time: row.displayTime,
    evidenceName: row.evidenceName, evidenceUrl: row.evidenceUrl, closed: row.closed, accent: row.accent,
  };
}
// Resolve / reopen a snag. Closing flips the status to CLOSED and stamps a resolved
// label; reopening returns it to OPEN. Returns the updated, page-ready row.
export async function setSnagClosed(id: string, closed: boolean): Promise<SnagDTO> {
  const row = await prisma.snagEntry.update({
    where: { id },
    data: { closed, status: closed ? "CLOSED" : "OPEN", displayTime: closed ? "RESOLVED JUST NOW" : "REOPENED JUST NOW" },
  });
  return {
    id: row.id, project: row.projectName, title: row.title, category: row.category,
    priority: row.priority, priorityStyle: SNAG_PRIORITY_STYLE[row.priority] ?? SNAG_PRIORITY_STYLE.MEDIUM,
    status: row.status, statusStyle: SNAG_STATUS_STYLE[row.status] ?? SNAG_STATUS_STYLE.OPEN,
    desc: row.description, assignee: row.assignee, time: row.displayTime,
    evidenceName: row.evidenceName, evidenceUrl: row.evidenceUrl, closed: row.closed, accent: row.accent,
  };
}

// ── Snag comments (per-snag communication thread) ─────────────────
export type SnagCommentDTO = { id: string; snagId: string; author: string; text: string; at: string };
export async function loadSnagComments(snagId: string): Promise<SnagCommentDTO[]> {
  const rows = await prisma.snagComment.findMany({ where: { snagId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, snagId: r.snagId, author: r.author, text: r.text, at: r.createdAt.toISOString() }));
}
export async function addSnagComment(input: { snagId: string; author: string; text: string }): Promise<SnagCommentDTO> {
  const row = await prisma.snagComment.create({
    data: { id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, snagId: input.snagId, author: input.author, text: input.text.trim() },
  });
  return { id: row.id, snagId: row.snagId, author: row.author, text: row.text, at: row.createdAt.toISOString() };
}

// ── Design docs ───────────────────────────────────────────────────
export type DesignDocDTO = { id: string; icon: string; name: string; meta: string; by: string; date: string; status: string; feedback: string; projectName: string; stageNumber: number | null };
export async function loadDesignDocs(): Promise<DesignDocDTO[]> {
  const rows = await prisma.designDoc.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, icon: r.icon, name: r.name, meta: r.meta, by: r.by, date: r.date, status: r.status, feedback: r.feedback ?? "", projectName: r.projectName, stageNumber: r.stageNumber }));
}
export async function saveDesignDocs(list: DesignDocDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.designDoc.deleteMany({}),
    prisma.designDoc.createMany({ data: list.map((d, i) => ({ id: d.id, icon: d.icon, name: d.name, meta: d.meta, by: d.by, date: d.date, status: d.status, feedback: d.feedback ?? "", projectName: d.projectName ?? "", stageNumber: d.stageNumber ?? null, sortOrder: i })) }),
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
export type ExpenseDTO = { id: string; category: string; description: string; project: string; amount: string; amountNum: number; date: string; by: string; status: string; pmApprovedBy?: string; billingApprovedBy?: string; accountsApprovedBy?: string; fileName?: string };
export type ScopeDTO = { id: string; vendor: string; project: string; scope: string; progress: number; status: string; dueDate: string };
export async function loadExpenses(): Promise<ExpenseDTO[]> {
  const rows = await prisma.siteExpenseEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, category: r.category, description: r.description, project: r.projectName, amount: r.amount, amountNum: Number(r.amountNum), date: r.date, by: r.by, status: r.status, pmApprovedBy: r.pmApprovedBy ?? undefined, billingApprovedBy: r.billingApprovedBy ?? undefined, accountsApprovedBy: r.accountsApprovedBy ?? undefined, fileName: r.fileName ?? undefined }));
}
export async function saveExpenses(list: ExpenseDTO[]): Promise<void> {
  await prisma.$transaction([
    prisma.siteExpenseEntry.deleteMany({}),
    prisma.siteExpenseEntry.createMany({ data: list.map((e, i) => ({ id: e.id, category: e.category, description: e.description, projectName: e.project, amount: e.amount, amountNum: e.amountNum, date: e.date, by: e.by, status: e.status, pmApprovedBy: e.pmApprovedBy ?? null, billingApprovedBy: e.billingApprovedBy ?? null, accountsApprovedBy: e.accountsApprovedBy ?? null, fileName: e.fileName ?? null, sortOrder: i })) }),
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
// A filled checklist item carries the response controls (two inspection levels +
// not-applicable + remarks) alongside the template label.
export type InspectionItemDTO = { label: string; linked: boolean; answer: "" | "yes" | "no" | "na"; remarks: string };
export type InspectionResponseDTO = { name: string; items: InspectionItemDTO[] };
export type InspectionDTO = { id: string; project: string; area: string; category: string; inspector: string; date: string; result: string; score: number; remarks: string; workType: string; contractor: string; drawingNo: string; responses: InspectionResponseDTO[] };
export type QualityChecklistDTO = { name: string; items: { label: string; linked: boolean }[] };
export type QualityTemplateDTO = { id: string; name: string; discipline: string; categories: QualityChecklistDTO[] };
export async function loadInspections(): Promise<InspectionDTO[]> {
  const rows = await prisma.qualityInspection.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({ id: r.id, project: r.projectName, area: r.area, category: r.category, inspector: r.inspector, date: r.date, result: r.result, score: r.score, remarks: r.remarks ?? "", workType: r.workType ?? "", contractor: r.contractor ?? "", drawingNo: r.drawingNo ?? "", responses: (r.responses as InspectionResponseDTO[] | null) ?? [] }));
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
    prisma.qualityInspection.createMany({ data: list.map((q, i) => ({ id: q.id, projectName: q.project, area: q.area, category: q.category, inspector: q.inspector, date: q.date, result: q.result, score: q.score, remarks: q.remarks ?? "", workType: q.workType || "", contractor: q.contractor || "", drawingNo: q.drawingNo || "", responses: q.responses ?? [], sortOrder: i })) }),
  ]);
}

// ── Quality checklist template editing ────────────────────────────
export async function createQualityTemplate(input: { name: string; discipline: string }): Promise<QualityTemplateDTO> {
  const count = await prisma.qualityChecklistTemplate.count();
  const t = await prisma.qualityChecklistTemplate.create({
    data: { name: input.name, discipline: input.discipline, sortOrder: count },
  });
  return { id: t.id, name: t.name, discipline: t.discipline, categories: [] };
}
// Replace a template's name/discipline and rewrite all of its sections in place.
export async function updateQualityTemplate(tpl: QualityTemplateDTO): Promise<void> {
  await prisma.$transaction([
    prisma.qualityChecklistTemplate.update({ where: { id: tpl.id }, data: { name: tpl.name, discipline: tpl.discipline } }),
    prisma.qualityChecklistCategory.deleteMany({ where: { templateId: tpl.id } }),
    prisma.qualityChecklistCategory.createMany({
      data: tpl.categories.map((c, i) => ({ templateId: tpl.id, name: c.name, items: c.items, sortOrder: i })),
    }),
  ]);
}
export async function deleteQualityTemplate(id: string): Promise<void> {
  await prisma.qualityChecklistTemplate.delete({ where: { id } });
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

// ── Project Tracker (14-stage Design Operating System) ────────────
export type StageZone = "CONCEPT" | "PROJECT";
export type StageStatus = "NOT_STARTED" | "ON_TRACK" | "SUBMITTED" | "DELAY_RISK" | "DELAYED" | "ON_HOLD" | "DONE";
export type ProjectStageDTO = {
  stageNumber: number; activity: string; output: string; checkpoint: string;
  zone: StageZone; phase: string; autoSource: string | null; auto: boolean;
  // Approval-gate metadata (null on non-gate stages).
  gateNumber: number | null; gateCheck: string | null; gateOwner: string | null; gateOutput: string | null;
  // Dashboard columns + live status.
  status: StageStatus; ownerId: string | null; ownerName: string | null;
  plannedDate: string | null; actualDate: string | null;
  dependency: string; risk: string; nextAction: string;
  signedOffBy: string | null; notes: string; completedAt: string | null;
  // Pending status move awaiting a higher post's approval (null = none).
  pendingStatus: StageStatus | null; pendingBy: string | null; pendingById: string | null; pendingRank: number | null;
};
export type ProjectTeamDTO = {
  conceptLeadId: string | null; conceptViceLeadId: string | null;
  projectLeadId: string | null; projectViceLeadId: string | null;
  conceptHelpers: string[]; projectHelpers: string[];
  handoffAt: string | null; handoffBy: string | null;
};
export type TrackerActor = { id: string; name: string; role: string; team: string | null };
export type TrackerMsg = { ok: true; queued?: boolean } | { ok: false; error: string };
export type TeamRole = "LEAD" | "VICE";

// The 14 master stages from the Design Operating System deck. Stages 1–11 are the
// Concept zone, 12–14 the Project zone; the 4 phases and 7 approval gates come from
// Action 1. Stage 2 auto-reflects the Site Survey module.
type StageTpl = { stageNumber: number; activity: string; output: string; checkpoint: string; zone: StageZone; phase: string; autoSource: string | null; gateNumber?: number; gateCheck?: string; gateOwner?: string; gateOutput?: string };
const STAGE_TEMPLATE: StageTpl[] = [
  { stageNumber: 1,  activity: "Project brief received",            output: "Requirement summary",               checkpoint: "Internal design briefing",                                          zone: "CONCEPT", phase: "Initiation",         autoSource: null },
  { stageNumber: 2,  activity: "Site study / base drawing review",  output: "Site constraints list",             checkpoint: "Check dimensions, ceiling height, services, existing conditions",    zone: "CONCEPT", phase: "Initiation",         autoSource: "survey" },
  { stageNumber: 3,  activity: "Client requirement validation",     output: "Final requirement checklist",       checkpoint: "Confirm operational needs before planning",                          zone: "CONCEPT", phase: "Initiation",         autoSource: null, gateNumber: 1, gateCheck: "Requirement freeze + site constraint review", gateOwner: "Project Architect + Client", gateOutput: "Confirmed brief" },
  { stageNumber: 4,  activity: "Test-fit / concept layout",         output: "Layout options",                    checkpoint: "Internal review before client issue",                                zone: "CONCEPT", phase: "Design Development", autoSource: null, gateNumber: 2, gateCheck: "Layout approval before concept/render", gateOwner: "Design Head + Client", gateOutput: "Approved layout" },
  { stageNumber: 5,  activity: "MEP initial briefing",              output: "MEP feasibility notes",             checkpoint: "HVAC, electrical, plumbing, fire, server, UPS, ceiling height check", zone: "CONCEPT", phase: "Design Development", autoSource: null, gateNumber: 3, gateCheck: "MEP feasibility: ceiling height, HVAC, electrical, fire", gateOwner: "Design + MEP", gateOutput: "Feasibility notes" },
  { stageNumber: 6,  activity: "Design concept / mood board",       output: "Look & feel direction",             checkpoint: "Management / client review",                                         zone: "CONCEPT", phase: "Design Development", autoSource: null },
  { stageNumber: 7,  activity: "3D renders",                        output: "Approved design intent",            checkpoint: "Ensure ceiling, MEP, lighting, furniture logic is considered",       zone: "CONCEPT", phase: "Design Development", autoSource: "design" },
  { stageNumber: 8,  activity: "Design freeze",                     output: "Signed-off layout and look & feel", checkpoint: "No informal changes after this stage",                               zone: "CONCEPT", phase: "Approval + GFC",     autoSource: null, gateNumber: 4, gateCheck: "Look & feel / 3D approval", gateOwner: "Design + Client", gateOutput: "Design freeze" },
  { stageNumber: 9,  activity: "GFC drawing preparation",          output: "Full drawing package",              checkpoint: "Drawing QA checklist",                                               zone: "CONCEPT", phase: "Approval + GFC",     autoSource: "design" },
  { stageNumber: 10, activity: "MEP coordination review",          output: "Coordinated RCP / services",        checkpoint: "Mandatory before GFC release",                                       zone: "CONCEPT", phase: "Approval + GFC",     autoSource: null },
  { stageNumber: 11, activity: "Final GFC issue",                  output: "Drawing issue register",            checkpoint: "Revision number, date, recipients recorded",                         zone: "CONCEPT", phase: "Approval + GFC",     autoSource: "design", gateNumber: 5, gateCheck: "GFC internal QA and issue register", gateOwner: "Design Team", gateOutput: "GFC package" },
  { stageNumber: 12, activity: "DTM before execution",            output: "Site execution clarity",            checkpoint: "Design + Project + MEP + vendor alignment",                          zone: "PROJECT", phase: "Execution Control", autoSource: null, gateNumber: 6, gateCheck: "DTM before execution with project, MEP and vendors", gateOwner: "Project + Design", gateOutput: "DTM MOM" },
  { stageNumber: 13, activity: "Site support / design clarification", output: "RFIs / site notes",              checkpoint: "Only clarification, not redesign",                                   zone: "PROJECT", phase: "Execution Control", autoSource: null },
  { stageNumber: 14, activity: "Change order control",            output: "Variation tracker",                 checkpoint: "Any change after sign-off to be formally approved",                   zone: "PROJECT", phase: "Execution Control", autoSource: null, gateNumber: 7, gateCheck: "Post sign-off change approval with cost impact", gateOwner: "Project + QS + Client", gateOutput: "Change register" },
];

// Seeds/refreshes the master template (idempotent upsert of all 14 rows). Called
// lazily by the loaders so the tracker self-heals without a manual seed step.
async function ensureStageTemplate(): Promise<void> {
  await prisma.$transaction(
    STAGE_TEMPLATE.map((s, i) =>
      prisma.projectStageTemplate.upsert({
        where: { stageNumber: s.stageNumber },
        update: { activity: s.activity, output: s.output, checkpoint: s.checkpoint, zone: s.zone, phase: s.phase, autoSource: s.autoSource, gateNumber: s.gateNumber ?? null, gateCheck: s.gateCheck ?? null, gateOwner: s.gateOwner ?? null, gateOutput: s.gateOutput ?? null, sortOrder: i },
        create: { stageNumber: s.stageNumber, activity: s.activity, output: s.output, checkpoint: s.checkpoint, zone: s.zone, phase: s.phase, autoSource: s.autoSource, gateNumber: s.gateNumber ?? null, gateCheck: s.gateCheck ?? null, gateOwner: s.gateOwner ?? null, gateOutput: s.gateOutput ?? null, sortOrder: i },
      })
    )
  );
}

// Derives Stage 2's status from the project's Site Survey records (auto-reflect).
async function surveyAutoStatus(projectName: string): Promise<StageStatus> {
  if (!projectName) return "NOT_STARTED";
  const surveys = await prisma.surveyEntry.findMany({ where: { projectName } });
  if (surveys.length === 0) return "NOT_STARTED";
  const done = surveys.some((s) => /complete|approved|done|sign/i.test(s.status));
  return done ? "DONE" : "ON_TRACK";
}

// Derives a design stage's status from the design docs linked to it (stages 7/9/11):
// all approved → DONE, any changes-needed → DELAY_RISK, otherwise SUBMITTED.
function designAutoStatus(docs: { status: string; stageNumber: number | null }[], stageNumber: number): StageStatus {
  const linked = docs.filter((d) => d.stageNumber === stageNumber);
  if (linked.length === 0) return "NOT_STARTED";
  if (linked.some((d) => /change/i.test(d.status))) return "DELAY_RISK";
  if (linked.every((d) => /approved/i.test(d.status))) return "DONE";
  return "SUBMITTED";
}

const STAGE_LABEL: Record<StageStatus, string> = {
  NOT_STARTED: "Reset", ON_TRACK: "On track", SUBMITTED: "Submitted", DELAY_RISK: "Flagged at-risk", DELAYED: "Marked delayed", ON_HOLD: "Put on hold", DONE: "Completed",
};
const STATUS_NOUN: Record<StageStatus, string> = {
  NOT_STARTED: "Not started", ON_TRACK: "On track", SUBMITTED: "Submitted", DELAY_RISK: "Delay risk", DELAYED: "Delayed", ON_HOLD: "On hold", DONE: "Done",
};

async function logTrackerActivity(projectId: string, icon: string, text: string, by: string): Promise<void> {
  const project = await prisma.appProject.findUnique({ where: { id: projectId } });
  await prisma.activityEntry.create({
    data: {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      icon, color: "#e30613", route: "/project-tracker",
      text, bold: project?.name ?? "", detail: text, by, at: new Date(),
    },
  });
}

export async function loadProjectStages(projectId: string): Promise<ProjectStageDTO[]> {
  await ensureStageTemplate();
  const [tpl, rows, project, users] = await Promise.all([
    prisma.projectStageTemplate.findMany({ orderBy: { stageNumber: "asc" } }),
    prisma.projectStage.findMany({ where: { projectId } }),
    prisma.appProject.findUnique({ where: { id: projectId } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const byNum = new Map(rows.map((r) => [r.stageNumber, r]));
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const projectName = project?.name ?? "";
  const needsSurvey = tpl.some((t) => t.autoSource === "survey");
  const needsDesign = tpl.some((t) => t.autoSource === "design");
  const surveyStatus = needsSurvey ? await surveyAutoStatus(projectName) : "NOT_STARTED";
  const designDocs = needsDesign && projectName
    ? await prisma.designDoc.findMany({ where: { projectName }, select: { status: true, stageNumber: true } })
    : [];
  return tpl.map((t) => {
    const row = byNum.get(t.stageNumber);
    let status: StageStatus;
    let signedOffBy = row?.signedOffBy ?? null;
    if (t.autoSource === "survey") {
      status = surveyStatus;
      if (status === "DONE" && !signedOffBy) signedOffBy = "Auto · Site Survey";
    } else if (t.autoSource === "design") {
      status = designAutoStatus(designDocs, t.stageNumber);
      if (status === "DONE" && !signedOffBy) signedOffBy = "Auto · Design approvals";
    } else {
      status = (row?.status as StageStatus) ?? "NOT_STARTED";
    }
    return {
      stageNumber: t.stageNumber, activity: t.activity, output: t.output, checkpoint: t.checkpoint,
      zone: t.zone as StageZone, phase: t.phase, autoSource: t.autoSource, auto: !!t.autoSource,
      gateNumber: t.gateNumber, gateCheck: t.gateCheck, gateOwner: t.gateOwner, gateOutput: t.gateOutput,
      status, ownerId: row?.ownerId ?? null, ownerName: row?.ownerId ? nameById.get(row.ownerId) ?? null : null,
      plannedDate: row?.plannedDate ? row.plannedDate.toISOString() : null,
      actualDate: row?.actualDate ? row.actualDate.toISOString() : null,
      dependency: row?.dependency ?? "", risk: row?.risk ?? "", nextAction: row?.nextAction ?? "",
      signedOffBy, notes: row?.notes ?? "",
      completedAt: row?.completedAt ? row.completedAt.toISOString() : null,
      pendingStatus: (row?.pendingStatus as StageStatus | undefined) ?? null,
      pendingBy: row?.pendingBy ?? null, pendingById: row?.pendingById ?? null, pendingRank: row?.pendingRank ?? null,
    };
  });
}

export async function loadProjectTeam(projectId: string): Promise<ProjectTeamDTO> {
  const row = await prisma.projectTeam.upsert({
    where: { projectId }, update: {}, create: { projectId, conceptHelpers: [], projectHelpers: [] },
  });
  return {
    conceptLeadId: row.conceptLeadId, conceptViceLeadId: row.conceptViceLeadId,
    projectLeadId: row.projectLeadId, projectViceLeadId: row.projectViceLeadId,
    conceptHelpers: row.conceptHelpers, projectHelpers: row.projectHelpers,
    handoffAt: row.handoffAt ? row.handoffAt.toISOString() : null, handoffBy: row.handoffBy,
  };
}

export async function loadCurrentActor(): Promise<TrackerActor | null> {
  const u = await getCurrentUser();
  return u ? { id: u.id, name: u.name, role: u.role, team: u.team } : null;
}

// Single round-trip loader for the tracker page.
export async function loadTrackerPage(projectId: string) {
  const [stages, team, actor, members] = await Promise.all([
    loadProjectStages(projectId), loadProjectTeam(projectId), loadCurrentActor(), loadTeam(),
  ]);
  return { stages, team, actor, members };
}

// Authority rank for a zone: 3 = admin / project manager (top approver),
// 2 = the zone lead, 1 = the zone vice lead, 0 = helper / unrelated.
type TeamRanks = { conceptLeadId: string | null; conceptViceLeadId: string | null; projectLeadId: string | null; projectViceLeadId: string | null };
function zoneRank(actor: { id: string; role: string }, team: TeamRanks, zone: StageZone): number {
  if (actor.role === "ADMIN" || actor.role === "PROJECT_MANAGER") return 3;
  const leadId = zone === "CONCEPT" ? team.conceptLeadId : team.projectLeadId;
  const viceId = zone === "CONCEPT" ? team.conceptViceLeadId : team.projectViceLeadId;
  if (leadId && actor.id === leadId) return 2;
  if (viceId && actor.id === viceId) return 1;
  return 0;
}

function applyStatusFields(fields: Prisma.ProjectStageUncheckedUpdateInput, status: StageStatus, byName: string): void {
  const done = status === "DONE";
  fields.status = status;
  fields.signedOffBy = done ? byName : null;
  fields.completedAt = done ? new Date() : null;
  if (done) fields.actualDate = new Date();
}

// Assigns a zone's lead or vice lead. Locked once set — a major decision, so only
// an admin or project manager may assign, and an already-set holder is never replaced.
export async function assignLead(input: { projectId: string; zone: StageZone; role?: TeamRole; memberId: string }): Promise<TrackerMsg> {
  const role: TeamRole = input.role ?? "LEAD";
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated." };
  if (actor.role !== "ADMIN" && actor.role !== "PROJECT_MANAGER") return { ok: false, error: "Only admins or project managers can assign leads." };
  const team = await prisma.projectTeam.upsert({ where: { projectId: input.projectId }, update: {}, create: { projectId: input.projectId, conceptHelpers: [], projectHelpers: [] } });
  const leadId = input.zone === "CONCEPT" ? team.conceptLeadId : team.projectLeadId;
  const viceId = input.zone === "CONCEPT" ? team.conceptViceLeadId : team.projectViceLeadId;
  const current = role === "LEAD" ? leadId : viceId;
  const other = role === "LEAD" ? viceId : leadId;
  const roleLabel = role === "LEAD" ? "lead" : "vice lead";
  if (current) return { ok: false, error: `This zone already has a ${roleLabel} — it is locked once assigned.` };
  if (other && other === input.memberId) return { ok: false, error: "That person already holds the other role in this zone." };
  const member = await prisma.user.findUnique({ where: { id: input.memberId } });
  if (!member) return { ok: false, error: "Member not found." };
  const data =
    input.zone === "CONCEPT"
      ? (role === "LEAD" ? { conceptLeadId: input.memberId } : { conceptViceLeadId: input.memberId })
      : (role === "LEAD" ? { projectLeadId: input.memberId } : { projectViceLeadId: input.memberId });
  await prisma.projectTeam.update({ where: { projectId: input.projectId }, data });
  await logTrackerActivity(input.projectId, "person_add", `Assigned ${member.name} as ${input.zone === "CONCEPT" ? "Concept" : "Project"} ${roleLabel}`, actor.name);
  return { ok: true };
}

// Replaces a zone's helper list. Helpers assist the lead but cannot make the
// major decisions (advancing stages / handoff).
export async function setHelpers(input: { projectId: string; zone: StageZone; memberIds: string[] }): Promise<TrackerMsg> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated." };
  if (actor.role !== "ADMIN" && actor.role !== "PROJECT_MANAGER") return { ok: false, error: "Only admins or project managers can set helpers." };
  await prisma.projectTeam.upsert({
    where: { projectId: input.projectId },
    update: input.zone === "CONCEPT" ? { conceptHelpers: input.memberIds } : { projectHelpers: input.memberIds },
    create: { projectId: input.projectId, conceptHelpers: input.zone === "CONCEPT" ? input.memberIds : [], projectHelpers: input.zone === "PROJECT" ? input.memberIds : [] },
  });
  return { ok: true };
}

// Updates a stage's status and/or dashboard columns (owner, dates, dependency,
// risk, next action, notes). Only the zone's lead (or an admin) may do it; auto
// stages reject status changes; Project-zone stages stay locked until the handoff.
export type StagePatch = {
  status?: StageStatus; ownerId?: string | null;
  plannedDate?: string | null; actualDate?: string | null;
  dependency?: string; risk?: string; nextAction?: string; notes?: string;
};
export async function updateStage(input: { projectId: string; stageNumber: number; patch: StagePatch }): Promise<TrackerMsg> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated." };
  await ensureStageTemplate();
  const tpl = await prisma.projectStageTemplate.findUnique({ where: { stageNumber: input.stageNumber } });
  if (!tpl) return { ok: false, error: "Unknown stage." };
  const team = await prisma.projectTeam.upsert({ where: { projectId: input.projectId }, update: {}, create: { projectId: input.projectId, conceptHelpers: [], projectHelpers: [] } });
  const rank = zoneRank(actor, team, tpl.zone as StageZone);
  if (rank < 1) return { ok: false, error: `Only the ${tpl.zone === "CONCEPT" ? "Concept" : "Project"} lead, vice lead or a higher post can update this stage.` };
  if (tpl.zone === "PROJECT" && !team.handoffAt) return { ok: false, error: "Project-zone stages unlock only after the Stage 11 → 12 handoff." };

  const p = input.patch;
  if (p.status !== undefined && tpl.autoSource) return { ok: false, error: "This stage's status updates automatically from its module." };

  const existing = await prisma.projectStage.findUnique({ where: { projectId_stageNumber: { projectId: input.projectId, stageNumber: input.stageNumber } } });
  const currentStatus = (existing?.status as StageStatus | undefined) ?? "NOT_STARTED";

  // Operational columns apply immediately for any lead/vice/higher post.
  const fields: Prisma.ProjectStageUncheckedUpdateInput = {};
  if (p.ownerId !== undefined) fields.ownerId = p.ownerId;
  if (p.plannedDate !== undefined) fields.plannedDate = p.plannedDate ? new Date(p.plannedDate) : null;
  if (p.actualDate !== undefined) fields.actualDate = p.actualDate ? new Date(p.actualDate) : null;
  if (p.dependency !== undefined) fields.dependency = p.dependency;
  if (p.risk !== undefined) fields.risk = p.risk;
  if (p.nextAction !== undefined) fields.nextAction = p.nextAction;
  if (p.notes !== undefined) fields.notes = p.notes;

  // A status move is gated: PM/admin (rank 3) apply it; a lead/vice queue a request
  // that a strictly higher post must approve.
  let queued = false;
  if (p.status !== undefined && p.status !== currentStatus) {
    if (rank >= 3) {
      applyStatusFields(fields, p.status, actor.name);
      fields.pendingStatus = null; fields.pendingBy = null; fields.pendingById = null; fields.pendingRank = null; fields.pendingAt = null;
    } else {
      fields.pendingStatus = p.status; fields.pendingBy = actor.name; fields.pendingById = actor.id; fields.pendingRank = rank; fields.pendingAt = new Date();
      queued = true;
    }
  }

  await prisma.projectStage.upsert({
    where: { projectId_stageNumber: { projectId: input.projectId, stageNumber: input.stageNumber } },
    update: fields,
    create: { ...(fields as Prisma.ProjectStageUncheckedCreateInput), projectId: input.projectId, stageNumber: input.stageNumber },
  });
  if (p.status !== undefined && p.status !== currentStatus) {
    await logTrackerActivity(
      input.projectId,
      queued ? "pending_actions" : "checklist",
      queued
        ? `Requested "${STATUS_NOUN[p.status]}" on stage ${input.stageNumber} — ${tpl.activity} (awaiting approval)`
        : `${STAGE_LABEL[p.status]} stage ${input.stageNumber} — ${tpl.activity}`,
      actor.name,
    );
  }
  return { ok: true, queued };
}

// Approve a queued status move. Requires a strictly higher post than the requester.
export async function approveStageChange(input: { projectId: string; stageNumber: number }): Promise<TrackerMsg> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated." };
  const tpl = await prisma.projectStageTemplate.findUnique({ where: { stageNumber: input.stageNumber } });
  if (!tpl) return { ok: false, error: "Unknown stage." };
  const team = await prisma.projectTeam.findUnique({ where: { projectId: input.projectId } });
  const row = await prisma.projectStage.findUnique({ where: { projectId_stageNumber: { projectId: input.projectId, stageNumber: input.stageNumber } } });
  if (!row || !row.pendingStatus) return { ok: false, error: "No pending change to approve." };
  const rank = zoneRank(actor, team ?? EMPTY_RANKS, tpl.zone as StageZone);
  if (rank <= (row.pendingRank ?? 0)) return { ok: false, error: "Only a higher post than the requester can approve this change." };
  const fields: Prisma.ProjectStageUncheckedUpdateInput = {};
  applyStatusFields(fields, row.pendingStatus as StageStatus, actor.name);
  fields.pendingStatus = null; fields.pendingBy = null; fields.pendingById = null; fields.pendingRank = null; fields.pendingAt = null;
  await prisma.projectStage.update({ where: { projectId_stageNumber: { projectId: input.projectId, stageNumber: input.stageNumber } }, data: fields });
  await logTrackerActivity(input.projectId, "verified", `Approved "${STATUS_NOUN[row.pendingStatus as StageStatus]}" on stage ${input.stageNumber} — ${tpl.activity}`, actor.name);
  return { ok: true };
}

// Reject a queued status move (a higher post) or cancel your own request.
export async function rejectStageChange(input: { projectId: string; stageNumber: number }): Promise<TrackerMsg> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated." };
  const tpl = await prisma.projectStageTemplate.findUnique({ where: { stageNumber: input.stageNumber } });
  if (!tpl) return { ok: false, error: "Unknown stage." };
  const team = await prisma.projectTeam.findUnique({ where: { projectId: input.projectId } });
  const row = await prisma.projectStage.findUnique({ where: { projectId_stageNumber: { projectId: input.projectId, stageNumber: input.stageNumber } } });
  if (!row || !row.pendingStatus) return { ok: false, error: "No pending change." };
  const rank = zoneRank(actor, team ?? EMPTY_RANKS, tpl.zone as StageZone);
  const isRequester = !!row.pendingById && row.pendingById === actor.id;
  if (!isRequester && rank <= (row.pendingRank ?? 0)) return { ok: false, error: "Only the requester or a higher post can clear this request." };
  await prisma.projectStage.update({ where: { projectId_stageNumber: { projectId: input.projectId, stageNumber: input.stageNumber } }, data: { pendingStatus: null, pendingBy: null, pendingById: null, pendingRank: null, pendingAt: null } });
  await logTrackerActivity(input.projectId, "cancel", `${isRequester ? "Cancelled" : "Rejected"} the status request on stage ${input.stageNumber} — ${tpl.activity}`, actor.name);
  return { ok: true };
}

const EMPTY_RANKS: TeamRanks = { conceptLeadId: null, conceptViceLeadId: null, projectLeadId: null, projectViceLeadId: null };

// The Stage 11 → 12 gate: transfers control from the Concept team to the Project
// team. Requires Stage 11 = Done and the actor to be the Concept lead (or admin).
export async function triggerHandoff(input: { projectId: string }): Promise<TrackerMsg> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated." };
  const team = await prisma.projectTeam.upsert({ where: { projectId: input.projectId }, update: {}, create: { projectId: input.projectId, conceptHelpers: [], projectHelpers: [] } });
  if (team.handoffAt) return { ok: false, error: "Handoff already completed." };
  const isLead = team.conceptLeadId !== null && team.conceptLeadId === actor.id;
  if (!isLead && actor.role !== "ADMIN") return { ok: false, error: "Only the Concept lead can hand off to the Project team." };
  const s11 = await prisma.projectStage.findUnique({ where: { projectId_stageNumber: { projectId: input.projectId, stageNumber: 11 } } });
  if (!s11 || s11.status !== "DONE") return { ok: false, error: "Stage 11 (Final GFC issue) must be marked Done before handoff." };
  await prisma.projectTeam.update({ where: { projectId: input.projectId }, data: { handoffAt: new Date(), handoffBy: actor.name } });
  await logTrackerActivity(input.projectId, "swap_horiz", "Handed off control to the Project team", actor.name);
  return { ok: true };
}

// ── Project registers (Drawing Issue + Change/Risk) ───────────────
// Either project lead, a project manager or an admin may edit the registers.
async function guardRegisters(projectId: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated." };
  if (actor.role === "ADMIN" || actor.role === "PROJECT_MANAGER") return { ok: true, name: actor.name };
  const team = await prisma.projectTeam.findUnique({ where: { projectId } });
  if (team && [team.conceptLeadId, team.conceptViceLeadId, team.projectLeadId, team.projectViceLeadId].includes(actor.id)) return { ok: true, name: actor.name };
  return { ok: false, error: "Only a project lead, vice lead, project manager or admin can edit the registers." };
}

export type DrawingIssueDTO = { id: string; drawingNo: string; title: string; revision: string; issueDate: string; recipients: string; purpose: string | null; status: string; issuedBy: string };
export type DrawingIssueInput = { drawingNo: string; title: string; revision: string; issueDate: string; recipients: string; purpose?: string; status: string };
export async function loadDrawingIssues(projectId: string): Promise<DrawingIssueDTO[]> {
  const rows = await prisma.drawingIssue.findMany({ where: { projectId }, orderBy: { issueDate: "desc" } });
  return rows.map((r) => ({ id: r.id, drawingNo: r.drawingNo, title: r.title, revision: r.revision, issueDate: r.issueDate.toISOString(), recipients: r.recipients, purpose: r.purpose, status: r.status, issuedBy: r.issuedBy }));
}
export async function addDrawingIssue(projectId: string, input: DrawingIssueInput): Promise<TrackerMsg> {
  const guard = await guardRegisters(projectId);
  if (!guard.ok) return guard;
  await prisma.drawingIssue.create({ data: { projectId, drawingNo: input.drawingNo.trim(), title: input.title.trim(), revision: input.revision.trim() || "R0", issueDate: input.issueDate ? new Date(input.issueDate) : new Date(), recipients: input.recipients, purpose: input.purpose ?? null, status: input.status, issuedBy: guard.name } });
  await logTrackerActivity(projectId, "draft", `Issued drawing ${input.drawingNo} (${input.revision})`, guard.name);
  return { ok: true };
}
export async function updateDrawingIssue(id: string, projectId: string, input: DrawingIssueInput): Promise<TrackerMsg> {
  const guard = await guardRegisters(projectId);
  if (!guard.ok) return guard;
  await prisma.drawingIssue.update({ where: { id }, data: { drawingNo: input.drawingNo.trim(), title: input.title.trim(), revision: input.revision.trim() || "R0", issueDate: input.issueDate ? new Date(input.issueDate) : new Date(), recipients: input.recipients, purpose: input.purpose ?? null, status: input.status } });
  return { ok: true };
}
export async function deleteDrawingIssue(id: string, projectId: string): Promise<TrackerMsg> {
  const guard = await guardRegisters(projectId);
  if (!guard.ok) return guard;
  await prisma.drawingIssue.delete({ where: { id } });
  return { ok: true };
}

export type ChangeItemDTO = { id: string; title: string; description: string | null; raisedDate: string; costImpact: string; escalationRoute: string; owner: string | null; priority: string; status: string };
export type ChangeItemInput = { title: string; description?: string; raisedDate: string; costImpact: string; escalationRoute: string; owner?: string; priority: string; status: string };
export async function loadChangeItems(projectId: string): Promise<ChangeItemDTO[]> {
  const rows = await prisma.changeItem.findMany({ where: { projectId }, orderBy: { raisedDate: "desc" } });
  return rows.map((r) => ({ id: r.id, title: r.title, description: r.description, raisedDate: r.raisedDate.toISOString(), costImpact: r.costImpact, escalationRoute: r.escalationRoute, owner: r.owner, priority: r.priority, status: r.status }));
}
export async function addChangeItem(projectId: string, input: ChangeItemInput): Promise<TrackerMsg> {
  const guard = await guardRegisters(projectId);
  if (!guard.ok) return guard;
  await prisma.changeItem.create({ data: { projectId, title: input.title.trim(), description: input.description ?? null, raisedDate: input.raisedDate ? new Date(input.raisedDate) : new Date(), costImpact: input.costImpact, escalationRoute: input.escalationRoute, owner: input.owner ?? null, priority: input.priority, status: input.status } });
  await logTrackerActivity(projectId, "published_with_changes", `Logged change: ${input.title}`, guard.name);
  return { ok: true };
}
export async function updateChangeItem(id: string, projectId: string, input: ChangeItemInput): Promise<TrackerMsg> {
  const guard = await guardRegisters(projectId);
  if (!guard.ok) return guard;
  await prisma.changeItem.update({ where: { id }, data: { title: input.title.trim(), description: input.description ?? null, raisedDate: input.raisedDate ? new Date(input.raisedDate) : new Date(), costImpact: input.costImpact, escalationRoute: input.escalationRoute, owner: input.owner ?? null, priority: input.priority, status: input.status } });
  return { ok: true };
}
export async function deleteChangeItem(id: string, projectId: string): Promise<TrackerMsg> {
  const guard = await guardRegisters(projectId);
  if (!guard.ok) return guard;
  await prisma.changeItem.delete({ where: { id } });
  return { ok: true };
}
