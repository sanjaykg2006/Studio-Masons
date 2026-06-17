"use client";
import { createContext, useContext, useState, useEffect, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { loadBootstrap } from "@/app/(erp)/bootstrap";
import {
  savePurchaseOrder,
  deletePurchaseOrder,
  acceptPurchaseOrder,
  approvePOAdvance,
  consumePOAdvance,
  type POLine,
} from "@/app/(erp)/purchase-orders/actions";
import {
  saveInvoices,
  savePaymentRequests,
  type InvoiceDTO,
  type PaymentRequestDTO,
} from "@/app/(erp)/orders/actions";
import {
  saveProjectPct,
  saveActivities,
  type AppProjectDTO,
  type TeamMemberDTO,
} from "@/app/(erp)/data";

export interface DemoProject {
  id: string;
  name: string;
  clientName: string;
  location: string;
  status: "In Progress" | "Delayed" | "On Track" | "New Site" | "Completed";
  pct: number;
  engineer: string;
}

// A vendor procured for a project, along with the purchase order issued to them.
export interface VendorPO {
  id: string;
  projectId: string;
  vendorName: string;
  poNumber: string;
  poValue: number;
  // Name of the uploaded purchase-order document. Required for every vendor —
  // the File bytes can't survive localStorage, so we persist the filename only.
  poFileName: string;
  createdAt: string;
  // Denormalized project name and the priced service lines (present on POs that
  // were generated from line items). The PO value is the sum of the line amounts.
  projectName?: string;
  lines?: POLine[];
  // PO-document details captured by the generator — persisted so the PO can be
  // re-opened and amended later with everything pre-filled.
  projectCode?: string | null;
  subject?: string | null;
  quotationRef?: string | null;
  quotationDate?: string | null;
  vendorAddress?: string | null;
  vendorGstin?: string | null;
  billingBranchId?: string | null;
  commencement?: string | null;
  completion?: string | null;
  paymentTerms?: string[];
  notes?: Record<string, string> | null;
  annexRemarks?: Record<string, string> | null;
  // Acceptance + advance stage — completed after the PO.
  acceptanceFileName?: string;   // uploaded acceptance document name
  advanceRequested?: number;     // advance amount the site team requests
  advanceApproved?: boolean;     // true after accounts approves the advance
  advanceTdsPct?: number;        // TDS % applied to the advance (1, 2, or 10)
  advancePayable?: number;       // advanceRequested minus TDS
  advanceConsumed?: number;      // cumulative advance consumed across invoices
  // Fixed contract period — when set, this vendor's invoices can only be filed
  // with an invoice date between these dates (inclusive). Both are ISO yyyy-mm-dd.
  fixedContract?: boolean;
  contractStart?: string;
  contractEnd?: string;
}

// ── Invoice & payment-request domain types ───────────────────────
// Invoice workflow: vendor uploads → project manager approves → accounts approves → payment request raised
export type InvStatus = "Approval Pending" | "PM Approved" | "Approved" | "Rejected";
// Payment request workflow: project team raises → accounts approves → accounts marks paid
export type ReqStatus = "Pending Accounts Approval" | "Approved by Accounts" | "Paid";

export interface InvoiceTaxLine { base:number; sgst:number; cgst:number; igst:number; }
export interface Invoice { id:string; vendor:string; project:string; amount:string; amountNum:number; due:string; status:InvStatus; flagged?:boolean; fileObj?:File; fileName?:string; baseValue?:number; sgstPct?:number; cgstPct?:number; igstPct?:number; taxLines?:InvoiceTaxLine[]; otherCharges?:number; remarks?:string; amountPayable?:number; requestedAmount?:number; advanceDeducted?:number; tdsPct?:number; retentionHeld?:boolean; retentionAmount?:number; retentionEarlyRelease?:boolean; pmApprovedAt?:string; pmApprovedBy?:string; accountsApprovedBy?:string; }
export interface PayReq  { id:string; vendor:string; project:string; amount:string; amountNum:number; requested:string; status:ReqStatus; notes?:string; invoiceFile?:File; invoiceRef?:string; priority?:"Low" | "Medium" | "High"; accountsApprovedBy?:string; paidBy?:string; }

// A single entry in the dashboard's Recent Activity feed. Generated as real actions
// happen across the app (vendors, advances, invoices, payments, progress).
export interface ActivityItem {
  id: string;
  icon: string;      // material symbol name
  color: string;     // accent color for the icon
  route: string;     // page to open when clicked
  text: string;      // lead sentence, e.g. "Invoice approved for"
  bold: string;      // entity highlighted at the end of the sentence
  detail: string;    // expanded description
  by?: string;       // actor; defaults to "You" for actions taken in-app
  at: string;        // ISO timestamp the activity happened
}

// Input accepted by logActivity — id/at/by are filled in for you.
type ActivityInput = Omit<ActivityItem, "id" | "at" | "by"> & { by?: string };

// Everything captured when generating / amending a purchase order.
export interface AddVendorPOInput {
  projectId: string;
  vendorName: string;
  poNumber: string;
  poValue: number;
  poFileName: string;
  projectCode?: string;
  subject?: string;
  quotationRef?: string;
  quotationDate?: string;
  vendorAddress?: string;
  vendorGstin?: string;
  billingBranchId?: string;
  commencement?: string;
  completion?: string;
  paymentTerms?: string[];
  notes?: Record<string, string>;
  annexRemarks?: Record<string, string>;
  fixedContract?: boolean;
  contractStart?: string;
  contractEnd?: string;
  lines?: POLine[];
}

// A team member, used to populate assignee / engineer / inspector dropdowns.
export interface TeamMember { id: string; name: string; role: string; email: string | null; phone: string | null; active: boolean }

interface ProjectContextValue {
  projects: DemoProject[];
  selectedProject: DemoProject | null;
  setSelectedProjectId: (id: string | null) => void;
  updateProjectPct: (id: string, pct: number) => void;
  // Team directory (DB-backed) — names for dropdowns across the app.
  team: TeamMember[];
  // Vendor / purchase-order store
  vendorPOs: VendorPO[];
  addVendorPO: (input: AddVendorPOInput) => void;
  removeVendorPO: (input: { projectId: string; vendorName: string }) => void;
  acceptVendorPO: (input: { projectId: string; vendorName: string; acceptanceFileName: string; advanceRequested: number }) => void;
  approveAdvance: (input: { projectId: string; vendorName: string; tdsPct: number }) => void;
  consumeAdvance: (input: { projectId: string; vendorName: string; amount: number }) => void;
  getProjectVendorPOs: (projectId: string) => VendorPO[];
  getVendorPO: (projectId: string, vendorName: string) => VendorPO | undefined;
  // Shared, persisted invoice & payment-request stores
  invoices: Invoice[];
  setInvoices: Dispatch<SetStateAction<Invoice[]>>;
  requests: PayReq[];
  setRequests: Dispatch<SetStateAction<PayReq[]>>;
  // Recent-activity feed (shared + persisted)
  activities: ActivityItem[];
  logActivity: (input: ActivityInput) => void;
}

export function getAutoStatus(pct: number, isDelayed = false): DemoProject["status"] {
  if (isDelayed) return "Delayed";
  if (pct >= 100) return "Completed";
  if (pct >= 75) return "On Track";
  if (pct > 10) return "In Progress";
  return "New Site";
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const STORAGE_KEY = "erp-selected-project";

// Invoices ↔ DB DTOs. The in-memory File can't be persisted, so only its name is
// kept; everything else maps one-to-one.
const toInvoiceDTO = (i: Invoice): InvoiceDTO => ({
  id: i.id, vendor: i.vendor, project: i.project, amount: i.amount, amountNum: i.amountNum,
  due: i.due, status: i.status, flagged: i.flagged, baseValue: i.baseValue, sgstPct: i.sgstPct,
  cgstPct: i.cgstPct, igstPct: i.igstPct, taxLines: i.taxLines, otherCharges: i.otherCharges,
  remarks: i.remarks, amountPayable: i.amountPayable,
  requestedAmount: i.requestedAmount, advanceDeducted: i.advanceDeducted, tdsPct: i.tdsPct,
  retentionHeld: i.retentionHeld, retentionAmount: i.retentionAmount,
  retentionEarlyRelease: i.retentionEarlyRelease, pmApprovedAt: i.pmApprovedAt,
  pmApprovedBy: i.pmApprovedBy, accountsApprovedBy: i.accountsApprovedBy,
  fileName: i.fileName ?? i.fileObj?.name,
});
const fromInvoiceDTO = (d: InvoiceDTO): Invoice => ({ ...d, status: d.status as InvStatus });

const toReqDTO = (r: PayReq): PaymentRequestDTO => ({
  id: r.id, vendor: r.vendor, project: r.project, amount: r.amount, amountNum: r.amountNum,
  requested: r.requested, status: r.status, notes: r.notes, invoiceRef: r.invoiceRef,
  priority: r.priority, accountsApprovedBy: r.accountsApprovedBy, paidBy: r.paidBy,
});
const fromReqDTO = (d: PaymentRequestDTO): PayReq => ({ ...d, status: d.status as ReqStatus, priority: d.priority as PayReq["priority"] });

// The DB-backed project shape used to derive the display projects.
type RawProject = AppProjectDTO;

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Everything below is the database's source of truth, loaded on mount. State
  // starts empty so nothing is hardcoded; the UI fills in once the fetch resolves.
  const [rawProjects, setRawProjects] = useState<RawProject[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [vendorPOs, setVendorPOs] = useState<VendorPO[]>([]);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [requests, setRequests]   = useState<PayReq[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Load all shared stores from the database. The selected-project id (persisted
    // in localStorage) is validated against the loaded projects. hydrated flips only
    // after everything resolves, so the save effects don't write back empty state.
    loadBootstrap()
      .then((b) => {
        setRawProjects(b.projects);
        if (stored && b.projects.some((p) => p.id === stored)) setSelectedId(stored);
        setTeam(b.team);
        setActivities(b.activities as ActivityItem[]);
        setVendorPOs(b.purchaseOrders as VendorPO[]);
        setInvoices(b.invoices.map(fromInvoiceDTO));
        setRequests(b.paymentRequests.map(fromReqDTO));
      })
      .catch((err) => console.warn("[ProjectContext] Couldn't load bootstrap data:", err))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Persistence is best-effort: storage can be full, disabled, or blocked in
    // private mode. If it fails, the app keeps working from in-memory state.
    try {
      if (selectedId) {
        localStorage.setItem(STORAGE_KEY, selectedId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn("[ProjectContext] Couldn't persist selected project:", err);
    }
  }, [selectedId, hydrated]);

  // Persist invoices & payment requests to the database (the source of truth). The
  // client holds the whole collection, so each change replaces the stored set. The
  // in-memory File is dropped — only its name is kept (see toInvoiceDTO).
  useEffect(() => {
    if (!hydrated) return;
    saveInvoices(invoices.map(toInvoiceDTO))
      .catch((err) => console.warn("[ProjectContext] Couldn't persist invoices:", err));
  }, [invoices, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    savePaymentRequests(requests.map(toReqDTO))
      .catch((err) => console.warn("[ProjectContext] Couldn't persist payment requests:", err));
  }, [requests, hydrated]);

  // The activity feed is persisted to the database (replace-all, like invoices).
  useEffect(() => {
    if (!hydrated) return;
    saveActivities(activities.map(a => ({ ...a, by: a.by ?? "You" })))
      .catch((err) => console.warn("[ProjectContext] Couldn't persist activity feed:", err));
  }, [activities, hydrated]);

  // Prepend a new activity entry. Keeps the feed bounded to the most recent 50.
  function logActivity(input: ActivityInput) {
    setActivities(prev => [
      { id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), by: "You", ...input },
      ...prev,
    ].slice(0, 50));
  }

  const projects: DemoProject[] = rawProjects.map(({ isDelayed, ...p }) => ({
    ...p,
    status: getAutoStatus(p.pct, isDelayed),
  }));

  const selectedProject = selectedId
    ? projects.find((p) => p.id === selectedId) ?? null
    : null;

  function updateProjectPct(id: string, pct: number) {
    const clamped = Math.max(0, Math.min(100, pct));
    setRawProjects(prev =>
      prev.map(p => p.id === id ? { ...p, pct: clamped } : p)
    );
    saveProjectPct(id, clamped).catch((err) => console.warn("[ProjectContext] Couldn't persist project progress:", err));
    const name = projects.find(p => p.id === id)?.name;
    if (name) {
      logActivity({ icon: "trending_up", color: "#16a34a", route: "/site-progress", text: `Progress updated to ${clamped}% on`, bold: name, detail: `Completion for ${name} was updated to ${clamped}%.` });
    }
  }

  function getProjectVendorPOs(projectId: string) {
    return vendorPOs.filter(po => po.projectId === projectId);
  }

  function getVendorPO(projectId: string, vendorName: string) {
    return vendorPOs.find(
      po => po.projectId === projectId && po.vendorName.toLowerCase() === vendorName.toLowerCase()
    );
  }

  function addVendorPO(input: AddVendorPOInput) {
    const name = projects.find(p => p.id === input.projectId)?.name ?? "the project";
    // The PO-document detail fields, shared by the optimistic update and the create.
    const details = {
      projectCode: input.projectCode,
      subject: input.subject,
      quotationRef: input.quotationRef,
      quotationDate: input.quotationDate,
      vendorAddress: input.vendorAddress,
      vendorGstin: input.vendorGstin,
      billingBranchId: input.billingBranchId,
      commencement: input.commencement,
      completion: input.completion,
      paymentTerms: input.paymentTerms,
      notes: input.notes,
      annexRemarks: input.annexRemarks,
    };
    setVendorPOs(prev => {
      const existing = prev.find(
        po => po.projectId === input.projectId &&
          po.vendorName.toLowerCase() === input.vendorName.trim().toLowerCase()
      );
      // A vendor on a project carries a single PO — update it rather than duplicating.
      if (existing) {
        return prev.map(po => po.id === existing.id
          ? { ...po, poNumber: input.poNumber.trim(), poValue: input.poValue, poFileName: input.poFileName, fixedContract: input.fixedContract, contractStart: input.contractStart, contractEnd: input.contractEnd, ...details, ...(input.lines ? { lines: input.lines } : {}) }
          : po);
      }
      const po: VendorPO = {
        id: `po_${Date.now()}`,
        projectId: input.projectId,
        projectName: name,
        vendorName: input.vendorName.trim(),
        poNumber: input.poNumber.trim(),
        poValue: input.poValue,
        poFileName: input.poFileName,
        createdAt: new Date().toISOString().slice(0, 10),
        fixedContract: input.fixedContract,
        contractStart: input.contractStart,
        contractEnd: input.contractEnd,
        lines: input.lines,
        ...details,
      };
      return [...prev, po];
    });
    // Persist to the database (the server is the source of truth). The optimistic
    // state above keeps the UI responsive; a failure is logged, not surfaced.
    savePurchaseOrder({
      projectId: input.projectId,
      projectName: name,
      vendorName: input.vendorName,
      poNumber: input.poNumber,
      poValue: input.poValue,
      poFileName: input.poFileName,
      ...details,
      fixedContract: input.fixedContract,
      contractStart: input.contractStart,
      contractEnd: input.contractEnd,
      lines: input.lines,
    }).catch((err) => console.warn("[ProjectContext] Couldn't save purchase order:", err));
    logActivity({ icon: "add_business", color: "#e30613", route: "/dashboard", text: "Vendor procured for", bold: name, detail: `${input.vendorName.trim()} added to ${name} with purchase order ${input.poNumber.trim()} of ₹${input.poValue.toLocaleString("en-IN")}.` });
  }

  // Removes a vendor's purchase order from a project (optimistic), then deletes it
  // from the database. The line items cascade away with the PO.
  function removeVendorPO(input: { projectId: string; vendorName: string }) {
    const name = projects.find(p => p.id === input.projectId)?.name ?? "the project";
    const vendor = input.vendorName.trim();
    setVendorPOs(prev => prev.filter(po =>
      !(po.projectId === input.projectId && po.vendorName.toLowerCase() === vendor.toLowerCase())
    ));
    deletePurchaseOrder({ projectId: input.projectId, vendorName: input.vendorName })
      .catch((err) => console.warn("[ProjectContext] Couldn't delete purchase order:", err));
    logActivity({ icon: "delete", color: "#ba1a1a", route: "/purchase-orders", text: "Purchase order deleted for", bold: name, detail: `Purchase order for ${vendor} was removed from ${name}.` });
  }

  // Acceptance stage — record the document and the requested advance. The advance stays
  // pending until accounts approves it (see approveAdvance).
  function acceptVendorPO(input: { projectId: string; vendorName: string; acceptanceFileName: string; advanceRequested: number }) {
    setVendorPOs(prev => prev.map(po =>
      po.projectId === input.projectId &&
      po.vendorName.toLowerCase() === input.vendorName.trim().toLowerCase()
        ? { ...po, acceptanceFileName: input.acceptanceFileName, advanceRequested: input.advanceRequested }
        : po
    ));
    acceptPurchaseOrder(input).catch((err) => console.warn("[ProjectContext] Couldn't save acceptance:", err));
    logActivity({ icon: "task", color: "#0059a8", route: "/dashboard", text: "Acceptance recorded for", bold: input.vendorName.trim(), detail: `Acceptance document filed for ${input.vendorName.trim()} with an advance of ₹${input.advanceRequested.toLocaleString("en-IN")} pending approval.` });
  }

  // Accounts approves the advance, picking a TDS % — payable = requested minus TDS.
  function approveAdvance(input: { projectId: string; vendorName: string; tdsPct: number }) {
    let payable = 0;
    setVendorPOs(prev => prev.map(po => {
      if (po.projectId !== input.projectId || po.vendorName.toLowerCase() !== input.vendorName.toLowerCase()) return po;
      const requested = po.advanceRequested ?? 0;
      const tds = requested * input.tdsPct / 100;
      payable = requested - tds;
      return { ...po, advanceApproved: true, advanceTdsPct: input.tdsPct, advancePayable: payable, advanceConsumed: po.advanceConsumed ?? 0 };
    }));
    approvePOAdvance(input).catch((err) => console.warn("[ProjectContext] Couldn't save advance approval:", err));
    logActivity({ icon: "savings", color: "#16a34a", route: "/orders", text: "Advance approved for", bold: input.vendorName, detail: `Advance approved for ${input.vendorName} — ₹${payable.toLocaleString("en-IN")} payable after ${input.tdsPct}% TDS.` });
  }

  // Records advance consumed against an invoice at approval time.
  function consumeAdvance(input: { projectId: string; vendorName: string; amount: number }) {
    setVendorPOs(prev => prev.map(po => {
      if (po.projectId !== input.projectId || po.vendorName.toLowerCase() !== input.vendorName.toLowerCase()) return po;
      return { ...po, advanceConsumed: (po.advanceConsumed ?? 0) + input.amount };
    }));
    consumePOAdvance(input).catch((err) => console.warn("[ProjectContext] Couldn't save advance consumption:", err));
  }

  return (
    <ProjectContext.Provider
      value={{ projects, selectedProject, setSelectedProjectId: setSelectedId, updateProjectPct, team, vendorPOs, addVendorPO, removeVendorPO, acceptVendorPO, approveAdvance, consumeAdvance, getProjectVendorPOs, getVendorPO, invoices, setInvoices, requests, setRequests, activities, logActivity }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside <ProjectProvider>");
  return ctx;
}
