"use client";
import { createContext, useContext, useState, useEffect, type ReactNode, type Dispatch, type SetStateAction } from "react";

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

export interface Invoice { id:string; vendor:string; project:string; amount:string; amountNum:number; due:string; status:InvStatus; flagged?:boolean; fileObj?:File; baseValue?:number; sgstPct?:number; cgstPct?:number; igstPct?:number; remarks?:string; amountPayable?:number; requestedAmount?:number; advanceDeducted?:number; tdsPct?:number; retentionHeld?:boolean; retentionAmount?:number; pmApprovedAt?:string; pmApprovedBy?:string; accountsApprovedBy?:string; }
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

interface ProjectContextValue {
  projects: DemoProject[];
  selectedProject: DemoProject | null;
  setSelectedProjectId: (id: string | null) => void;
  updateProjectPct: (id: string, pct: number) => void;
  // Vendor / purchase-order store
  vendorPOs: VendorPO[];
  addVendorPO: (input: { projectId: string; vendorName: string; poNumber: string; poValue: number; poFileName: string; fixedContract?: boolean; contractStart?: string; contractEnd?: string }) => void;
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
const VENDOR_PO_KEY = "erp-vendor-pos";
const INVOICES_KEY = "erp-invoices";
const REQUESTS_KEY = "erp-payment-requests";
const ACTIVITY_KEY = "erp-activity";

// Seeded activity so the feed isn't empty on first load. Timestamps are relative to
// load time so the "time ago" labels stay sensible. New entries are prepended live.
const seedAt = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString();
const initialActivities: ActivityItem[] = [
  { id: "act_seed_1", icon: "verified",      color: "#e30613", route: "/design",        text: "Design approved for",         bold: "Indiranagar Residence", by: "Arjun K.",        at: seedAt(2),  detail: "Design package v3 approved — includes updated floor plans, elevation drawings, and material finishes." },
  { id: "act_seed_2", icon: "priority_high", color: "#ba1a1a", route: "/snags",         text: "New snag raised in",          bold: "Whitefield Office",     by: "Structural Team", at: seedAt(4),  detail: "Water seepage on 2nd floor slab. Requires waterproofing inspection before next concrete pour." },
  { id: "act_seed_3", icon: "cloud_upload",  color: "#e30613", route: "/orders",        text: "Material PO issued for",      bold: "Koramangala Villa",     by: "Admin",           at: seedAt(6),  detail: "Purchase order #PO-2841 raised for cement and steel — ₹4.6L. Awaiting vendor confirmation." },
  { id: "act_seed_4", icon: "trending_up",   color: "#16a34a", route: "/site-progress", text: "Progress updated to 65% on",  bold: "Indiranagar Residence", by: "Vikram R.",       at: seedAt(28), detail: "Plastering complete on floors 1–3. Electrical first fix in progress. Next milestone: tiling." },
  { id: "act_seed_5", icon: "receipt_long",  color: "#e30613", route: "/orders",        text: "Invoice ₹1.2L submitted for", bold: "Koramangala Villa",     by: "Accounts",        at: seedAt(50), detail: "Invoice INV-0092 for tiling works submitted. Payment due in 7 days." },
  { id: "act_seed_6", icon: "check_circle",  color: "#16a34a", route: "/quality",       text: "Quality check passed for",    bold: "HSR Layout G+3",        by: "Rahul K.",        at: seedAt(72), detail: "Concrete cube test results within spec — mix design approved for remaining columns." },
];

// Seeded invoices & payment requests so the demo has data on first load.
const initialInvoices: Invoice[] = [
  { id:"SM-INV-4902", vendor:"Blackwood Stonemasons Ltd.", project:"Indiranagar Residence", amount:"₹14,250", amountNum:14250, due:"Oct 24, 2023", status:"Approval Pending", baseValue:12076, sgstPct:9, cgstPct:9, requestedAmount:0 },
  { id:"SM-INV-4899", vendor:"Imperial Steel Works",       project:"Whitefield Office",     amount:"₹8,900",  amountNum:8900,  due:"Oct 22, 2023", status:"Approved", baseValue:7542, sgstPct:9, cgstPct:9, amountPayable:8900, requestedAmount:8500 },
  { id:"SM-INV-4885", vendor:"Glass & Light Studios",      project:"Koramangala Villa",     amount:"₹11,420", amountNum:11420, due:"Oct 15, 2023", status:"Rejected", baseValue:9678, sgstPct:9, cgstPct:9, requestedAmount:0 },
  { id:"SM-INV-4872", vendor:"Oak & Grain Joinery",        project:"Indiranagar Residence", amount:"₹6,750",  amountNum:6750,  due:"Oct 12, 2023", status:"Approved", baseValue:5720, sgstPct:9, cgstPct:9, amountPayable:6750, requestedAmount:0 },
  { id:"SM-INV-4850", vendor:"Elite Electrical Solutions", project:"HSR Layout G+3",        amount:"₹4,300",  amountNum:4300,  due:"Oct 08, 2023", status:"Approved", baseValue:3644, sgstPct:9, cgstPct:9, amountPayable:4300, requestedAmount:3000 },
  { id:"SM-INV-4833", vendor:"Premier Tiling Co.",         project:"Koramangala Villa",     amount:"₹9,800",  amountNum:9800,  due:"Oct 05, 2023", status:"Approval Pending", baseValue:8305, sgstPct:9, cgstPct:9, requestedAmount:0 },
  { id:"SM-INV-4820", vendor:"Blackwood Stonemasons Ltd.", project:"HSR Layout G+3",        amount:"₹7,100",  amountNum:7100,  due:"Oct 02, 2023", status:"Approved", baseValue:6017, sgstPct:9, cgstPct:9, amountPayable:7100, requestedAmount:0 },
];
const initialRequests: PayReq[] = [
  { id:"PR-001", vendor:"Blackwood Stonemasons Ltd.", project:"Indiranagar Residence", amount:"₹8,500",  amountNum:8500,  requested:"Nov 05, 2024", status:"Pending Accounts Approval", notes:"Advance for stone cladding – phase 2 materials", invoiceRef:"SM-INV-4899", priority:"Medium" },
  { id:"PR-002", vendor:"Imperial Steel Works",       project:"Whitefield Office",     amount:"₹12,300", amountNum:12300, requested:"Nov 03, 2024", status:"Approved by Accounts", priority:"High" },
  { id:"PR-003", vendor:"Glass & Light Studios",      project:"Koramangala Villa",     amount:"₹3,200",  amountNum:3200,  requested:"Oct 29, 2024", status:"Paid", priority:"Low" },
  { id:"PR-004", vendor:"Elite Electrical Solutions", project:"HSR Layout G+3",        amount:"₹3,000",  amountNum:3000,  requested:"Oct 25, 2024", status:"Pending Accounts Approval", invoiceRef:"SM-INV-4850", priority:"Medium" },
];

// Seeded purchase orders so the demo projects already have vendors procured.
// PO values are set above the existing demo invoice totals so new uploads still fit.
const initialVendorPOs: VendorPO[] = [
  { id: "po_1", projectId: "proj_1", vendorName: "Blackwood Stonemasons Ltd.", poNumber: "PO-2841", poValue: 50000, poFileName: "PO-2841.pdf", createdAt: "2024-10-01", acceptanceFileName: "ACC-2841.pdf", advanceRequested: 8000, advanceApproved: true, advanceTdsPct: 2, advancePayable: 7840, advanceConsumed: 0 },
  { id: "po_2", projectId: "proj_1", vendorName: "Oak & Grain Joinery",        poNumber: "PO-2842", poValue: 30000, poFileName: "PO-2842.pdf", createdAt: "2024-10-02", acceptanceFileName: "ACC-2842.pdf", advanceRequested: 5000, advanceApproved: true, advanceTdsPct: 2, advancePayable: 4900, advanceConsumed: 0 },
  { id: "po_3", projectId: "proj_2", vendorName: "Imperial Steel Works",       poNumber: "PO-2843", poValue: 40000, poFileName: "PO-2843.pdf", createdAt: "2024-10-03" },
  { id: "po_4", projectId: "proj_3", vendorName: "Glass & Light Studios",      poNumber: "PO-2844", poValue: 25000, poFileName: "PO-2844.pdf", createdAt: "2024-10-04" },
  { id: "po_5", projectId: "proj_3", vendorName: "Premier Tiling Co.",         poNumber: "PO-2845", poValue: 20000, poFileName: "PO-2845.pdf", createdAt: "2024-10-05" },
  { id: "po_6", projectId: "proj_4", vendorName: "Elite Electrical Solutions", poNumber: "PO-2846", poValue: 15000, poFileName: "PO-2846.pdf", createdAt: "2024-10-06" },
  { id: "po_7", projectId: "proj_4", vendorName: "Blackwood Stonemasons Ltd.", poNumber: "PO-2847", poValue: 20000, poFileName: "PO-2847.pdf", createdAt: "2024-10-07" },
];

const initialProjectData = [
  { id: "proj_1", name: "Indiranagar Residence", clientName: "Sharma Family", location: "Bengaluru", pct: 65, engineer: "Vikram R.", isDelayed: false },
  { id: "proj_2", name: "Whitefield Office", clientName: "TechPark Solutions", location: "Bengaluru", pct: 24, engineer: "Sneha P.", isDelayed: true },
  { id: "proj_3", name: "Koramangala Villa", clientName: "Reddy Associates", location: "Bengaluru", pct: 89, engineer: "Amit S.", isDelayed: false },
  { id: "proj_4", name: "HSR Layout G+3", clientName: "Prestige Builders", location: "Bengaluru", pct: 42, engineer: "Rahul K.", isDelayed: false },
  { id: "proj_5", name: "Jayanagar Apartment", clientName: "Mehta & Sons", location: "Bengaluru", pct: 10, engineer: "Priya M.", isDelayed: false },
];

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [rawProjects, setRawProjects] = useState(initialProjectData);
  const [vendorPOs, setVendorPOs] = useState<VendorPO[]>(initialVendorPOs);
  const [invoices, setInvoices]   = useState<Invoice[]>(initialInvoices);
  const [requests, setRequests]   = useState<PayReq[]>(initialRequests);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && initialProjectData.some((p) => p.id === stored)) {
      setSelectedId(stored);
    }
    const storedPOs = localStorage.getItem(VENDOR_PO_KEY);
    if (storedPOs) {
      try {
        const parsed = JSON.parse(storedPOs) as VendorPO[];
        if (Array.isArray(parsed)) setVendorPOs(parsed);
      } catch {
        /* ignore malformed storage */
      }
    }
    const storedInvoices = localStorage.getItem(INVOICES_KEY);
    if (storedInvoices) {
      try {
        const parsed = JSON.parse(storedInvoices) as Invoice[];
        if (Array.isArray(parsed)) setInvoices(parsed);
      } catch {
        /* ignore malformed storage */
      }
    }
    const storedRequests = localStorage.getItem(REQUESTS_KEY);
    if (storedRequests) {
      try {
        const parsed = JSON.parse(storedRequests) as PayReq[];
        if (Array.isArray(parsed)) setRequests(parsed);
      } catch {
        /* ignore malformed storage */
      }
    }
    const storedActivities = localStorage.getItem(ACTIVITY_KEY);
    if (storedActivities) {
      try {
        const parsed = JSON.parse(storedActivities) as ActivityItem[];
        if (Array.isArray(parsed)) setActivities(parsed);
      } catch {
        /* ignore malformed storage */
      }
    }
    setHydrated(true);
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

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(VENDOR_PO_KEY, JSON.stringify(vendorPOs));
    } catch (err) {
      console.warn("[ProjectContext] Couldn't persist vendor purchase orders:", err);
    }
  }, [vendorPOs, hydrated]);

  // Persist invoices & payment requests. File objects can't survive JSON, so
  // only the metadata is stored — uploaded files are dropped on reload.
  useEffect(() => {
    if (!hydrated) return;
    try {
      // Drop the in-memory File — it can't be serialized (it rehydrates as {} and
      // breaks URL.createObjectURL). JSON.stringify omits undefined, so the field is
      // not written. Uploaded files are intentionally lost on reload.
      localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices.map(inv => ({ ...inv, fileObj: undefined }))));
    } catch (err) {
      console.warn("[ProjectContext] Couldn't persist invoices:", err);
    }
  }, [invoices, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      // Drop the attached File for the same reason as invoices above.
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests.map(r => ({ ...r, invoiceFile: undefined }))));
    } catch (err) {
      console.warn("[ProjectContext] Couldn't persist payment requests:", err);
    }
  }, [requests, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
    } catch (err) {
      console.warn("[ProjectContext] Couldn't persist activity feed:", err);
    }
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

  function addVendorPO(input: { projectId: string; vendorName: string; poNumber: string; poValue: number; poFileName: string; fixedContract?: boolean; contractStart?: string; contractEnd?: string }) {
    setVendorPOs(prev => {
      const existing = prev.find(
        po => po.projectId === input.projectId &&
          po.vendorName.toLowerCase() === input.vendorName.trim().toLowerCase()
      );
      // A vendor on a project carries a single PO — update it rather than duplicating.
      if (existing) {
        return prev.map(po => po.id === existing.id
          ? { ...po, poNumber: input.poNumber.trim(), poValue: input.poValue, poFileName: input.poFileName, fixedContract: input.fixedContract, contractStart: input.contractStart, contractEnd: input.contractEnd }
          : po);
      }
      const po: VendorPO = {
        id: `po_${Date.now()}`,
        projectId: input.projectId,
        vendorName: input.vendorName.trim(),
        poNumber: input.poNumber.trim(),
        poValue: input.poValue,
        poFileName: input.poFileName,
        createdAt: new Date().toISOString().slice(0, 10),
        fixedContract: input.fixedContract,
        contractStart: input.contractStart,
        contractEnd: input.contractEnd,
      };
      return [...prev, po];
    });
    const name = projects.find(p => p.id === input.projectId)?.name ?? "the project";
    logActivity({ icon: "add_business", color: "#e30613", route: "/dashboard", text: "Vendor procured for", bold: name, detail: `${input.vendorName.trim()} added to ${name} with purchase order ${input.poNumber.trim()} of ₹${input.poValue.toLocaleString("en-IN")}.` });
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
    logActivity({ icon: "savings", color: "#16a34a", route: "/orders", text: "Advance approved for", bold: input.vendorName, detail: `Advance approved for ${input.vendorName} — ₹${payable.toLocaleString("en-IN")} payable after ${input.tdsPct}% TDS.` });
  }

  // Records advance consumed against an invoice at approval time.
  function consumeAdvance(input: { projectId: string; vendorName: string; amount: number }) {
    setVendorPOs(prev => prev.map(po => {
      if (po.projectId !== input.projectId || po.vendorName.toLowerCase() !== input.vendorName.toLowerCase()) return po;
      return { ...po, advanceConsumed: (po.advanceConsumed ?? 0) + input.amount };
    }));
  }

  return (
    <ProjectContext.Provider
      value={{ projects, selectedProject, setSelectedProjectId: setSelectedId, updateProjectPct, vendorPOs, addVendorPO, acceptVendorPO, approveAdvance, consumeAdvance, getProjectVendorPOs, getVendorPO, invoices, setInvoices, requests, setRequests, activities, logActivity }}
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
