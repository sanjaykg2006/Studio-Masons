"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useProject } from "../../../contexts/ProjectContext";

// ── Types ─────────────────────────────────────────────────────────
// Invoice workflow: vendor uploads → project team approves → payment request raised
type InvStatus   = "Approval Pending" | "Approved" | "Rejected";
// Payment request workflow: project team raises → accounts approves → accounts marks paid
type ReqStatus   = "Pending Accounts Approval" | "Approved by Accounts" | "Paid";
type ScopeStatus = "Not Started" | "In Progress" | "Completed" | "Delayed";

interface Invoice { id:string; vendor:string; project:string; amount:string; amountNum:number; due:string; status:InvStatus; flagged?:boolean; fileObj?:File; }
interface PayReq  { id:string; vendor:string; project:string; amount:string; amountNum:number; requested:string; status:ReqStatus; notes?:string; invoiceFile?:File; invoiceRef?:string; }
interface Expense { id:string; category:string; description:string; project:string; amount:string; amountNum:number; date:string; by:string; }
interface VScope  { id:string; vendor:string; project:string; scope:string; progress:number; status:ScopeStatus; dueDate:string; }

// ── Status styles ─────────────────────────────────────────────────
const INV_STYLE: Record<InvStatus, React.CSSProperties> = {
  "Approval Pending": { background:"rgba(202,138,4,0.08)",  color:"#a16207", borderColor:"rgba(202,138,4,0.25)" },
  "Approved":         { background:"rgba(34,197,94,0.08)",  color:"#16a34a", borderColor:"rgba(34,197,94,0.25)" },
  "Rejected":         { background:"rgba(186,26,26,0.08)",  color:"#ba1a1a", borderColor:"rgba(186,26,26,0.25)" },
};
const REQ_STYLE: Record<ReqStatus, React.CSSProperties> = {
  "Pending Accounts Approval": { background:"rgba(202,138,4,0.08)",  color:"#a16207", borderColor:"rgba(202,138,4,0.25)" },
  "Approved by Accounts":      { background:"rgba(34,197,94,0.08)",  color:"#16a34a", borderColor:"rgba(34,197,94,0.25)" },
  "Paid":                      { background:"rgba(0,89,168,0.08)",   color:"#0059a8", borderColor:"rgba(0,89,168,0.25)" },
};
const SCOPE_STYLE: Record<ScopeStatus, React.CSSProperties> = {
  "Not Started": { background:"#f8f8f8",                    color:"#666666", borderColor:"#e4e2e1" },
  "In Progress": { background:"rgba(227,6,19,0.08)",        color:"#e30613", borderColor:"rgba(227,6,19,0.2)" },
  Completed:     { background:"rgba(34,197,94,0.08)",       color:"#16a34a", borderColor:"rgba(34,197,94,0.2)" },
  Delayed:       { background:"rgba(186,26,26,0.08)",       color:"#ba1a1a", borderColor:"rgba(186,26,26,0.2)" },
};

// ── Initial data ──────────────────────────────────────────────────
const initInvoices: Invoice[] = [
  { id:"SM-INV-4902", vendor:"Blackwood Stonemasons Ltd.", project:"Indiranagar Residence", amount:"₹14,250", amountNum:14250, due:"Oct 24, 2023", status:"Approval Pending" },
  { id:"SM-INV-4899", vendor:"Imperial Steel Works",       project:"Whitefield Office",     amount:"₹8,900",  amountNum:8900,  due:"Oct 22, 2023", status:"Approved" },
  { id:"SM-INV-4885", vendor:"Glass & Light Studios",      project:"Koramangala Villa",     amount:"₹11,420", amountNum:11420, due:"Oct 15, 2023", status:"Rejected" },
  { id:"SM-INV-4872", vendor:"Oak & Grain Joinery",        project:"Indiranagar Residence", amount:"₹6,750",  amountNum:6750,  due:"Oct 12, 2023", status:"Approved" },
  { id:"SM-INV-4850", vendor:"Elite Electrical Solutions", project:"HSR Layout G+3",        amount:"₹4,300",  amountNum:4300,  due:"Oct 08, 2023", status:"Approved" },
  { id:"SM-INV-4833", vendor:"Premier Tiling Co.",         project:"Koramangala Villa",     amount:"₹9,800",  amountNum:9800,  due:"Oct 05, 2023", status:"Approval Pending" },
  { id:"SM-INV-4820", vendor:"Blackwood Stonemasons Ltd.", project:"HSR Layout G+3",        amount:"₹7,100",  amountNum:7100,  due:"Oct 02, 2023", status:"Approved" },
];
const initRequests: PayReq[] = [
  { id:"PR-001", vendor:"Blackwood Stonemasons Ltd.", project:"Indiranagar Residence", amount:"₹8,500",  amountNum:8500,  requested:"Nov 05, 2024", status:"Pending Accounts Approval", notes:"Advance for stone cladding – phase 2 materials", invoiceRef:"SM-INV-4899" },
  { id:"PR-002", vendor:"Imperial Steel Works",       project:"Whitefield Office",     amount:"₹12,300", amountNum:12300, requested:"Nov 03, 2024", status:"Approved by Accounts" },
  { id:"PR-003", vendor:"Glass & Light Studios",      project:"Koramangala Villa",     amount:"₹3,200",  amountNum:3200,  requested:"Oct 29, 2024", status:"Paid" },
  { id:"PR-004", vendor:"Elite Electrical Solutions", project:"HSR Layout G+3",        amount:"₹5,600",  amountNum:5600,  requested:"Oct 25, 2024", status:"Pending Accounts Approval", invoiceRef:"SM-INV-4850" },
];
const initExpenses: Expense[] = [
  { id:"EXP-001", category:"Materials",      description:"Cement bags – 120 units",         project:"Indiranagar Residence", amount:"₹6,000",  amountNum:6000,  date:"Nov 08, 2024", by:"Vikram R." },
  { id:"EXP-002", category:"Labor",          description:"Daily labor – 12 workers × 3 days",project:"Whitefield Office",    amount:"₹7,200",  amountNum:7200,  date:"Nov 07, 2024", by:"Sneha P." },
  { id:"EXP-003", category:"Equipment",      description:"Scaffolding rental – 2 weeks",    project:"Koramangala Villa",     amount:"₹4,500",  amountNum:4500,  date:"Nov 06, 2024", by:"Amit S." },
  { id:"EXP-004", category:"Miscellaneous",  description:"Site permits and fees",            project:"HSR Layout G+3",        amount:"₹1,800",  amountNum:1800,  date:"Nov 05, 2024", by:"Rahul K." },
  { id:"EXP-005", category:"Materials",      description:"Reinforcement bars – 5 MT",       project:"Indiranagar Residence", amount:"₹18,500", amountNum:18500, date:"Nov 04, 2024", by:"Vikram R." },
];
const initScope: VScope[] = [
  { id:"VS-001", vendor:"Blackwood Stonemasons Ltd.", project:"Indiranagar Residence", scope:"Stone cladding – main facade (Ground + 2 floors)", progress:65, status:"In Progress",  dueDate:"Dec 15, 2024" },
  { id:"VS-002", vendor:"Imperial Steel Works",       project:"Whitefield Office",     scope:"Structural steel frame – Floors 3 to 7",           progress:30, status:"In Progress",  dueDate:"Jan 10, 2025" },
  { id:"VS-003", vendor:"Glass & Light Studios",      project:"Koramangala Villa",     scope:"Custom glazing – all openings incl. skylight",      progress:0,  status:"Not Started",  dueDate:"Feb 05, 2025" },
  { id:"VS-004", vendor:"Oak & Grain Joinery",        project:"Indiranagar Residence", scope:"Joinery and millwork – kitchens and wardrobes",     progress:100,status:"Completed",    dueDate:"Oct 30, 2024" },
  { id:"VS-005", vendor:"Elite Electrical Solutions", project:"HSR Layout G+3",        scope:"Electrical first fix – all floors",                 progress:20, status:"Delayed",      dueDate:"Nov 30, 2024" },
];

const TABS = ["Vendor Invoices", "Vendor Payment Requests", "Site Expense Tracking", "Vendor Scope & Progress"];
const PAGE_SIZE = 5;

function badge(label: string, style: React.CSSProperties) {
  return (
    <span style={{ padding:"2px 10px", borderRadius:"999px", fontSize:"10px", fontWeight:"bold", border:"1px solid", whiteSpace:"nowrap", ...style }}>
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function OrdersPage() {
  const { selectedProject, getProjectVendorPOs, getVendorPO } = useProject();

  const [activeTab, setActiveTab] = useState(0);
  const [invoices, setInvoices]   = useState<Invoice[]>(initInvoices);
  const [requests, setRequests]   = useState<PayReq[]>(initRequests);
  const [expenses, setExpenses]   = useState<Expense[]>(initExpenses);
  const [scope, setScope]         = useState<VScope[]>(initScope);

  // Slide-over
  const [slideInvId, setSlideInvId] = useState<string | null>(null);
  const slideInv = slideInvId ? invoices.find(x => x.id === slideInvId) ?? null : null;
  // Preview URL for invoice file
  const [invPreviewUrl, setInvPreviewUrl] = useState<string | null>(null);

  // Vendor payment request invoice file preview
  const [viewReqInvoice, setViewReqInvoice] = useState<PayReq | null>(null);
  const [reqPreviewUrl, setReqPreviewUrl]   = useState<string | null>(null);

  // Vendor scope progress editing
  const [editingProgress, setEditingProgress] = useState<string | null>(null);
  const [progressInput, setProgressInput]     = useState("0");

  // Pagination per tab
  const [pages, setPages]         = useState([0, 0, 0, 0]);
  function setPage(tab: number, p: number) { setPages(prev => prev.map((v, i) => i === tab ? p : v)); }

  // Filters
  const [searchId, setSearchId]           = useState("");
  const [filterVendor, setFilterVendor]   = useState("All");
  const [filterDate, setFilterDate]       = useState("Last 30 Days");
  const [showVendorDrop, setShowVendorDrop] = useState(false);
  const [showDateDrop, setShowDateDrop]   = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);
  const dateRef   = useRef<HTMLDivElement>(null);

  // New request - payment request file
  const prFileRef = useRef<HTMLInputElement>(null);
  const [prFile, setPrFile] = useState<File | null>(null);

  // More-vert row menus
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // New Request modal
  const [showNew, setShowNew]       = useState(false);
  const [newForm, setNewForm]       = useState<Record<string, string>>({});
  const [newInvFile, setNewInvFile] = useState<File | null>(null);
  const newInvFileRef               = useRef<HTMLInputElement>(null);
  const [mounted, setMounted]       = useState(false);
  // Invoice upload validation (PO existence + cumulative cap)
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    function md(e: MouseEvent) {
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) setShowVendorDrop(false);
      if (dateRef.current   && !dateRef.current.contains(e.target as Node))   setShowDateDrop(false);
      if (menuRef.current   && !menuRef.current.contains(e.target as Node))   setOpenMenu(null);
    }
    document.addEventListener("mousedown", md);
    return () => document.removeEventListener("mousedown", md);
  }, []);

  // Blob URL for invoice file in slide-over
  useEffect(() => {
    if (slideInv?.fileObj) {
      const url = URL.createObjectURL(slideInv.fileObj);
      setInvPreviewUrl(url);
      return () => { URL.revokeObjectURL(url); setInvPreviewUrl(null); };
    }
    setInvPreviewUrl(null);
  }, [slideInvId]);

  // Blob URL for payment request invoice file
  useEffect(() => {
    if (viewReqInvoice?.invoiceFile) {
      const url = URL.createObjectURL(viewReqInvoice.invoiceFile);
      setReqPreviewUrl(url);
      return () => { URL.revokeObjectURL(url); setReqPreviewUrl(null); };
    }
    setReqPreviewUrl(null);
  }, [viewReqInvoice]);

  // ── Filtered data ──────────────────────────────────────────────
  const proj = selectedProject?.name;
  const filtInvoices = invoices
    .filter(x => !proj || x.project === proj)
    .filter(x => filterVendor === "All" || x.vendor === filterVendor)
    .filter(x => !searchId || x.id.toLowerCase().includes(searchId.toLowerCase()));
  const filtRequests = requests.filter(x => !proj || x.project === proj);
  const filtExpenses = expenses.filter(x => !proj || x.project === proj);
  const filtScope    = scope.filter(x => !proj || x.project === proj);

  const allVendors = Array.from(new Set(invoices.map(i => i.vendor)));

  function paginate<T>(arr: T[], tab: number) {
    const p = pages[tab];
    return { slice: arr.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE), total: arr.length, pages: Math.ceil(arr.length / PAGE_SIZE), p };
  }

  // ── Actions ────────────────────────────────────────────────────
  function approveInvoice(id: string) {
    setInvoices(prev => prev.map(x => x.id === id ? { ...x, status: "Approved" } : x));
    setOpenMenu(null);
  }
  function rejectInvoice(id: string) {
    setInvoices(prev => prev.map(x => x.id === id ? { ...x, status: "Rejected" } : x));
    setOpenMenu(null);
  }
  function flagInvoice(id: string) {
    setInvoices(prev => prev.map(x => x.id === id ? { ...x, flagged: !x.flagged } : x));
  }
  function deleteInv(id: string) {
    setInvoices(prev => prev.filter(x => x.id !== id));
    setOpenMenu(null);
    if (slideInvId === id) setSlideInvId(null);
  }
  // Payment request accounts actions
  function approveReqByAccounts(id: string) {
    setRequests(prev => prev.map(x => x.id === id ? { ...x, status: "Approved by Accounts" } : x));
  }
  function markReqPaid(id: string) {
    setRequests(prev => prev.map(x => x.id === id ? { ...x, status: "Paid" } : x));
  }
  function raiseFromInvoice(inv: Invoice) {
    // Only allowed when project team has approved the invoice
    if (inv.status !== "Approved") return;
    setActiveTab(1);
    setNewForm({
      vendor:     inv.vendor,
      project:    inv.project,
      amount:     String(inv.amountNum),
      notes:      `Payment request for invoice ${inv.id}`,
      invoiceRef: inv.id,
    });
    // Copy the invoice file so accounts can review it
    if (inv.fileObj) setPrFile(inv.fileObj);
    setShowNew(true);
    setOpenMenu(null);
    setSlideInvId(null);
  }

  function updateScopeProgress(id: string, pct: number) {
    const clamped = Math.min(100, Math.max(0, pct));
    const status: ScopeStatus = clamped >= 100 ? "Completed" : clamped === 0 ? "Not Started" : "In Progress";
    setScope(prev => prev.map(x => x.id === id ? { ...x, progress: clamped, status } : x));
    setEditingProgress(null);
  }
  function deleteExpense(id: string) {
    setExpenses(prev => prev.filter(x => x.id !== id));
    setOpenMenu(null);
  }

  function exportCsv() {
    const headers = ["Invoice ID","Vendor","Project","Amount","Due Date","Status"];
    const rows = filtInvoices.map(x => [x.id, x.vendor, x.project, x.amount, x.due, x.status]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "invoices.csv";
    a.click();
  }

  // Cumulative invoiced amount for a vendor on a project (rejected invoices don't consume the PO).
  function vendorInvoiceTotal(vendorName: string, projectName: string) {
    return invoices
      .filter(i => i.project === projectName && i.vendor === vendorName && i.status !== "Rejected")
      .reduce((s, i) => s + i.amountNum, 0);
  }

  function submitNew() {
    if (activeTab === 0) {
      if (!newInvFile) return; // invoice file is required
      const vendorName  = (newForm.vendor || "").trim();
      const projectName = proj || newForm.project || "General";

      // Gate 1 — a purchase order must exist for this vendor on this project.
      const po = selectedProject ? getVendorPO(selectedProject.id, vendorName) : undefined;
      if (!vendorName || !po) {
        setUploadError("No purchase order exists for this vendor. Add the vendor and PO on the dashboard before uploading an invoice.");
        return;
      }

      // Gate 2 — the invoice amount is needed to enforce the PO cap.
      const amt = parseFloat(newForm.amount || "0");
      if (!amt || amt <= 0) {
        setUploadError("Enter the invoice amount so it can be checked against the purchase order.");
        return;
      }

      // Gate 3 — cumulative invoices must stay within the purchase order value.
      const already = vendorInvoiceTotal(vendorName, projectName);
      if (already + amt > po.poValue) {
        const remaining = po.poValue - already;
        setUploadError(
          `Invoice rejected — it would push total invoices for ${vendorName} to ₹${(already + amt).toLocaleString("en-IN")}, ` +
          `over the purchase order of ₹${po.poValue.toLocaleString("en-IN")} (₹${already.toLocaleString("en-IN")} already invoiced, ` +
          `₹${Math.max(0, remaining).toLocaleString("en-IN")} remaining).`
        );
        return;
      }

      const n: Invoice = {
        id: `SM-INV-${Date.now().toString().slice(-4)}`,
        vendor: vendorName,
        project: projectName,
        amount: `₹${amt.toLocaleString("en-IN")}`,
        amountNum: amt,
        due: newForm.due || "TBD",
        status: "Approval Pending",
        fileObj: newInvFile,
      };
      setInvoices(prev => [n, ...prev]);
      setNewInvFile(null);
      setUploadError(null);
    } else if (activeTab === 1) {
      const n: PayReq = {
        id: `PR-${String(requests.length + 1).padStart(3, "0")}`,
        vendor: newForm.vendor || "Unknown Vendor",
        project: newForm.project || proj || "General",
        amount: `₹${newForm.amount || "0"}`,
        amountNum: parseFloat(newForm.amount || "0"),
        requested: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }),
        status: "Pending Accounts Approval",
        notes: newForm.notes,
        invoiceFile: prFile ?? undefined,
        invoiceRef: newForm.invoiceRef || undefined,
      };
      setRequests(prev => [n, ...prev]);
      setPrFile(null);
    } else if (activeTab === 2) {
      const n: Expense = {
        id: `EXP-${String(expenses.length + 1).padStart(3, "0")}`,
        category: newForm.category || "Miscellaneous",
        description: newForm.description || "—",
        project: newForm.project || proj || "General",
        amount: `₹${newForm.amount || "0"}`,
        amountNum: parseFloat(newForm.amount || "0"),
        date: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }),
        by: "You",
      };
      setExpenses(prev => [n, ...prev]);
    } else {
      const n: VScope = {
        id: `VS-${String(scope.length + 1).padStart(3, "0")}`,
        vendor: newForm.vendor || "Unknown Vendor",
        project: newForm.project || proj || "General",
        scope: newForm.scope || "—",
        progress: 0,
        status: "Not Started",
        dueDate: newForm.dueDate || "TBD",
      };
      setScope(prev => [n, ...prev]);
    }
    setNewForm({});
    setShowNew(false);
  }

  const f = (k: string) => newForm[k] ?? "";
  const sf = (k: string, v: string) => setNewForm(prev => ({ ...prev, [k]: v }));

  // ── Pagination controls ─────────────────────────────────────────
  function PagBar({ total, tab }: { total: number; tab: number }) {
    const p = pages[tab];
    const tp = Math.ceil(total / PAGE_SIZE);
    if (tp <= 1) return null;
    return (
      <div style={{ padding:"12px 24px", background:"#f8f8f8", borderTop:"1px solid #e4e2e1", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#666666" }}>
          Showing {total === 0 ? 0 : p * PAGE_SIZE + 1}–{Math.min((p + 1) * PAGE_SIZE, total)} of {total}
        </p>
        <div style={{ display:"flex", gap:"6px" }}>
          <button onClick={() => setPage(tab, Math.max(0, p - 1))} disabled={p === 0}
            style={{ padding:"6px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", cursor: p === 0 ? "not-allowed":"pointer", opacity: p === 0 ? 0.3:1, display:"flex" }}>
            <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>chevron_left</span>
          </button>
          {Array.from({ length: tp }, (_, i) => (
            <button key={i} onClick={() => setPage(tab, i)}
              style={{ width:"32px", height:"32px", borderRadius:"6px", fontWeight:"bold", fontSize:"13px", cursor:"pointer", background: i === p ? "#e30613":"white", color: i === p ? "white":"#333333", border: i === p ? "none":"1px solid #e4e2e1" }}>
              {i + 1}
            </button>
          ))}
          <button onClick={() => setPage(tab, Math.min(tp - 1, p + 1))} disabled={p >= tp - 1}
            style={{ padding:"6px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", cursor: p >= tp-1 ? "not-allowed":"pointer", opacity: p >= tp-1 ? 0.3:1, display:"flex" }}>
            <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>chevron_right</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────
  function EmptyRow({ label }: { label: string }) {
    return (
      <div style={{ padding:"64px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:"12px", color:"#999999" }}>
        <span className="material-symbols-outlined" style={{ fontSize:"40px" }}>inbox</span>
        <p style={{ fontSize:"14px" }}>No {label} found{proj ? ` for ${proj}` : ""}</p>
      </div>
    );
  }

  // ── No project state (global) ───────────────────────────────────
  if (!selectedProject) {
    return (
      <div>
        <nav className="flex items-center gap-2 mb-8 text-[#666666] text-[10px] font-bold uppercase tracking-wider">
          <span>Dashboard</span>
          <span className="material-symbols-outlined" style={{ fontSize:"12px" }}>chevron_right</span>
          <span className="text-[#e30613]">Orders & Expense</span>
        </nav>
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">Financial Oversight</h2>
        <p style={{ fontSize:"16px", color:"#666666", marginBottom:"40px", maxWidth:"520px", lineHeight:1.6 }}>
          Centralized management of procurement, vendor obligations, and real-time site expenditure tracking.
        </p>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"96px 24px", textAlign:"center" }}>
          <div style={{ width:"80px", height:"80px", borderRadius:"50%", background:"#f8f8f8", border:"1px solid #e4e2e1", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"24px" }}>
            <span className="material-symbols-outlined" style={{ fontSize:"40px", color:"#e4e2e1" }}>receipt_long</span>
          </div>
          <h3 style={{ fontSize:"20px", fontWeight:"bold", color:"#333333", marginBottom:"8px" }}>No Project Selected</h3>
          <p style={{ fontSize:"16px", color:"#666666", maxWidth:"420px", lineHeight:1.6 }}>
            Use the <span style={{ fontWeight:"bold", color:"#e30613" }}>Project Selector</span> in the top bar to view orders and expenses for a specific project.
          </p>
        </div>
      </div>
    );
  }

  // ── Main page ──────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-6 text-[#666666] text-[10px] font-bold uppercase tracking-wider">
        <span>Dashboard</span>
        <span className="material-symbols-outlined" style={{ fontSize:"12px" }}>chevron_right</span>
        <span className="text-[#e30613]">Orders & Expense</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start mb-8 gap-4">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Financial Oversight</h2>
          <p style={{ fontSize:"16px", color:"#666666", maxWidth:"480px", lineHeight:1.6 }}>
            Procurement and expenses for <strong style={{ color:"#333333" }}>{selectedProject.name}</strong>
            <span style={{ color:"#e4e2e1", margin:"0 8px" }}>•</span>
            <span style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#e30613" }}>{selectedProject.status}</span>
          </p>
        </div>
        <div style={{ display:"flex", gap:"12px", flexShrink:0 }}>
          <button onClick={exportCsv}
            style={{ padding:"10px 20px", border:"1px solid #e4e2e1", borderRadius:"8px", background:"white", color:"#333333", fontSize:"13px", fontWeight:"bold", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}
            onMouseEnter={e => { e.currentTarget.style.background="#f8f8f8"; }}
            onMouseLeave={e => { e.currentTarget.style.background="white"; }}>
            <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>download</span>
            Export CSV
          </button>
          {/* Hide New Request on Tab 1 — payment requests come from invoices only */}
          {activeTab !== 1 && <button onClick={() => { setNewForm({}); setNewInvFile(null); setUploadError(null); setShowNew(true); }}
            style={{ padding:"10px 20px", border:"none", borderRadius:"8px", background:"#e30613", color:"white", fontSize:"13px", fontWeight:"bold", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}
            onMouseEnter={e => { e.currentTarget.style.opacity="0.88"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity="1"; }}>
            <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>add</span>
            New Request
          </button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0", borderBottom:"2px solid #e4e2e1", marginBottom:"24px", overflowX:"auto" }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding:"12px 20px", border:"none", background:"none", cursor:"pointer", fontSize:"13px", fontWeight:"bold", color: activeTab===i ? "#e30613":"#666666", borderBottom: activeTab===i ? "2px solid #e30613":"2px solid transparent", marginBottom:"-2px", whiteSpace:"nowrap", transition:"all 0.15s" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Filters (Tab 0 only) */}
      {activeTab === 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"12px", marginBottom:"20px" }}>
          {/* Date Range */}
          <div ref={dateRef} style={{ position:"relative" }}>
            <div onClick={() => setShowDateDrop(v => !v)}
              style={{ background:"white", border:`1px solid ${showDateDrop ? "#e30613":"#e4e2e1"}`, padding:"10px 14px", borderRadius:"8px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#999999", marginBottom:"2px" }}>Date Range</p>
                <p style={{ fontSize:"13px", color:"#333333", fontWeight:"500" }}>{filterDate}</p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#666666" }}>calendar_today</span>
            </div>
            {showDateDrop && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:"4px", background:"white", border:"1px solid #e4e2e1", borderRadius:"8px", boxShadow:"0 8px 24px rgba(0,0,0,0.1)", zIndex:60, overflow:"hidden" }}>
                {["Last 7 Days","Last 30 Days","Last 90 Days","All Time"].map(d => (
                  <button key={d} onClick={() => { setFilterDate(d); setShowDateDrop(false); }}
                    style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color: filterDate===d?"#e30613":"#333333", background: filterDate===d?"rgba(227,6,19,0.05)":"white", border:"none", cursor:"pointer", fontWeight: filterDate===d?"bold":"normal" }}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Vendor */}
          <div ref={vendorRef} style={{ position:"relative" }}>
            <div onClick={() => setShowVendorDrop(v => !v)}
              style={{ background:"white", border:`1px solid ${showVendorDrop ? "#e30613":"#e4e2e1"}`, padding:"10px 14px", borderRadius:"8px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#999999", marginBottom:"2px" }}>Vendor</p>
                <p style={{ fontSize:"13px", color:"#333333", fontWeight:"500", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{filterVendor}</p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#666666", flexShrink:0, marginLeft:"4px" }}>filter_list</span>
            </div>
            {showVendorDrop && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:"4px", background:"white", border:"1px solid #e4e2e1", borderRadius:"8px", boxShadow:"0 8px 24px rgba(0,0,0,0.1)", zIndex:60, overflow:"hidden" }}>
                {["All", ...allVendors].map(v => (
                  <button key={v} onClick={() => { setFilterVendor(v); setShowVendorDrop(false); }}
                    style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"12px", color: filterVendor===v?"#e30613":"#333333", background: filterVendor===v?"rgba(227,6,19,0.05)":"white", border:"none", cursor:"pointer", fontWeight: filterVendor===v?"bold":"normal", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Project (read-only, synced) */}
          <div style={{ background:"rgba(227,6,19,0.04)", border:"1px solid rgba(227,6,19,0.2)", padding:"10px 14px", borderRadius:"8px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#999999", marginBottom:"2px" }}>Project</p>
              <p style={{ fontSize:"13px", color:"#e30613", fontWeight:"600", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{selectedProject.name}</p>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#e30613", flexShrink:0 }}>apartment</span>
          </div>
          {/* Search */}
          <div style={{ background:"white", border:"1px solid #e4e2e1", padding:"10px 14px", borderRadius:"8px", display:"flex", alignItems:"center", gap:"8px" }}>
            <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#999999", flexShrink:0 }}>search</span>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#999999", marginBottom:"2px" }}>Search ID</p>
              <input value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="SM-INV-..." style={{ width:"100%", border:"none", outline:"none", fontSize:"13px", color:"#333333", background:"transparent" }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 0: Vendor Invoices ───────────────────────────────── */}
      {activeTab === 0 && (() => {
        const { slice, total } = paginate(filtInvoices, 0);
        return (
          <div style={{ border:"1px solid #e4e2e1", borderRadius:"12px", overflow:"visible", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
            {total === 0 ? <EmptyRow label="invoices" /> : (
              <>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#f8f8f8", borderBottom:"1px solid #e4e2e1" }}>
                      {["Invoice ID","Vendor","Project","Amount","PO Utilization","Due Date","Status","Actions"].map((h,i) => (
                        <th key={h} style={{ padding:"14px 20px", fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#666666", textAlign: i===3?"right":"left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((inv, rowIdx) => (
                      <tr key={inv.id} onClick={() => setSlideInvId(inv.id)} style={{ borderBottom:"1px solid #f0f0f0", cursor:"pointer", background:"white" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background="#f8f8f8"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background="white"; }}>
                        <td style={{ padding:"14px 20px", fontSize:"13px", fontWeight:"bold", color:"#e30613" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                            {inv.flagged && <span className="material-symbols-outlined" style={{ fontSize:"14px", color:"#e30613" }}>flag</span>}
                            {inv.id}
                          </div>
                        </td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#333333" }}>{inv.vendor}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{inv.project}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", fontWeight:"600", color:"#333333", textAlign:"right" }}>{inv.amount}</td>
                        <td style={{ padding:"14px 20px", minWidth:"170px" }}>
                          {(() => {
                            const po = selectedProject ? getVendorPO(selectedProject.id, inv.vendor) : undefined;
                            if (!po) return <span style={{ fontSize:"11px", color:"#cccccc" }}>No PO</span>;
                            const invoiced  = vendorInvoiceTotal(inv.vendor, inv.project);
                            const remaining = po.poValue - invoiced;
                            const pctUsed   = po.poValue > 0 ? Math.min(100, (invoiced / po.poValue) * 100) : 0;
                            const barColor  = remaining < 0 ? "#ba1a1a" : pctUsed >= 90 ? "#a16207" : "#16a34a";
                            return (
                              <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                                <span style={{ fontSize:"11px", color:"#333333" }}>
                                  ₹{invoiced.toLocaleString("en-IN")} <span style={{ color:"#999999" }}>/ ₹{po.poValue.toLocaleString("en-IN")}</span>
                                </span>
                                <div style={{ height:"4px", width:"100%", background:"#e4e2e1", borderRadius:"2px", overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${pctUsed}%`, background:barColor, transition:"width 0.3s" }} />
                                </div>
                                <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.05em", color: remaining < 0 ? "#ba1a1a" : "#999999" }}>
                                  {remaining < 0 ? `Over by ₹${Math.abs(remaining).toLocaleString("en-IN")}` : `₹${remaining.toLocaleString("en-IN")} left`}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{inv.due}</td>
                        <td style={{ padding:"14px 20px" }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:"4px", alignItems:"flex-start" }}>
                            {badge(inv.status, INV_STYLE[inv.status])}
                            {requests.some(r => r.invoiceRef === inv.id) && (
                              <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.05em", color:"#16a34a", display:"flex", alignItems:"center", gap:"3px" }}>
                                <span className="material-symbols-outlined" style={{ fontSize:"11px" }}>link</span>Request raised
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding:"14px 20px" }} onClick={e => e.stopPropagation()}>
                          <div ref={openMenu===inv.id ? menuRef:undefined} style={{ position:"relative", display:"inline-block" }}>
                            <button onClick={() => setOpenMenu(openMenu===inv.id?null:inv.id)}
                              style={{ padding:"4px 6px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", cursor:"pointer", display:"flex" }}
                              onMouseEnter={e => { e.currentTarget.style.background="#f0eded"; }}
                              onMouseLeave={e => { e.currentTarget.style.background="white"; }}>
                              <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#666666" }}>more_vert</span>
                            </button>
                            {openMenu===inv.id && (() => {
                              const alreadyRaised = requests.some(r => r.invoiceRef === inv.id);
                              return (
                                <div style={{ position:"absolute", right:0, ...(rowIdx >= slice.length-2 ? {bottom:"100%",marginBottom:"4px"}:{top:"100%",marginTop:"4px"}), background:"white", border:"1px solid #e4e2e1", borderRadius:"8px", boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:70, minWidth:"200px", overflow:"hidden" }}>
                                  <button onClick={() => { setSlideInvId(inv.id); setOpenMenu(null); }} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#333333", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                    onMouseEnter={e=>{e.currentTarget.style.background="#f8f8f8";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                    <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>open_in_new</span> View Details
                                  </button>
                                  {/* Project team approval — only while pending */}
                                  {inv.status === "Approval Pending" && (
                                    <>
                                      <button onClick={() => approveInvoice(inv.id)} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#16a34a", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                        onMouseEnter={e=>{e.currentTarget.style.background="#f0fdf4";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>verified</span> Approve Invoice
                                      </button>
                                      <button onClick={() => rejectInvoice(inv.id)} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#ba1a1a", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                        onMouseEnter={e=>{e.currentTarget.style.background="#fff0f0";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>block</span> Reject Invoice
                                      </button>
                                    </>
                                  )}
                                  {/* Raise Payment Request — only after approval */}
                                  {inv.status === "Approved" && (
                                    alreadyRaised ? (
                                      <div style={{ padding:"10px 16px", fontSize:"13px", color:"#16a34a", display:"flex", alignItems:"center", gap:"8px", opacity:0.7 }}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>check_circle</span> Request Already Raised
                                      </div>
                                    ) : (
                                      <button onClick={() => raiseFromInvoice(inv)} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#e30613", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px", fontWeight:"bold" }}
                                        onMouseEnter={e=>{e.currentTarget.style.background="#fff5f5";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>request_quote</span> Raise Payment Request
                                      </button>
                                    )
                                  )}
                                  <div style={{ height:"1px", background:"#f0eded" }} />
                                  <button onClick={() => deleteInv(inv.id)} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#ba1a1a", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                    onMouseEnter={e=>{e.currentTarget.style.background="#fff0f0";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                    <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>delete</span> Delete
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PagBar total={total} tab={0} />
              </>
            )}
          </div>
        );
      })()}

      {/* ── Tab 1: Vendor Payment Requests ───────────────────────── */}
      {activeTab === 1 && (() => {
        const { slice, total } = paginate(filtRequests, 1);
        return (
          <div style={{ border:"1px solid #e4e2e1", borderRadius:"12px", overflow:"visible", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", alignItems:"center", gap:"8px" }}>
              <div style={{ width:"3px", height:"20px", background:"#e30613", borderRadius:"2px" }} />
              <h3 style={{ fontSize:"18px", fontWeight:"500", color:"#333333" }}>Vendor Payment Requests</h3>
              <span style={{ marginLeft:"auto", fontSize:"12px", color:"#666666" }}>{filtRequests.length} requests</span>
            </div>
            {total === 0 ? <EmptyRow label="payment requests" /> : (
              <>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#f8f8f8", borderBottom:"1px solid #e4e2e1" }}>
                      {["Request ID","Vendor","Project","Amount","Requested","Status","Actions"].map((h,i) => (
                        <th key={h} style={{ padding:"14px 20px", fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#666666", textAlign: i===3?"right":"left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map(r => (
                      <tr key={r.id} style={{ borderBottom:"1px solid #f0f0f0", background:"white" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background="#f8f8f8"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background="white"; }}>
                        <td style={{ padding:"14px 20px" }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                            <span style={{ fontSize:"13px", fontWeight:"bold", color:"#e30613" }}>{r.id}</span>
                            {r.invoiceRef && (
                              <button
                                onClick={() => { setActiveTab(0); setSlideInvId(r.invoiceRef ?? null); }}
                                style={{ fontSize:"9px", fontWeight:"bold", color:"#666666", background:"#f0eded", border:"none", borderRadius:"4px", padding:"2px 6px", cursor:"pointer", display:"flex", alignItems:"center", gap:"3px", alignSelf:"flex-start" }}>
                                <span className="material-symbols-outlined" style={{ fontSize:"11px" }}>receipt_long</span>
                                {r.invoiceRef}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#333333" }}>{r.vendor}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{r.project}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", fontWeight:"600", color:"#333333", textAlign:"right" }}>{r.amount}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{r.requested}</td>
                        <td style={{ padding:"14px 20px" }}>{badge(r.status, REQ_STYLE[r.status])}</td>
                        <td style={{ padding:"14px 20px" }}>
                          <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                            {r.status === "Pending Accounts Approval" && (
                              <button onClick={() => approveReqByAccounts(r.id)} style={{ padding:"4px 12px", border:"1px solid rgba(34,197,94,0.3)", borderRadius:"6px", fontSize:"11px", fontWeight:"bold", color:"#16a34a", background:"rgba(34,197,94,0.05)", cursor:"pointer" }}>Approve (Accounts)</button>
                            )}
                            {r.status === "Approved by Accounts" && (
                              <button onClick={() => markReqPaid(r.id)} style={{ padding:"4px 12px", border:"1px solid rgba(0,89,168,0.3)", borderRadius:"6px", fontSize:"11px", fontWeight:"bold", color:"#0059a8", background:"rgba(0,89,168,0.05)", cursor:"pointer" }}>Mark Paid</button>
                            )}
                            {r.invoiceFile ? (
                              <button onClick={() => setViewReqInvoice(r)}
                                style={{ padding:"4px 10px", border:"1px solid rgba(227,6,19,0.3)", borderRadius:"6px", fontSize:"11px", fontWeight:"bold", color:"#e30613", background:"rgba(227,6,19,0.05)", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px" }}>
                                <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>receipt</span> View Invoice
                              </button>
                            ) : (
                              <span style={{ fontSize:"11px", color:"#cccccc" }}>No file</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PagBar total={total} tab={1} />
              </>
            )}
          </div>
        );
      })()}

      {/* ── Tab 2: Site Expense Tracking ─────────────────────────── */}
      {activeTab === 2 && (() => {
        const { slice, total } = paginate(filtExpenses, 2);
        const totalAmt = filtExpenses.reduce((s, x) => s + x.amountNum, 0);
        const catMap: Record<string, number> = {};
        filtExpenses.forEach(x => { catMap[x.category] = (catMap[x.category] ?? 0) + x.amountNum; });
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            {/* Summary row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"12px" }}>
              {[
                { label:"Total Spent", value:`₹${totalAmt.toLocaleString()}`, color:"#e30613" },
                { label:"Materials",   value:`₹${(catMap["Materials"]??0).toLocaleString()}`,   color:"#333333" },
                { label:"Labor",       value:`₹${(catMap["Labor"]??0).toLocaleString()}`,       color:"#333333" },
                { label:"Equipment",   value:`₹${(catMap["Equipment"]??0).toLocaleString()}`,   color:"#333333" },
              ].map(s => (
                <div key={s.label} style={{ background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"8px", padding:"16px" }}>
                  <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#999999", marginBottom:"4px" }}>{s.label}</p>
                  <p style={{ fontSize:"24px", fontWeight:"bold", color:s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div style={{ border:"1px solid #e4e2e1", borderRadius:"12px", overflow:"visible", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
              {total === 0 ? <EmptyRow label="expenses" /> : (
                <>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:"#f8f8f8", borderBottom:"1px solid #e4e2e1" }}>
                        {["ID","Category","Description","Project","Amount","Date","By",""].map((h,i) => (
                          <th key={i} style={{ padding:"14px 20px", fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#666666", textAlign: h==="Amount"?"right":"left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slice.map(x => (
                        <tr key={x.id} style={{ borderBottom:"1px solid #f0f0f0", background:"white" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background="#f8f8f8"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background="white"; }}>
                          <td style={{ padding:"14px 20px", fontSize:"13px", fontWeight:"bold", color:"#e30613" }}>{x.id}</td>
                          <td style={{ padding:"14px 20px" }}>
                            <span style={{ padding:"2px 8px", borderRadius:"4px", fontSize:"10px", fontWeight:"bold", background:"#f0eded", color:"#666666" }}>{x.category}</span>
                          </td>
                          <td style={{ padding:"14px 20px", fontSize:"13px", color:"#333333" }}>{x.description}</td>
                          <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{x.project}</td>
                          <td style={{ padding:"14px 20px", fontSize:"13px", fontWeight:"600", color:"#333333", textAlign:"right" }}>{x.amount}</td>
                          <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{x.date}</td>
                          <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{x.by}</td>
                          <td style={{ padding:"14px 20px" }}>
                            <button onClick={() => deleteExpense(x.id)} style={{ padding:"4px 8px", border:"1px solid #fdd", borderRadius:"6px", background:"#fff5f5", cursor:"pointer", display:"flex" }}>
                              <span className="material-symbols-outlined" style={{ fontSize:"14px", color:"#ba1a1a" }}>delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PagBar total={total} tab={2} />
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Tab 3: Vendor Scope & Progress ───────────────────────── */}
      {activeTab === 3 && (() => {
        const { slice, total } = paginate(filtScope, 3);
        return (
          <div style={{ border:"1px solid #e4e2e1", borderRadius:"12px", overflow:"visible", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", alignItems:"center", gap:"8px" }}>
              <div style={{ width:"3px", height:"20px", background:"#e30613", borderRadius:"2px" }} />
              <h3 style={{ fontSize:"18px", fontWeight:"500", color:"#333333" }}>Vendor Scope & Progress</h3>
            </div>
            {total === 0 ? <EmptyRow label="scope items" /> : (
              <>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#f8f8f8", borderBottom:"1px solid #e4e2e1" }}>
                      {["Vendor","Project","Scope","Progress","Status","Due Date"].map((h) => (
                        <th key={h} style={{ padding:"14px 20px", fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#666666" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map(s => (
                      <tr key={s.id} style={{ borderBottom:"1px solid #f0f0f0", background:"white" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background="#f8f8f8"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background="white"; }}>
                        <td style={{ padding:"14px 20px", fontSize:"13px", fontWeight:"600", color:"#333333" }}>{s.vendor}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{s.project}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#333333", maxWidth:"240px" }}>{s.scope}</td>
                        <td style={{ padding:"14px 20px", minWidth:"180px" }}>
                          {editingProgress === s.id ? (
                            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                              <input
                                type="number" min="0" max="100"
                                value={progressInput}
                                onChange={e => setProgressInput(e.target.value)}
                                onKeyDown={e => { if (e.key==="Enter") updateScopeProgress(s.id, parseInt(progressInput)); if (e.key==="Escape") setEditingProgress(null); }}
                                style={{ width:"60px", padding:"4px 8px", border:"1px solid #e30613", borderRadius:"4px", fontSize:"13px", outline:"none" }}
                                autoFocus
                              />
                              <span style={{ fontSize:"12px", color:"#666666" }}>%</span>
                              <button onClick={() => updateScopeProgress(s.id, parseInt(progressInput))}
                                style={{ padding:"4px 8px", background:"#e30613", color:"white", border:"none", borderRadius:"4px", fontSize:"11px", fontWeight:"bold", cursor:"pointer" }}>✓</button>
                              <button onClick={() => setEditingProgress(null)}
                                style={{ padding:"4px 6px", background:"white", color:"#999999", border:"1px solid #e4e2e1", borderRadius:"4px", fontSize:"11px", cursor:"pointer" }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }} onClick={() => { setEditingProgress(s.id); setProgressInput(String(s.progress)); }} title="Click to edit progress">
                              <div style={{ flex:1, height:"6px", background:"#e4e2e1", borderRadius:"3px", overflow:"hidden" }}>
                                <div style={{ height:"100%", width:`${s.progress}%`, background: s.status==="Delayed"?"#ba1a1a":s.status==="Completed"?"#16a34a":"#e30613", borderRadius:"3px", transition:"width 0.3s" }} />
                              </div>
                              <span style={{ fontSize:"12px", fontWeight:"bold", color:"#333333", minWidth:"32px" }}>{s.progress}%</span>
                              <span className="material-symbols-outlined" style={{ fontSize:"13px", color:"#cccccc" }}>edit</span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding:"14px 20px" }}>{badge(s.status, SCOPE_STYLE[s.status])}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color: s.status==="Delayed"?"#ba1a1a":"#666666" }}>{s.dueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PagBar total={total} tab={3} />
              </>
            )}
          </div>
        );
      })()}

      {/* ── Invoice Slide-over ──────────────────────────────────── */}
      {mounted && createPortal(
        <>
          <div style={{ position:"fixed", right:0, top:0, height:"100%", width:"420px", background:"white", borderLeft:"1px solid #e4e2e1", zIndex:9998, boxShadow:"-8px 0 32px rgba(0,0,0,0.12)", transform: slideInv ? "translateX(0)" : "translateX(100%)", transition:"transform 0.35s ease" }}>
            {slideInv && (
              <div style={{ height:"100%", display:"flex", flexDirection:"column", padding:"28px" }}>
                <div style={{ position:"absolute", left:0, top:"48px", width:"4px", height:"56px", background:"#e30613", borderRadius:"0 2px 2px 0" }} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px" }}>
                  <div>
                    <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#e30613", marginBottom:"4px" }}>Invoice Details</p>
                    <h3 style={{ fontSize:"22px", fontWeight:"bold", color:"#333333" }}>{slideInv.id}</h3>
                  </div>
                  <button onClick={() => setSlideInvId(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#666666", display:"flex" }}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:"24px" }}>
                  <section>
                    <h4 style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#999999", marginBottom:"12px" }}>Vendor</h4>
                    <div style={{ background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"8px", padding:"14px" }}>
                      <p style={{ fontWeight:"bold", color:"#333333", marginBottom:"4px" }}>{slideInv.vendor}</p>
                      <p style={{ fontSize:"13px", color:"#666666" }}>{slideInv.project}</p>
                    </div>
                    {/* Show linked payment request if one exists */}
                    {(() => {
                      const linked = requests.find(r => r.invoiceRef === slideInv.id);
                      return linked ? (
                        <div style={{ marginTop:"8px", padding:"8px 12px", background:"rgba(34,197,94,0.05)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:"6px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize:"14px", color:"#16a34a" }}>link</span>
                            <span style={{ fontSize:"12px", color:"#16a34a", fontWeight:"bold" }}>Payment request {linked.id} raised</span>
                          </div>
                          <button onClick={() => { setActiveTab(1); setSlideInvId(null); }}
                            style={{ fontSize:"11px", color:"#16a34a", background:"none", border:"none", cursor:"pointer", fontWeight:"bold", textDecoration:"underline" }}>
                            View in Tab
                          </button>
                        </div>
                      ) : null;
                    })()}
                  </section>
                  {/* Purchase Order utilization */}
                  <section>
                    <h4 style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#999999", marginBottom:"10px" }}>Purchase Order</h4>
                    {(() => {
                      const po = selectedProject ? getVendorPO(selectedProject.id, slideInv.vendor) : undefined;
                      if (!po) {
                        return (
                          <div style={{ padding:"12px", background:"#f8f8f8", border:"1px dashed #e4e2e1", borderRadius:"8px", fontSize:"13px", color:"#999999" }}>
                            No purchase order on record for this vendor.
                          </div>
                        );
                      }
                      const invoiced  = vendorInvoiceTotal(slideInv.vendor, slideInv.project);
                      const remaining = po.poValue - invoiced;
                      const pctUsed   = po.poValue > 0 ? Math.min(100, (invoiced / po.poValue) * 100) : 0;
                      const barColor  = remaining < 0 ? "#ba1a1a" : pctUsed >= 90 ? "#a16207" : "#16a34a";
                      return (
                        <div style={{ background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"8px", padding:"14px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
                            <span style={{ fontSize:"12px", color:"#666666" }}>{po.poNumber}</span>
                            <span style={{ fontSize:"13px", fontWeight:"bold", color:"#333333" }}>₹{po.poValue.toLocaleString("en-IN")}</span>
                          </div>
                          <div style={{ height:"6px", width:"100%", background:"#e4e2e1", borderRadius:"3px", overflow:"hidden", marginBottom:"8px" }}>
                            <div style={{ height:"100%", width:`${pctUsed}%`, background:barColor, transition:"width 0.3s" }} />
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px" }}>
                            <span style={{ color:"#666666" }}>Invoiced: <strong style={{ color:"#333333" }}>₹{invoiced.toLocaleString("en-IN")}</strong></span>
                            <span style={{ color: remaining < 0 ? "#ba1a1a" : "#16a34a", fontWeight:"bold" }}>
                              {remaining < 0 ? `Over by ₹${Math.abs(remaining).toLocaleString("en-IN")}` : `₹${remaining.toLocaleString("en-IN")} remaining`}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </section>
                  {/* Date */}
                  <section>
                    <h4 style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#999999", marginBottom:"8px" }}>Date</h4>
                    <p style={{ fontSize:"14px", color:"#333333" }}>{slideInv.due}</p>
                  </section>
                  {/* Status */}
                  <section>
                    <h4 style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#999999", marginBottom:"8px" }}>Status</h4>
                    {badge(slideInv.status, INV_STYLE[slideInv.status])}
                  </section>
                  {/* Attached invoice document */}
                  {invPreviewUrl && (
                    <section>
                      <h4 style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#999999", marginBottom:"10px" }}>Attached Invoice Document</h4>
                      {slideInv.fileObj?.type === "application/pdf" ? (
                        <iframe src={invPreviewUrl} title="Invoice" style={{ width:"100%", height:"220px", border:"1px solid #e4e2e1", borderRadius:"6px" }} />
                      ) : slideInv.fileObj?.type.startsWith("image/") ? (
                        <img src={invPreviewUrl} alt="Invoice" style={{ width:"100%", borderRadius:"6px", border:"1px solid #e4e2e1", maxHeight:"200px", objectFit:"contain" }} />
                      ) : (
                        <div style={{ padding:"12px", background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"6px", fontSize:"13px", color:"#666666" }}>
                          {slideInv.fileObj?.name}
                        </div>
                      )}
                      <a href={invPreviewUrl} download={slideInv.fileObj?.name}
                        style={{ marginTop:"6px", display:"inline-flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#e30613", fontWeight:"bold", textDecoration:"none" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>download</span>
                        Download
                      </a>
                    </section>
                  )}
                  {!invPreviewUrl && (
                    <div style={{ padding:"16px", background:"#f8f8f8", border:"1px dashed #e4e2e1", borderRadius:"8px", textAlign:"center", color:"#999999", fontSize:"13px" }}>
                      No invoice document attached
                    </div>
                  )}
                </div>
                {/* Footer actions — driven by workflow stage */}
                <div style={{ paddingTop:"20px", borderTop:"1px solid #e4e2e1", display:"flex", flexDirection:"column", gap:"10px" }}>
                  {slideInv.status === "Approval Pending" && (
                    <div style={{ display:"flex", gap:"10px" }}>
                      <button onClick={() => rejectInvoice(slideInv.id)}
                        style={{ flex:1, padding:"12px", border:"1px solid rgba(186,26,26,0.3)", borderRadius:"8px", background:"rgba(186,26,26,0.05)", color:"#ba1a1a", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>
                        Reject
                      </button>
                      <button onClick={() => approveInvoice(slideInv.id)}
                        style={{ flex:2, padding:"12px", border:"none", borderRadius:"8px", background:"#16a34a", color:"white", fontWeight:"bold", cursor:"pointer", fontSize:"13px", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>verified</span>
                        Approve Invoice
                      </button>
                    </div>
                  )}
                  {slideInv.status === "Approved" && (() => {
                    const alreadyRaised = requests.some(r => r.invoiceRef === slideInv.id);
                    return alreadyRaised ? (
                      <div style={{ padding:"10px 14px", background:"rgba(34,197,94,0.05)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:"6px", fontSize:"13px", color:"#16a34a", display:"flex", alignItems:"center", gap:"8px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>check_circle</span>
                        Payment request already raised
                      </div>
                    ) : (
                      <button onClick={() => raiseFromInvoice(slideInv)}
                        style={{ width:"100%", padding:"12px", border:"none", borderRadius:"8px", background:"#e30613", color:"white", fontWeight:"bold", cursor:"pointer", fontSize:"13px", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>request_quote</span>
                        Raise Payment Request
                      </button>
                    );
                  })()}
                  <button onClick={() => flagInvoice(slideInv.id)}
                    style={{ width:"100%", padding:"10px", border:`1px solid ${slideInv.flagged ? "#e30613":"#e4e2e1"}`, borderRadius:"8px", background: slideInv.flagged ? "rgba(227,6,19,0.05)":"white", color: slideInv.flagged ? "#e30613":"#666666", fontWeight:"bold", cursor:"pointer", fontSize:"12px", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>{slideInv.flagged ? "flag" : "outlined_flag"}</span>
                    {slideInv.flagged ? "Remove Flag" : "Flag Invoice"}
                  </button>
                </div>
              </div>
            )}
          </div>
          {slideInv && <div onClick={() => setSlideInvId(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.2)", zIndex:9997 }} />}
        </>,
        document.body
      )}

      {/* ── Payment Request Invoice Preview ────────────────────── */}
      {mounted && viewReqInvoice && createPortal(
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }} onClick={() => setViewReqInvoice(null)}>
          <div style={{ background:"white", border:"1px solid #e4e2e1", width:"100%", maxWidth:"720px", borderRadius:"8px", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.25)", display:"flex", flexDirection:"column", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", alignItems:"center", gap:"12px", flexShrink:0 }}>
              <span className="material-symbols-outlined" style={{ color:"#e30613" }}>receipt</span>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Payment Request · {viewReqInvoice.id}</p>
                <p style={{ fontSize:"14px", fontWeight:"600", color:"#333333" }}>{viewReqInvoice.vendor} — {viewReqInvoice.amount}</p>
              </div>
              <button onClick={() => setViewReqInvoice(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#666666", display:"flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ flex:1, overflow:"auto", minHeight:"300px" }}>
              {reqPreviewUrl && viewReqInvoice.invoiceFile?.type === "application/pdf" && (
                <iframe src={reqPreviewUrl} title="Invoice" style={{ width:"100%", height:"580px", border:"none", display:"block" }} />
              )}
              {reqPreviewUrl && viewReqInvoice.invoiceFile?.type.startsWith("image/") && (
                <div style={{ background:"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center", minHeight:"300px" }}>
                  <img src={reqPreviewUrl} alt="Invoice" style={{ maxWidth:"100%", maxHeight:"70vh", objectFit:"contain" }} />
                </div>
              )}
            </div>
            {reqPreviewUrl && (
              <div style={{ padding:"12px 20px", borderTop:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"flex-end", gap:"8px", flexShrink:0 }}>
                <a href={reqPreviewUrl} download={viewReqInvoice.invoiceFile?.name}
                  style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", fontSize:"13px", textDecoration:"none", display:"flex", alignItems:"center", gap:"6px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>download</span> Download
                </a>
                <button onClick={() => setViewReqInvoice(null)} style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>Close</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── New Request Modal ───────────────────────────────────── */}
      {mounted && showNew && createPortal(
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
          <div style={{ background:"white", border:"1px solid #e4e2e1", width:"100%", maxWidth:"520px", borderRadius:"8px", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"16px 24px", borderBottom:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h3 style={{ fontSize:"20px", fontWeight:"bold", color:"#333333" }}>New {TABS[activeTab].replace(/s$/, "").replace("Vendor ","")}</h3>
              <button onClick={() => { setShowNew(false); setUploadError(null); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#666666", display:"flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"16px" }}>
              {activeTab === 0 && (() => {
                const projectPOs = selectedProject ? getProjectVendorPOs(selectedProject.id) : [];
                const selVendor  = (f("vendor") || "").trim();
                const selPO      = selectedProject && selVendor ? getVendorPO(selectedProject.id, selVendor) : undefined;
                const invoicedSoFar = selPO ? vendorInvoiceTotal(selVendor, proj || "") : 0;
                const remaining  = selPO ? selPO.poValue - invoicedSoFar : 0;
                const amtNum     = parseFloat(f("amount") || "0");
                const overCap    = !!selPO && amtNum > 0 && amtNum > remaining;

                if (projectPOs.length === 0) {
                  return (
                    <div style={{ padding:"20px", background:"rgba(186,26,26,0.05)", border:"1px solid rgba(186,26,26,0.25)", borderRadius:"8px", display:"flex", flexDirection:"column", gap:"6px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px", color:"#ba1a1a", fontWeight:"bold", fontSize:"13px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>block</span>
                        No purchase orders for this project
                      </div>
                      <p style={{ fontSize:"13px", color:"#666666", lineHeight:1.5 }}>
                        Invoices can only be uploaded against a vendor that has a purchase order. Add a vendor and PO from the
                        <strong style={{ color:"#333333" }}> Dashboard → Vendors &amp; Purchase Orders</strong> first.
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Vendor — restricted to vendors with a PO on this project */}
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Vendor <span style={{ color:"#e30613" }}>*</span></label>
                      <select value={f("vendor")} onChange={e=>{ sf("vendor", e.target.value); setUploadError(null); }}
                        style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none", background:"white", color: selVendor ? "#333333" : "#999999" }}>
                        <option value="">Select a vendor with a purchase order…</option>
                        {projectPOs.map(po => (
                          <option key={po.id} value={po.vendorName}>{po.vendorName} — PO ₹{po.poValue.toLocaleString("en-IN")}</option>
                        ))}
                      </select>
                    </div>

                    {/* PO budget summary for the chosen vendor */}
                    {selPO && (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
                        {[
                          { label:"PO Value",  value:`₹${selPO.poValue.toLocaleString("en-IN")}`,   color:"#333333" },
                          { label:"Invoiced",  value:`₹${invoicedSoFar.toLocaleString("en-IN")}`,   color:"#333333" },
                          { label:"Remaining", value:`₹${Math.max(0, remaining).toLocaleString("en-IN")}`, color: remaining > 0 ? "#16a34a" : "#ba1a1a" },
                        ].map(s => (
                          <div key={s.label} style={{ background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px" }}>
                            <p style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999", marginBottom:"2px" }}>{s.label}</p>
                            <p style={{ fontSize:"15px", fontWeight:"bold", color:s.color }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Amount + Invoice Date */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                        <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Invoice Amount (₹) <span style={{ color:"#e30613" }}>*</span></label>
                        <input type="number" min="0" value={f("amount")} onChange={e=>{ sf("amount", e.target.value); setUploadError(null); }} placeholder="0.00"
                          style={{ border:`1px solid ${overCap ? "#ba1a1a" : "#e4e2e1"}`, borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                        {overCap && (
                          <span style={{ fontSize:"11px", color:"#ba1a1a" }}>Exceeds remaining PO balance by ₹{(amtNum - remaining).toLocaleString("en-IN")}</span>
                        )}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                        <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Invoice Date</label>
                        <input type="date" value={f("due")} onChange={e=>sf("due",e.target.value)} style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                      </div>
                    </div>

                    {/* Invoice upload — required */}
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Invoice Document <span style={{ color:"#e30613" }}>*</span></label>
                      <input ref={newInvFileRef} type="file" accept=".pdf,.jpg,.png,.jpeg" style={{ display:"none" }}
                        onChange={e => setNewInvFile(e.target.files?.[0] ?? null)} />
                      {newInvFile ? (
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"6px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#e30613" }}>description</span>
                            <span style={{ fontSize:"13px", color:"#333333" }}>{newInvFile.name}</span>
                          </div>
                          <button onClick={() => setNewInvFile(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#999999", display:"flex" }}>
                            <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>close</span>
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => newInvFileRef.current?.click()}
                          style={{ padding:"14px", border:"2px dashed #e4e2e1", borderRadius:"6px", background:"#f8f8f8", color:"#666666", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>upload_file</span>
                          Upload Invoice (PDF, JPG, PNG) — required
                        </button>
                      )}
                    </div>

                    {/* Validation / rejection banner */}
                    {uploadError && (
                      <div style={{ padding:"12px 14px", background:"rgba(186,26,26,0.06)", border:"1px solid rgba(186,26,26,0.3)", borderRadius:"6px", display:"flex", gap:"8px", alignItems:"flex-start" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"18px", color:"#ba1a1a", flexShrink:0 }}>error</span>
                        <span style={{ fontSize:"12px", color:"#ba1a1a", lineHeight:1.5 }}>{uploadError}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {activeTab === 1 && (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Vendor</label>
                      <input value={f("vendor")} onChange={e=>sf("vendor",e.target.value)} placeholder="Vendor name" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Amount (₹)</label>
                      <input type="number" value={f("amount")} onChange={e=>sf("amount",e.target.value)} placeholder="0.00" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Project</label>
                      <input value={f("project") || proj || ""} onChange={e=>sf("project",e.target.value)} placeholder="Project name" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Requested Date</label>
                      <input type="date" value={f("due")} onChange={e=>sf("due",e.target.value)} style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>
                  </div>
                  {activeTab===1 && (
                    <>
                      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                        <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Notes</label>
                        <textarea value={f("notes")} onChange={e=>sf("notes",e.target.value)} rows={2} placeholder="Reason for payment request…" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none", resize:"none", fontFamily:"inherit" }} />
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                        <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Attach Invoice</label>
                        <input ref={prFileRef} type="file" accept=".pdf,.jpg,.png,.jpeg" style={{ display:"none" }} onChange={e => setPrFile(e.target.files?.[0] ?? null)} />
                        {prFile ? (
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"6px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                              <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#e30613" }}>description</span>
                              <span style={{ fontSize:"13px", color:"#333333" }}>{prFile.name}</span>
                            </div>
                            <button onClick={() => setPrFile(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#999999", display:"flex" }}>
                              <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>close</span>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => prFileRef.current?.click()}
                            style={{ padding:"12px", border:"2px dashed #e4e2e1", borderRadius:"6px", background:"#f8f8f8", color:"#666666", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                            <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>upload_file</span>
                            Click to attach invoice (PDF, JPG, PNG)
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              {activeTab === 2 && (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Category</label>
                      <select value={f("category")||"Materials"} onChange={e=>sf("category",e.target.value)} style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }}>
                        {["Materials","Labor","Equipment","Miscellaneous"].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Amount (₹)</label>
                      <input type="number" value={f("amount")} onChange={e=>sf("amount",e.target.value)} placeholder="0.00" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Description</label>
                    <input value={f("description")} onChange={e=>sf("description",e.target.value)} placeholder="e.g. Cement bags – 50 units" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                  </div>
                </>
              )}
              {activeTab === 3 && (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Vendor</label>
                      <input value={f("vendor")} onChange={e=>sf("vendor",e.target.value)} placeholder="Vendor name" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Due Date</label>
                      <input type="date" value={f("dueDate")} onChange={e=>sf("dueDate",e.target.value)} style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Scope Description</label>
                    <textarea value={f("scope")} onChange={e=>sf("scope",e.target.value)} rows={2} placeholder="Describe the work scope…" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none", resize:"none", fontFamily:"inherit" }} />
                  </div>
                </>
              )}
            </div>
            <div style={{ padding:"16px 24px", borderTop:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button onClick={() => { setShowNew(false); setUploadError(null); }} style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>Cancel</button>
              {(() => {
                const hasPOForProject = selectedProject ? getProjectVendorPOs(selectedProject.id).length > 0 : false;
                const disabled = activeTab === 0 && (
                  !hasPOForProject || !newInvFile || !f("vendor") || !(parseFloat(f("amount") || "0") > 0)
                );
                return (
                  <button onClick={submitNew} disabled={disabled}
                    style={{ padding:"8px 24px", border:"none", borderRadius:"6px", background: disabled ? "#f0bcc0" : "#e30613", color:"white", fontWeight:"bold", cursor: disabled ? "not-allowed" : "pointer", fontSize:"13px" }}>
                    Create
                  </button>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
