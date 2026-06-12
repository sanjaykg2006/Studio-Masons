"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useProject, type Invoice, type PayReq, type InvStatus, type ReqStatus } from "../../../contexts/ProjectContext";
import { loadOrdersPage, saveExpenses, saveScope } from "../data";

// ── Types ─────────────────────────────────────────────────────────
// Invoice & payment-request types now live in ProjectContext (shared + persisted).
type ScopeStatus = "Not Started" | "In Progress" | "Completed" | "Delayed";
// Site-expense approval workflow: site team logs → PM approves → billing approves → accounts approves & pays
type ExpStatus = "Pending PM Approval" | "Pending Billing Approval" | "Pending Accounts Approval" | "Paid" | "Rejected";

interface Expense { id:string; category:string; description:string; project:string; amount:string; amountNum:number; date:string; by:string; fileObj?:File; status:ExpStatus; pmApprovedBy?:string; billingApprovedBy?:string; accountsApprovedBy?:string; }
interface VScope  { id:string; vendor:string; project:string; scope:string; progress:number; status:ScopeStatus; dueDate:string; }

// A single base-value line on an invoice, each with its own GST. Invoices carry up to
// four — one mandatory, the rest optional.
type TaxLine = { base:number; sgst:number; cgst:number; igst:number };
type InvLineForm = { base:string; sgst:string; cgst:string; igst:string };
const emptyInvLine = (): InvLineForm => ({ base:"", sgst:"9", cgst:"9", igst:"0" });
const MAX_TAX_LINES = 4;

// Single source of truth for the accounts-approval maths, shared by the live
// recompute effect, the submit handler, and the modal's breakdown render. Other
// charges are a flat add-on that sit inside the TDS base.
function computeApproval(opts:{ lines:TaxLine[]; otherCharges:number; tdsPct:number; deductFromAdvance:boolean; advanceDeductAmt:number; holdRetention:boolean; advRemaining:number; }) {
  const baseSum  = opts.lines.reduce((s,l)=>s + l.base, 0);
  const gstSum   = opts.lines.reduce((s,l)=>s + l.base * (l.sgst + l.cgst + l.igst) / 100, 0);
  const total    = baseSum + gstSum;
  const subtotal = total + opts.otherCharges;
  const deduct   = opts.deductFromAdvance ? Math.min(opts.advanceDeductAmt, subtotal, opts.advRemaining) : 0;
  const afterAdvance = Math.max(0, subtotal - deduct);
  const tdsAmount    = afterAdvance * opts.tdsPct / 100;
  const retentionAmt = opts.holdRetention ? (afterAdvance - tdsAmount) * 0.05 : 0;
  const payable      = Math.max(0, afterAdvance - tdsAmount - retentionAmt);
  return { baseSum, gstSum, total, subtotal, deduct, afterAdvance, tdsAmount, retentionAmt, payable };
}

// ── Status styles ─────────────────────────────────────────────────
const INV_STYLE: Record<InvStatus, React.CSSProperties> = {
  "Approval Pending": { background:"rgba(202,138,4,0.08)",  color:"#a16207", borderColor:"rgba(202,138,4,0.25)" },
  "PM Approved":      { background:"rgba(0,89,168,0.08)",   color:"#0059a8", borderColor:"rgba(0,89,168,0.25)" },
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
const PRIORITY_STYLE: Record<"Low" | "Medium" | "High", React.CSSProperties> = {
  Low:    { background:"rgba(102,102,102,0.08)", color:"#666666", borderColor:"rgba(102,102,102,0.25)" },
  Medium: { background:"rgba(202,138,4,0.08)",   color:"#a16207", borderColor:"rgba(202,138,4,0.25)" },
  High:   { background:"rgba(227,6,19,0.08)",    color:"#e30613", borderColor:"rgba(227,6,19,0.25)" },
};
const EXP_STYLE: Record<ExpStatus, React.CSSProperties> = {
  "Pending PM Approval":       { background:"rgba(202,138,4,0.08)", color:"#a16207", borderColor:"rgba(202,138,4,0.25)" },
  "Pending Billing Approval":  { background:"rgba(0,89,168,0.08)",  color:"#0059a8", borderColor:"rgba(0,89,168,0.25)" },
  "Pending Accounts Approval": { background:"rgba(147,51,234,0.08)",color:"#7e22ce", borderColor:"rgba(147,51,234,0.25)" },
  "Paid":                      { background:"rgba(34,197,94,0.08)", color:"#16a34a", borderColor:"rgba(34,197,94,0.25)" },
  "Rejected":                  { background:"rgba(186,26,26,0.08)", color:"#ba1a1a", borderColor:"rgba(186,26,26,0.25)" },
};

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
  const { selectedProject, getProjectVendorPOs, getVendorPO, consumeAdvance, invoices, setInvoices, requests, setRequests, logActivity } = useProject();

  const [activeTab, setActiveTab] = useState(0);
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [scope, setScope]         = useState<VScope[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  // Site expenses + vendor scope load from the database and persist on change.
  useEffect(() => {
    loadOrdersPage()
      .then(d => { setExpenses(d.expenses as Expense[]); setScope(d.scope as VScope[]); })
      .catch(err => console.warn("[Orders] load failed:", err))
      .finally(() => setOrdersLoaded(true));
  }, []);
  useEffect(() => {
    if (!ordersLoaded) return;
    saveExpenses(expenses.map(e => ({ id: e.id, category: e.category, description: e.description, project: e.project, amount: e.amount, amountNum: e.amountNum, date: e.date, by: e.by, status: e.status, pmApprovedBy: e.pmApprovedBy, billingApprovedBy: e.billingApprovedBy, accountsApprovedBy: e.accountsApprovedBy })))
      .catch(err => console.warn("[Orders] expenses save failed:", err));
  }, [expenses, ordersLoaded]);
  useEffect(() => {
    if (!ordersLoaded) return;
    saveScope(scope).catch(err => console.warn("[Orders] scope save failed:", err));
  }, [scope, ordersLoaded]);

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

  // New request - site expense voucher file (required)
  const expenseFileRef = useRef<HTMLInputElement>(null);
  const [expenseFile, setExpenseFile] = useState<File | null>(null);

  // Site expense voucher file preview
  const [viewExpenseVoucher, setViewExpenseVoucher] = useState<Expense | null>(null);
  const [voucherPreviewUrl, setVoucherPreviewUrl] = useState<string | null>(null);

  // Approve invoice modal states
  const [approvingInvId, setApprovingInvId] = useState<string | null>(null);
  const [approveRemarks, setApproveRemarks] = useState("");
  const [approveBy, setApproveBy] = useState("Arjun K.");
  const [approveTdsPct, setApproveTdsPct] = useState<number>(2);
  // Per-line tax (base + SGST/CGST/IGST) confirmed / adjusted by accounts at approval.
  const [approveTaxLines, setApproveTaxLines] = useState<TaxLine[]>([]);
  // Flat other charges added at approval — part of the TDS base.
  const [approveOtherCharges, setApproveOtherCharges] = useState("0");
  const [deductFromAdvance, setDeductFromAdvance] = useState(false);
  const [advanceDeductAmt, setAdvanceDeductAmt] = useState("0");
  const [holdRetention, setHoldRetention] = useState(false);
  // Bypass the 12-month retention hold — makes the held amount payable now.
  const [retentionEarly, setRetentionEarly] = useState(false);
  const [amountPayable, setAmountPayable] = useState("0");

  // Raise payment request from invoice states
  const [raisingReqInv, setRaisingReqInv] = useState<Invoice | null>(null);
  const [reqValInput, setReqValInput] = useState("");
  const [reqRemarks, setReqRemarks] = useState("");
  const [reqPriority, setReqPriority] = useState<"Low" | "Medium" | "High">("Medium");

  // More-vert row menus
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Generic "who is approving?" confirmation. Used by invoice PM approval,
  // payment-request approval/payment, and expense PM/Billing/Accounts approval.
  const [confirmAction, setConfirmAction] = useState<{ title:string; label:string; cta:string; run:(name:string)=>void } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  function askApprover(opts: { title:string; label:string; cta:string; defaultName:string; run:(name:string)=>void }) {
    setConfirmName(opts.defaultName);
    setConfirmAction({ title:opts.title, label:opts.label, cta:opts.cta, run:opts.run });
    setOpenMenu(null);
  }

  // New Request modal
  const [showNew, setShowNew]       = useState(false);
  const [newForm, setNewForm]       = useState<Record<string, string>>({});
  // Up to four base-value lines for a new invoice; line 1 is mandatory.
  const [invLines, setInvLines]     = useState<InvLineForm[]>([emptyInvLine()]);
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
    if (slideInv?.fileObj instanceof Blob) {
      const url = URL.createObjectURL(slideInv.fileObj);
      setInvPreviewUrl(url);
      return () => { URL.revokeObjectURL(url); setInvPreviewUrl(null); };
    }
    setInvPreviewUrl(null);
  }, [slideInvId]);

  // Blob URL for payment request invoice file
  useEffect(() => {
    if (viewReqInvoice?.invoiceFile instanceof Blob) {
      const url = URL.createObjectURL(viewReqInvoice.invoiceFile);
      setReqPreviewUrl(url);
      return () => { URL.revokeObjectURL(url); setReqPreviewUrl(null); };
    }
    setReqPreviewUrl(null);
  }, [viewReqInvoice]);

  // Blob URL for site expense voucher file
  useEffect(() => {
    if (viewExpenseVoucher?.fileObj instanceof Blob) {
      const url = URL.createObjectURL(viewExpenseVoucher.fileObj);
      setVoucherPreviewUrl(url);
      return () => { URL.revokeObjectURL(url); setVoucherPreviewUrl(null); };
    }
    setVoucherPreviewUrl(null);
  }, [viewExpenseVoucher]);

  // Reset the approve modal whenever it opens.
  useEffect(() => {
    if (approvingInvId) {
      const inv = invoices.find(x => x.id === approvingInvId);
      if (inv) {
        setApproveRemarks("");
        setApproveBy("Arjun K.");
        setApproveTdsPct(2);
        // Seed the per-line tax editor from the invoice's lines (fall back to its
        // single base/GST values for invoices raised before multi-line support).
        setApproveTaxLines(inv.taxLines && inv.taxLines.length
          ? inv.taxLines.map(l => ({ ...l }))
          : [{ base: inv.baseValue ?? inv.amountNum, sgst: inv.sgstPct ?? 9, cgst: inv.cgstPct ?? 9, igst: inv.igstPct ?? 0 }]);
        setApproveOtherCharges(String(inv.otherCharges ?? 0));
        setDeductFromAdvance(false);
        setAdvanceDeductAmt("0");
        setHoldRetention(false);
        setRetentionEarly(inv.retentionEarlyRelease ?? false);
        setAmountPayable(String(inv.amountNum));
      }
    }
  }, [approvingInvId, invoices]);

  // Recompute amount payable: total + other charges − advance − TDS − 5% retention.
  useEffect(() => {
    if (!approvingInvId) return;
    const inv = invoices.find(x => x.id === approvingInvId);
    if (!inv) return;
    const { payable } = computeApproval({
      lines: approveTaxLines,
      otherCharges: parseFloat(approveOtherCharges || "0"),
      tdsPct: approveTdsPct,
      deductFromAdvance,
      advanceDeductAmt: parseFloat(advanceDeductAmt || "0"),
      holdRetention,
      advRemaining: vendorAdvanceRemaining(inv.vendor),
    });
    setAmountPayable(String(payable));
  }, [approveTaxLines, approveOtherCharges, approveTdsPct, deductFromAdvance, advanceDeductAmt, holdRetention, approvingInvId, invoices]);

  // Effect to sync Raise Payment Request Modal values
  useEffect(() => {
    if (raisingReqInv) {
      const remaining = invoiceRemaining(raisingReqInv);
      setReqValInput(String(remaining));
      setReqRemarks(`Payment request for invoice ${raisingReqInv.id}`);
      setReqPriority("Medium");
    }
  }, [raisingReqInv]);

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
  // Stage 1 — project manager approves the uploaded invoice.
  function pmApproveInvoice(id: string, by: string) {
    setInvoices(prev => prev.map(x => x.id === id ? { ...x, status: "PM Approved", pmApprovedAt: new Date().toISOString().slice(0, 10), pmApprovedBy: by } : x));
    setOpenMenu(null);
    const inv = invoices.find(x => x.id === id);
    if (inv) logActivity({ icon: "fact_check", color: "#0059a8", route: "/orders", text: "Invoice PM-approved for", bold: inv.project, detail: `Invoice ${inv.id} from ${inv.vendor} (${inv.amount}) approved by ${by} (PM) — awaiting accounts.` });
  }
  // Open the "who is approving?" prompt for an invoice PM approval.
  function askPmApproveInvoice(inv: Invoice) {
    askApprover({ title:`Approve invoice ${inv.id}`, label:"PM Approver Name", cta:"Approve (PM)", defaultName: selectedProject?.engineer ?? "", run:(name)=>pmApproveInvoice(inv.id, name) });
  }
  // Stage 2 — accounts approve (opens the TDS / advance / retention modal).
  function approveInvoice(id: string) {
    setApprovingInvId(id);
    setOpenMenu(null);
  }
  // Days elapsed since PM approval — the "overdue" clock starts then.
  function getOverdueDays(pmApprovedAt?: string): number | null {
    if (!pmApprovedAt) return null;
    const diff = Math.floor((Date.now() - new Date(pmApprovedAt).getTime()) / 86400000);
    return Math.max(0, diff);
  }
  function submitApproveInvoice() {
    if (!approvingInvId) return;
    const inv = invoices.find(x => x.id === approvingInvId);
    if (!inv) return;
    const otherCharges = parseFloat(approveOtherCharges || "0");
    const { baseSum, subtotal, deduct, retentionAmt } = computeApproval({
      lines: approveTaxLines,
      otherCharges,
      tdsPct: approveTdsPct,
      deductFromAdvance,
      advanceDeductAmt: parseFloat(advanceDeductAmt || "0"),
      holdRetention,
      advRemaining: vendorAdvanceRemaining(inv.vendor),
    });
    const payVal  = parseFloat(amountPayable || "0");
    const first   = approveTaxLines[0];

    setInvoices(prev => prev.map(x => x.id === approvingInvId ? {
      ...x,
      status: "Approved",
      remarks: approveRemarks,
      accountsApprovedBy: approveBy,
      taxLines: approveTaxLines.map(l => ({ ...l })),
      baseValue: baseSum,
      sgstPct: first?.sgst,
      cgstPct: first?.cgst,
      igstPct: first?.igst,
      otherCharges,
      amount: `₹${subtotal.toLocaleString("en-IN")}`,
      amountNum: subtotal,
      tdsPct: approveTdsPct,
      advanceDeducted: deduct,
      retentionHeld: holdRetention,
      retentionAmount: retentionAmt,
      retentionEarlyRelease: holdRetention ? retentionEarly : false,
      amountPayable: payVal,
      requestedAmount: 0
    } : x));

    // Record advance consumed against the vendor's PO.
    if (deduct > 0 && selectedProject) {
      consumeAdvance({ projectId: selectedProject.id, vendorName: inv.vendor, amount: deduct });
    }
    logActivity({ icon: "verified", color: "#16a34a", route: "/orders", text: "Invoice approved for", bold: inv.project, detail: `Invoice ${inv.id} from ${inv.vendor} approved by ${approveBy} (accounts) — ₹${payVal.toLocaleString("en-IN")} payable${deduct > 0 ? `, ₹${deduct.toLocaleString("en-IN")} adjusted from advance` : ""}.` });
    setApprovingInvId(null);
  }
  function rejectInvoice(id: string) {
    setInvoices(prev => prev.map(x => x.id === id ? { ...x, status: "Rejected" } : x));
    setOpenMenu(null);
    const inv = invoices.find(x => x.id === id);
    if (inv) logActivity({ icon: "block", color: "#ba1a1a", route: "/orders", text: "Invoice rejected for", bold: inv.project, detail: `Invoice ${inv.id} from ${inv.vendor} (${inv.amount}) was rejected.` });
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
  function approveReqByAccounts(id: string, by: string) {
    setRequests(prev => prev.map(x => x.id === id ? { ...x, status: "Approved by Accounts", accountsApprovedBy: by } : x));
    const r = requests.find(x => x.id === id);
    if (r) logActivity({ icon: "price_check", color: "#16a34a", route: "/orders", text: "Payment request approved for", bold: r.project, detail: `Payment request ${r.id} for ${r.vendor} (${r.amount}) approved by ${by} (accounts) — ready to pay.` });
  }
  function markReqPaid(id: string, by: string) {
    setRequests(prev => prev.map(x => x.id === id ? { ...x, status: "Paid", paidBy: by } : x));
    const r = requests.find(x => x.id === id);
    if (r) logActivity({ icon: "payments", color: "#0059a8", route: "/orders", text: "Payment marked paid for", bold: r.project, detail: `Payment request ${r.id} for ${r.vendor} (${r.amount}) marked as paid by ${by}.` });
  }
  // Approved-but-not-yet-consumed advance available to deduct from a vendor's invoice.
  function vendorAdvanceRemaining(vendorName: string): number {
    const po = selectedProject ? getVendorPO(selectedProject.id, vendorName) : undefined;
    if (!po?.advanceApproved) return 0;
    return Math.max(0, (po.advanceRequested ?? 0) - (po.advanceConsumed ?? 0));
  }
  // Remaining payable that can still be requested for an approved invoice. The amount
  // payable already nets advance + TDS + retention, so held retention is not requestable.
  function invoiceRemaining(inv: Invoice) {
    const payable = inv.amountPayable ?? inv.amountNum;
    // Retention is normally locked out of the payable pool; when its 12-month hold is
    // bypassed, the held amount becomes immediately requestable.
    const retentionPool = inv.retentionHeld && inv.retentionEarlyRelease ? (inv.retentionAmount ?? 0) : 0;
    return payable + retentionPool - (inv.requestedAmount ?? 0);
  }
  function raiseFromInvoice(inv: Invoice) {
    // Only allowed when project team has approved the invoice and budget remains
    if (inv.status !== "Approved" || invoiceRemaining(inv) <= 0) return;
    setRaisingReqInv(inv);
    setOpenMenu(null);
    setSlideInvId(null);
  }
  function submitRaiseRequest() {
    if (!raisingReqInv) return;
    const inv = raisingReqInv;
    const remaining = invoiceRemaining(inv);
    const val = parseFloat(reqValInput || "0");
    // Requested amount must be positive and within the remaining payable.
    if (!(val > 0) || val > remaining) return;

    const n: PayReq = {
      id: `PR-${String(requests.length + 1).padStart(3, "0")}`,
      vendor: inv.vendor,
      project: inv.project,
      amount: `₹${val.toLocaleString("en-IN")}`,
      amountNum: val,
      requested: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }),
      status: "Pending Accounts Approval",
      notes: reqRemarks,
      invoiceFile: inv.fileObj,
      invoiceRef: inv.id,
      priority: reqPriority,
    };
    setRequests(prev => [n, ...prev]);
    // Bump the cumulative requested amount on the parent invoice.
    setInvoices(prev => prev.map(x => x.id === inv.id ? { ...x, requestedAmount: (x.requestedAmount ?? 0) + val } : x));
    logActivity({ icon: "request_quote", color: "#e30613", route: "/orders", text: "Payment request raised for", bold: inv.project, detail: `Payment request ${n.id} for ${inv.vendor} (₹${val.toLocaleString("en-IN")}) raised against invoice ${inv.id}.` });
    setRaisingReqInv(null);
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
  // Site-expense approval chain: PM → Billing → Accounts (paid). Each stage records the approver.
  function advanceExpense(id: string, stage: "pm" | "billing" | "accounts", by: string) {
    setExpenses(prev => prev.map(x => {
      if (x.id !== id) return x;
      if (stage === "pm")      return { ...x, status: "Pending Billing Approval", pmApprovedBy: by };
      if (stage === "billing") return { ...x, status: "Pending Accounts Approval", billingApprovedBy: by };
      return { ...x, status: "Paid", accountsApprovedBy: by };
    }));
    const exp = expenses.find(x => x.id === id);
    if (exp) {
      const label = stage === "pm" ? "PM-approved" : stage === "billing" ? "billing-approved" : "approved & paid by accounts";
      logActivity({ icon: stage === "accounts" ? "payments" : "fact_check", color: stage === "accounts" ? "#16a34a" : "#0059a8", route: "/orders", text: `Site expense ${label} for`, bold: exp.project, detail: `Expense ${exp.id} (${exp.amount}) ${label} by ${by} — ${exp.description}.` });
    }
  }
  function rejectExpense(id: string) {
    setExpenses(prev => prev.map(x => x.id === id ? { ...x, status: "Rejected" } : x));
    setOpenMenu(null);
  }
  // Open the approver prompt for the expense's current stage.
  function askApproveExpense(exp: Expense) {
    if (exp.status === "Pending PM Approval")
      askApprover({ title:`Approve expense ${exp.id}`, label:"PM Approver Name", cta:"Approve (PM)", defaultName: selectedProject?.engineer ?? "", run:(name)=>advanceExpense(exp.id, "pm", name) });
    else if (exp.status === "Pending Billing Approval")
      askApprover({ title:`Approve expense ${exp.id}`, label:"Billing Approver Name", cta:"Approve (Billing)", defaultName:"Meera D.", run:(name)=>advanceExpense(exp.id, "billing", name) });
    else if (exp.status === "Pending Accounts Approval")
      askApprover({ title:`Approve & pay expense ${exp.id}`, label:"Accounts Approver Name", cta:"Approve & Pay", defaultName:"Arjun K.", run:(name)=>advanceExpense(exp.id, "accounts", name) });
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

  function closeNewModal() {
    setShowNew(false);
    setUploadError(null);
    setNewInvFile(null);
    setExpenseFile(null);
    setInvLines([emptyInvLine()]);
  }

  // Cumulative base value (pre-GST) invoiced for a vendor on a project — PO utilization
  // is measured against the base value, not the GST-inclusive total. Rejected invoices
  // don't consume the PO.
  function vendorInvoiceTotal(vendorName: string, projectName: string) {
    return invoices
      .filter(i => i.project === projectName && i.vendor === vendorName && i.status !== "Rejected")
      .reduce((s, i) => s + (i.baseValue ?? i.amountNum), 0);
  }

  function submitNew() {
    if (activeTab === 0) {
      if (!newInvFile) return; // invoice file is required
      const vendorName  = (newForm.vendor || "").trim();
      const projectName = proj || newForm.project || "General";

      // Gate 1 — a purchase order must exist for this vendor on this project.
      const po = selectedProject ? getVendorPO(selectedProject.id, vendorName) : undefined;
      if (!vendorName || !po) {
        setUploadError("No purchase order exists for this vendor. Generate the PO on the Purchase Orders page before uploading an invoice.");
        return;
      }

      // Gate 1b — the vendor's acceptance letter must be uploaded against the PO first.
      if (!po.acceptanceFileName) {
        setUploadError(`Acceptance letter not uploaded for ${vendorName}'s purchase order (${po.poNumber}). Upload the acceptance on the Purchase Orders page before raising an invoice.`);
        return;
      }

      // Gate 2 — fixed contract period: the invoice date must fall inside the contract window.
      if (po.fixedContract) {
        const invDate = newForm.due || "";
        if (!invDate) {
          setUploadError(`${vendorName} has a fixed contract period — enter the invoice date so it can be checked against the contract window.`);
          return;
        }
        if ((po.contractStart && invDate < po.contractStart) || (po.contractEnd && invDate > po.contractEnd)) {
          setUploadError(
            `Invoice date ${invDate} is outside ${vendorName}'s fixed contract period ` +
            `(${po.contractStart ?? "—"} to ${po.contractEnd ?? "—"}). Invoices can only be filed within this window.`
          );
          return;
        }
      }

      // Gate 3 — at least one valid base value is needed to enforce the PO cap.
      // Only lines with a positive base count; line 1 is mandatory, the rest optional.
      const taxLines: TaxLine[] = invLines
        .map(l => ({ base: parseFloat(l.base || "0"), sgst: parseFloat(l.sgst || "0"), cgst: parseFloat(l.cgst || "0"), igst: parseFloat(l.igst || "0") }))
        .filter(l => l.base > 0);
      const baseVal = taxLines.reduce((s, l) => s + l.base, 0);
      const amt     = taxLines.reduce((s, l) => s + l.base + (l.base * (l.sgst + l.cgst + l.igst)) / 100, 0);
      if (!baseVal || baseVal <= 0) {
        setUploadError("Enter a valid base value so the total amount can be checked against the purchase order.");
        return;
      }

      // Gate 4 — cumulative base value must stay within the purchase order value (GST excluded).
      const already = vendorInvoiceTotal(vendorName, projectName);
      if (already + baseVal > po.poValue) {
        const remaining = po.poValue - already;
        setUploadError(
          `Invoice rejected — it would push the total base value for ${vendorName} to ₹${(already + baseVal).toLocaleString("en-IN")}, ` +
          `over the purchase order of ₹${po.poValue.toLocaleString("en-IN")} (₹${already.toLocaleString("en-IN")} already invoiced, ` +
          `₹${Math.max(0, remaining).toLocaleString("en-IN")} remaining).`
        );
        return;
      }

      const first = taxLines[0];
      const n: Invoice = {
        id: `SM-INV-${Date.now().toString().slice(-4)}`,
        vendor: vendorName,
        project: projectName,
        amount: `₹${amt.toLocaleString("en-IN")}`,
        amountNum: amt,
        due: newForm.due || "TBD",
        status: "Approval Pending",
        fileObj: newInvFile,
        taxLines,
        baseValue: baseVal,
        sgstPct: first.sgst,
        cgstPct: first.cgst,
        igstPct: first.igst,
        requestedAmount: 0,
      };
      setInvoices(prev => [n, ...prev]);
      setNewInvFile(null);
      setInvLines([emptyInvLine()]);
      setUploadError(null);
      logActivity({ icon: "cloud_upload", color: "#e30613", route: "/orders", text: "Invoice submitted for", bold: projectName, detail: `Invoice ${n.id} from ${vendorName} for ${n.amount} uploaded — awaiting project-manager approval.` });
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
      const amt = parseFloat(newForm.amount || "0");
      const n: Expense = {
        id: `EXP-${String(expenses.length + 1).padStart(3, "0")}`,
        category: newForm.category || "Miscellaneous",
        description: newForm.description || "—",
        project: newForm.project || proj || "General",
        amount: `₹${amt.toLocaleString("en-IN")}`,
        amountNum: amt,
        date: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }),
        by: "You",
        fileObj: expenseFile ?? undefined,
        status: "Pending PM Approval",
      };
      setExpenses(prev => [n, ...prev]);
      setExpenseFile(null);
      logActivity({ icon: "receipt_long", color: "#e30613", route: "/orders", text: "Site expense logged for", bold: n.project, detail: `${n.category} expense of ${n.amount} recorded — ${n.description}.` });
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
          {activeTab !== 1 && <button onClick={() => { setNewForm({}); setNewInvFile(null); setExpenseFile(null); setInvLines([emptyInvLine()]); setUploadError(null); setShowNew(true); }}
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
                      {["Invoice ID","Vendor","Project","Amount","PO Utilization","Overdue Days","Status","Actions"].map((h,i) => (
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
                        <td style={{ padding:"14px 20px", textAlign:"right" }}>
                          {inv.status === "Approved" && inv.amountPayable != null ? (
                            <div style={{ display:"flex", flexDirection:"column", gap:"2px", alignItems:"flex-end" }}>
                              <span style={{ fontSize:"13px", fontWeight:"600", color:"#16a34a" }}>₹{inv.amountPayable.toLocaleString("en-IN")}</span>
                              <span style={{ fontSize:"10px", color:"#999999" }}>Invoice {inv.amount}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize:"13px", fontWeight:"600", color:"#333333" }}>{inv.amount}</span>
                          )}
                        </td>
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
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>
                          {(() => {
                            const od = getOverdueDays(inv.pmApprovedAt);
                            return od == null
                              ? <span style={{ color:"#cccccc" }}>—</span>
                              : <span style={{ fontWeight:"bold", color: od > 0 ? "#a16207" : "#666666" }}>{od} {od === 1 ? "day" : "days"}</span>;
                          })()}
                        </td>
                        <td style={{ padding:"14px 20px" }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:"4px", alignItems:"flex-start" }}>
                            {badge(inv.status, INV_STYLE[inv.status])}
                            {inv.pmApprovedBy && <span style={{ fontSize:"10px", color:"#666666" }}>PM: {inv.pmApprovedBy}</span>}
                            {inv.accountsApprovedBy && <span style={{ fontSize:"10px", color:"#666666" }}>Accounts: {inv.accountsApprovedBy}</span>}
                            {inv.status === "Approved" && inv.amountPayable != null && (() => {
                              const payable   = inv.amountPayable ?? inv.amountNum;
                              const requested = inv.requestedAmount ?? 0;
                              const remaining = payable - requested;
                              const pct       = payable > 0 ? Math.min(100, (requested / payable) * 100) : 0;
                              return (
                                <div style={{ display:"flex", flexDirection:"column", gap:"3px", width:"150px" }}>
                                  <div style={{ height:"4px", width:"100%", background:"#e4e2e1", borderRadius:"2px", overflow:"hidden" }}>
                                    <div style={{ height:"100%", width:`${pct}%`, background: remaining <= 0 ? "#16a34a" : "#0059a8", transition:"width 0.3s" }} />
                                  </div>
                                  <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.05em", color: remaining <= 0 ? "#16a34a" : "#999999" }}>
                                    {remaining <= 0 ? "Fully requested" : `₹${requested.toLocaleString("en-IN")} req · ₹${remaining.toLocaleString("en-IN")} left`}
                                  </span>
                                </div>
                              );
                            })()}
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
                              const fullyRequested = inv.status === "Approved" && invoiceRemaining(inv) <= 0;
                              return (
                                <div style={{ position:"absolute", right:0, ...(rowIdx >= slice.length-2 ? {bottom:"100%",marginBottom:"4px"}:{top:"100%",marginTop:"4px"}), background:"white", border:"1px solid #e4e2e1", borderRadius:"8px", boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:70, minWidth:"200px", overflow:"hidden" }}>
                                  <button onClick={() => { setSlideInvId(inv.id); setOpenMenu(null); }} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#333333", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                    onMouseEnter={e=>{e.currentTarget.style.background="#f8f8f8";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                    <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>open_in_new</span> View Details
                                  </button>
                                  {/* Stage 1 — project manager approval */}
                                  {inv.status === "Approval Pending" && (
                                    <>
                                      <button onClick={() => askPmApproveInvoice(inv)} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#0059a8", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                        onMouseEnter={e=>{e.currentTarget.style.background="#eff6ff";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>fact_check</span> Approve (PM)
                                      </button>
                                      <button onClick={() => rejectInvoice(inv.id)} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#ba1a1a", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                        onMouseEnter={e=>{e.currentTarget.style.background="#fff0f0";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>block</span> Reject Invoice
                                      </button>
                                    </>
                                  )}
                                  {/* Stage 2 — accounts approval (TDS / advance / retention) */}
                                  {inv.status === "PM Approved" && (
                                    <>
                                      <button onClick={() => approveInvoice(inv.id)} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#16a34a", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                        onMouseEnter={e=>{e.currentTarget.style.background="#f0fdf4";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>verified</span> Approve (Accounts)
                                      </button>
                                      <button onClick={() => rejectInvoice(inv.id)} style={{ width:"100%", textAlign:"left", padding:"10px 16px", fontSize:"13px", color:"#ba1a1a", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}
                                        onMouseEnter={e=>{e.currentTarget.style.background="#fff0f0";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>block</span> Reject Invoice
                                      </button>
                                    </>
                                  )}
                                  {/* Raise Payment Request — only after approval, until fully requested */}
                                  {inv.status === "Approved" && (
                                    fullyRequested ? (
                                      <div style={{ padding:"10px 16px", fontSize:"13px", color:"#16a34a", display:"flex", alignItems:"center", gap:"8px", opacity:0.7 }}>
                                        <span className="material-symbols-outlined" style={{ fontSize:"15px" }}>check_circle</span> Fully Requested
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
        // Vendors with an approved advance — show consumption progress.
        const advanceVendors = (selectedProject ? getProjectVendorPOs(selectedProject.id) : [])
          .filter(po => po.advanceApproved && (po.advanceRequested ?? 0) > 0)
          .map(po => {
            const requested = po.advanceRequested ?? 0;
            const payable   = po.advancePayable ?? requested;
            const consumed  = po.advanceConsumed ?? 0;
            const remaining = Math.max(0, requested - consumed);
            const pct       = requested > 0 ? Math.min(100, (consumed / requested) * 100) : 0;
            return { id: po.id, vendorName: po.vendorName, requested, payable, consumed, remaining, pct, tdsPct: po.advanceTdsPct ?? 0 };
          });
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          {advanceVendors.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:"12px" }}>
              {advanceVendors.map(av => (
                <div key={av.id} style={{ background:"white", border:"1px solid rgba(202,138,4,0.3)", borderRadius:"10px", padding:"14px 16px", display:"flex", flexDirection:"column", gap:"8px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize:"18px", color:"#a16207" }}>savings</span>
                    <span style={{ fontSize:"13px", fontWeight:"bold", color:"#333333", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{av.vendorName}</span>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.05em", color:"#a16207", background:"rgba(202,138,4,0.1)", border:"1px solid rgba(202,138,4,0.25)", borderRadius:"999px", padding:"2px 8px", whiteSpace:"nowrap" }}>Advance Tracking</span>
                  </div>
                  <div style={{ fontSize:"11px", color:"#666666" }}>
                    Requested: ₹{av.requested.toLocaleString("en-IN")} · Payable: ₹{av.payable.toLocaleString("en-IN")} (TDS {av.tdsPct}%)
                  </div>
                  <div style={{ height:"6px", width:"100%", background:"#e4e2e1", borderRadius:"3px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${av.pct}%`, background: av.remaining <= 0 ? "#16a34a" : "#a16207", transition:"width 0.3s" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"#666666" }}>
                    <span>Consumed: ₹{av.consumed.toLocaleString("en-IN")}</span>
                    <span style={{ fontWeight:"bold", color: av.remaining <= 0 ? "#16a34a" : "#a16207" }}>
                      {av.remaining <= 0 ? "Fully consumed" : `₹${av.remaining.toLocaleString("en-IN")} remaining`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                            <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
                              <span style={{ fontSize:"13px", fontWeight:"bold", color:"#e30613" }}>{r.id}</span>
                              {r.priority && badge(r.priority, PRIORITY_STYLE[r.priority])}
                            </div>
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
                        <td style={{ padding:"14px 20px" }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                            <span style={{ fontSize:"13px", color:"#333333" }}>{r.vendor}</span>
                            {r.notes && <span style={{ fontSize:"10px", color:"#999999", fontStyle:"italic", maxWidth:"220px", lineHeight:1.4 }}>{r.notes}</span>}
                          </div>
                        </td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{r.project}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", fontWeight:"600", color:"#333333", textAlign:"right" }}>{r.amount}</td>
                        <td style={{ padding:"14px 20px", fontSize:"13px", color:"#666666" }}>{r.requested}</td>
                        <td style={{ padding:"14px 20px" }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:"4px", alignItems:"flex-start" }}>
                            {badge(r.status, REQ_STYLE[r.status])}
                            {r.accountsApprovedBy && <span style={{ fontSize:"10px", color:"#666666" }}>Accounts: {r.accountsApprovedBy}</span>}
                            {r.paidBy && <span style={{ fontSize:"10px", color:"#666666" }}>Paid: {r.paidBy}</span>}
                          </div>
                        </td>
                        <td style={{ padding:"14px 20px" }}>
                          <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                            {r.status === "Pending Accounts Approval" && (
                              <button onClick={() => askApprover({ title:`Approve payment ${r.id}`, label:"Accounts Approver Name", cta:"Approve", defaultName:"Arjun K.", run:(name)=>approveReqByAccounts(r.id, name) })} style={{ padding:"4px 12px", border:"1px solid rgba(34,197,94,0.3)", borderRadius:"6px", fontSize:"11px", fontWeight:"bold", color:"#16a34a", background:"rgba(34,197,94,0.05)", cursor:"pointer" }}>Approve (Accounts)</button>
                            )}
                            {r.status === "Approved by Accounts" && (
                              <button onClick={() => askApprover({ title:`Mark ${r.id} paid`, label:"Paid By Name", cta:"Mark Paid", defaultName: r.accountsApprovedBy ?? "Arjun K.", run:(name)=>markReqPaid(r.id, name) })} style={{ padding:"4px 12px", border:"1px solid rgba(0,89,168,0.3)", borderRadius:"6px", fontSize:"11px", fontWeight:"bold", color:"#0059a8", background:"rgba(0,89,168,0.05)", cursor:"pointer" }}>Mark Paid</button>
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:"12px" }}>
              {[
                { label:"Total Spent",    value:`₹${totalAmt.toLocaleString()}`, color:"#e30613" },
                { label:"Materials",      value:`₹${(catMap["Materials"]??0).toLocaleString()}`,     color:"#333333" },
                { label:"Labor",          value:`₹${(catMap["Labor"]??0).toLocaleString()}`,         color:"#333333" },
                { label:"Equipment",      value:`₹${(catMap["Equipment"]??0).toLocaleString()}`,     color:"#333333" },
                { label:"Miscellaneous",  value:`₹${(catMap["Miscellaneous"]??0).toLocaleString()}`, color:"#333333" },
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
                        {["ID","Category","Description","Project","Amount","Date","By","Status",""].map((h,i) => (
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
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px", alignItems:"flex-start" }}>
                              {badge(x.status, EXP_STYLE[x.status])}
                              {x.pmApprovedBy && <span style={{ fontSize:"10px", color:"#666666" }}>PM: {x.pmApprovedBy}</span>}
                              {x.billingApprovedBy && <span style={{ fontSize:"10px", color:"#666666" }}>Billing: {x.billingApprovedBy}</span>}
                              {x.accountsApprovedBy && <span style={{ fontSize:"10px", color:"#666666" }}>Accounts: {x.accountsApprovedBy}</span>}
                            </div>
                          </td>
                          <td style={{ padding:"14px 20px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                              {x.status !== "Paid" && x.status !== "Rejected" && (
                                <>
                                  <button onClick={() => askApproveExpense(x)}
                                    style={{ padding:"4px 10px", border:"1px solid rgba(34,197,94,0.3)", borderRadius:"6px", background:"rgba(34,197,94,0.05)", cursor:"pointer", fontSize:"11px", fontWeight:"bold", color:"#16a34a" }}>
                                    {x.status === "Pending PM Approval" ? "Approve (PM)" : x.status === "Pending Billing Approval" ? "Approve (Billing)" : "Approve & Pay"}
                                  </button>
                                  <button onClick={() => rejectExpense(x.id)}
                                    style={{ padding:"4px 8px", border:"1px solid rgba(186,26,26,0.3)", borderRadius:"6px", background:"#fff5f5", cursor:"pointer", display:"flex" }} title="Reject">
                                    <span className="material-symbols-outlined" style={{ fontSize:"14px", color:"#ba1a1a" }}>block</span>
                                  </button>
                                </>
                              )}
                              {x.fileObj ? (
                                <button onClick={() => setViewExpenseVoucher(x)}
                                  style={{ padding:"4px 8px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px", fontSize:"11px", fontWeight:"bold", color:"#e30613" }}
                                  title="View Voucher">
                                  <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>receipt_long</span> View Bill
                                </button>
                              ) : (
                                <span style={{ fontSize:"11px", color:"#cccccc" }}>No file</span>
                              )}
                              <button onClick={() => deleteExpense(x.id)} style={{ padding:"4px 8px", border:"1px solid #fdd", borderRadius:"6px", background:"#fff5f5", cursor:"pointer", display:"flex" }}>
                                <span className="material-symbols-outlined" style={{ fontSize:"14px", color:"#ba1a1a" }}>delete</span>
                              </button>
                            </div>
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
                  {/* Overdue tracking — starts at PM approval */}
                  {slideInv.pmApprovedAt && (() => {
                    const od = getOverdueDays(slideInv.pmApprovedAt);
                    return (
                      <section>
                        <h4 style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", color:"#999999", marginBottom:"8px" }}>Overdue Tracking</h4>
                        <div style={{ background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"8px", padding:"14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <p style={{ fontSize:"11px", color:"#666666" }}>PM Approved</p>
                            <p style={{ fontSize:"14px", fontWeight:"bold", color:"#333333" }}>{slideInv.pmApprovedAt}</p>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <p style={{ fontSize:"11px", color:"#666666" }}>Overdue</p>
                            <p style={{ fontSize:"18px", fontWeight:"bold", color: (od ?? 0) > 0 ? "#a16207" : "#16a34a" }}>{od} {od === 1 ? "day" : "days"}</p>
                          </div>
                        </div>
                      </section>
                    );
                  })()}
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
                      <button onClick={() => askPmApproveInvoice(slideInv)}
                        style={{ flex:2, padding:"12px", border:"none", borderRadius:"8px", background:"#0059a8", color:"white", fontWeight:"bold", cursor:"pointer", fontSize:"13px", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>fact_check</span>
                        Approve (PM)
                      </button>
                    </div>
                  )}
                  {slideInv.status === "PM Approved" && (
                    <div style={{ display:"flex", gap:"10px" }}>
                      <button onClick={() => rejectInvoice(slideInv.id)}
                        style={{ flex:1, padding:"12px", border:"1px solid rgba(186,26,26,0.3)", borderRadius:"8px", background:"rgba(186,26,26,0.05)", color:"#ba1a1a", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>
                        Reject
                      </button>
                      <button onClick={() => approveInvoice(slideInv.id)}
                        style={{ flex:2, padding:"12px", border:"none", borderRadius:"8px", background:"#16a34a", color:"white", fontWeight:"bold", cursor:"pointer", fontSize:"13px", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>verified</span>
                        Approve (Accounts)
                      </button>
                    </div>
                  )}
                  {slideInv.status === "Approved" && (() => {
                    const fullyRequested = invoiceRemaining(slideInv) <= 0;
                    return fullyRequested ? (
                      <div style={{ padding:"10px 14px", background:"rgba(34,197,94,0.05)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:"6px", fontSize:"13px", color:"#16a34a", display:"flex", alignItems:"center", gap:"8px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>check_circle</span>
                        Fully requested — amount payable cleared
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

      {/* ── Expense Voucher Preview ────────────────────── */}
      {mounted && viewExpenseVoucher && createPortal(
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }} onClick={() => setViewExpenseVoucher(null)}>
          <div style={{ background:"white", border:"1px solid #e4e2e1", width:"100%", maxWidth:"720px", borderRadius:"8px", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.25)", display:"flex", flexDirection:"column", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", alignItems:"center", gap:"12px", flexShrink:0 }}>
              <span className="material-symbols-outlined" style={{ color:"#e30613" }}>receipt_long</span>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Expense Voucher · {viewExpenseVoucher.id}</p>
                <p style={{ fontSize:"14px", fontWeight:"600", color:"#333333" }}>{viewExpenseVoucher.description} — {viewExpenseVoucher.amount}</p>
              </div>
              <button onClick={() => setViewExpenseVoucher(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#666666", display:"flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ flex:1, overflow:"auto", minHeight:"300px" }}>
              {voucherPreviewUrl && viewExpenseVoucher.fileObj?.type === "application/pdf" && (
                <iframe src={voucherPreviewUrl} title="Voucher" style={{ width:"100%", height:"580px", border:"none", display:"block" }} />
              )}
              {voucherPreviewUrl && viewExpenseVoucher.fileObj?.type.startsWith("image/") && (
                <div style={{ background:"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center", minHeight:"300px" }}>
                  <img src={voucherPreviewUrl} alt="Voucher" style={{ maxWidth:"100%", maxHeight:"70vh", objectFit:"contain" }} />
                </div>
              )}
              {voucherPreviewUrl && !viewExpenseVoucher.fileObj?.type.startsWith("image/") && viewExpenseVoucher.fileObj?.type !== "application/pdf" && (
                <div style={{ padding:"24px", textAlign:"center", fontSize:"14px", color:"#666666" }}>
                  File type not previewable ({viewExpenseVoucher.fileObj?.name})
                </div>
              )}
            </div>
            {voucherPreviewUrl && (
              <div style={{ padding:"12px 20px", borderTop:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"flex-end", gap:"8px", flexShrink:0 }}>
                <a href={voucherPreviewUrl} download={viewExpenseVoucher.fileObj?.name}
                  style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", fontSize:"13px", textDecoration:"none", display:"flex", alignItems:"center", gap:"6px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>download</span> Download
                </a>
                <button onClick={() => setViewExpenseVoucher(null)} style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>Close</button>
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
              <button onClick={closeNewModal} style={{ background:"none", border:"none", cursor:"pointer", color:"#666666", display:"flex" }}>
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
                // Aggregate across every base-value line that has a positive base.
                const parsedLines  = invLines.map(l => ({ base: parseFloat(l.base || "0"), sgst: parseFloat(l.sgst || "0"), cgst: parseFloat(l.cgst || "0"), igst: parseFloat(l.igst || "0") }));
                const baseValueVal = parsedLines.reduce((s, l) => s + (l.base > 0 ? l.base : 0), 0);
                const amtNum       = parsedLines.reduce((s, l) => s + (l.base > 0 ? l.base + (l.base * (l.sgst + l.cgst + l.igst)) / 100 : 0), 0);
                const overCap      = !!selPO && baseValueVal > 0 && baseValueVal > remaining;
                const setLine = (idx: number, key: keyof InvLineForm, value: string) => {
                  setInvLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
                  setUploadError(null);
                };

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

                    {/* Fixed contract period notice */}
                    {selPO?.fixedContract && (
                      <div style={{ padding:"10px 12px", background:"rgba(0,89,168,0.05)", border:"1px solid rgba(0,89,168,0.25)", borderRadius:"6px", display:"flex", gap:"8px", alignItems:"flex-start" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#0059a8", flexShrink:0 }}>event_available</span>
                        <span style={{ fontSize:"11px", color:"#0059a8", lineHeight:1.5 }}>
                          {selVendor} is on a fixed contract. The invoice date must be between <strong>{selPO.contractStart ?? "—"}</strong> and <strong>{selPO.contractEnd ?? "—"}</strong>.
                        </span>
                      </div>
                    )}

                    {/* Invoice date */}
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Invoice Date</label>
                      <input type="date" value={f("due")} onChange={e=>sf("due",e.target.value)} style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>

                    {/* Base-value lines — up to four, each with its own GST. Line 1 is required. */}
                    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Base Values &amp; GST</label>
                      {invLines.map((line, idx) => (
                        <div key={idx} style={{ border:"1px solid #e4e2e1", borderRadius:"8px", padding:"12px", display:"flex", flexDirection:"column", gap:"10px", background: idx === 0 ? "#ffffff" : "#fbfbfb" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <span style={{ fontSize:"10px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>
                              Base Value {idx + 1}{idx === 0 ? <span style={{ color:"#e30613" }}> *</span> : <span style={{ color:"#999999", fontWeight:"normal", textTransform:"none" }}> (optional)</span>}
                            </span>
                            {idx > 0 && (
                              <button type="button" onClick={() => { setInvLines(prev => prev.filter((_, i) => i !== idx)); setUploadError(null); }}
                                style={{ background:"none", border:"none", cursor:"pointer", color:"#999999", display:"flex", alignItems:"center" }} title="Remove this base value">
                                <span className="material-symbols-outlined" style={{ fontSize:"18px" }}>close</span>
                              </button>
                            )}
                          </div>
                          <input type="number" min="0" value={line.base} onChange={e => setLine(idx, "base", e.target.value)} placeholder="Base value (₹)"
                            style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px" }}>
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                              <label style={{ fontSize:"10px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>SGST %</label>
                              <input type="number" min="0" value={line.sgst} onChange={e => setLine(idx, "sgst", e.target.value)} placeholder="9"
                                style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"9px 10px", fontSize:"13px", outline:"none" }} />
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                              <label style={{ fontSize:"10px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>CGST %</label>
                              <input type="number" min="0" value={line.cgst} onChange={e => setLine(idx, "cgst", e.target.value)} placeholder="9"
                                style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"9px 10px", fontSize:"13px", outline:"none" }} />
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                              <label style={{ fontSize:"10px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>IGST %</label>
                              <input type="number" min="0" value={line.igst} onChange={e => setLine(idx, "igst", e.target.value)} placeholder="0"
                                style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"9px 10px", fontSize:"13px", outline:"none" }} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {invLines.length < MAX_TAX_LINES && (
                        <button type="button" onClick={() => setInvLines(prev => [...prev, emptyInvLine()])}
                          style={{ alignSelf:"flex-start", display:"flex", alignItems:"center", gap:"6px", border:"1px dashed #e4e2e1", borderRadius:"6px", background:"white", color:"#e30613", fontSize:"12px", fontWeight:"bold", padding:"8px 12px", cursor:"pointer" }}>
                          <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>add</span>
                          Add base value ({invLines.length}/{MAX_TAX_LINES})
                        </button>
                      )}
                    </div>

                    <div style={{ display:"flex", flexDirection:"column", gap:"6px", background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"8px", padding:"12px" }}>
                      <span style={{ fontSize:"10px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>Calculated Invoice Total</span>
                      <span style={{ fontSize:"18px", fontWeight:"bold", color: overCap ? "#ba1a1a" : "#333333" }}>
                        ₹{amtNum.toLocaleString("en-IN")}
                      </span>
                      {overCap && (
                        <span style={{ fontSize:"11px", color:"#ba1a1a" }}>Total base value exceeds remaining PO balance by ₹{(baseValueVal - remaining).toLocaleString("en-IN")}</span>
                      )}
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
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Amount (₹) <span style={{ color:"#e30613" }}>*</span></label>
                      <input type="number" value={f("amount")} onChange={e=>sf("amount",e.target.value)} placeholder="0.00" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Description <span style={{ color:"#e30613" }}>*</span></label>
                    <input value={f("description")} onChange={e=>sf("description",e.target.value)} placeholder="e.g. Cement bags – 50 units" style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Bill or Cash Voucher <span style={{ color:"#e30613" }}>*</span></label>
                    <input ref={expenseFileRef} type="file" accept=".pdf,.jpg,.png,.jpeg" style={{ display:"none" }}
                      onChange={e => setExpenseFile(e.target.files?.[0] ?? null)} />
                    {expenseFile ? (
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"6px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize:"16px", color:"#e30613" }}>description</span>
                          <span style={{ fontSize:"13px", color:"#333333" }}>{expenseFile.name}</span>
                        </div>
                        <button onClick={() => setExpenseFile(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#999999", display:"flex" }}>
                          <span className="material-symbols-outlined" style={{ fontSize:"16px" }}>close</span>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => expenseFileRef.current?.click()}
                        style={{ padding:"14px", border:"2px dashed #e4e2e1", borderRadius:"6px", background:"#f8f8f8", color:"#666666", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize:"20px" }}>upload_file</span>
                        Upload Bill or Cash Voucher (PDF, JPG, PNG) — required
                      </button>
                    )}
                    <p style={{ fontSize:"11px", color:"#0059a8", display:"flex", alignItems:"center", gap:"6px", lineHeight:1.5 }}>
                      <span className="material-symbols-outlined" style={{ fontSize:"14px", flexShrink:0 }}>qr_code_2</span>
                      In case of bill with Gpay, Add qr code in same pdf file and upload
                    </p>
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
              <button onClick={closeNewModal} style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>Cancel</button>
              {(() => {
                const hasPOForProject = selectedProject ? getProjectVendorPOs(selectedProject.id).length > 0 : false;
                const disabled = 
                  (activeTab === 0 && (
                    !hasPOForProject || !newInvFile || !f("vendor") || !(parseFloat(invLines[0]?.base || "0") > 0)
                  )) ||
                  (activeTab === 2 && (
                    !expenseFile || !(parseFloat(f("amount") || "0") > 0) || !f("description")
                  ));
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

      {/* ── Approve Invoice Modal ───────────────────────────────── */}
      {mounted && approvingInvId && (() => {
        const inv = invoices.find(x => x.id === approvingInvId);
        if (!inv) return null;
        // File objects don't survive localStorage (they rehydrate as {}), so only
        // create a preview URL when we actually have a Blob/File in memory.
        const previewUrl = inv.fileObj instanceof Blob ? URL.createObjectURL(inv.fileObj) : null;

        return createPortal(
          <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
            <div style={{ background:"white", border:"1px solid #e4e2e1", width:"100%", maxWidth:"720px", borderRadius:"8px", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding:"16px 24px", borderBottom:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                <h3 style={{ fontSize:"20px", fontWeight:"bold", color:"#333333" }}>Approve Vendor Invoice</h3>
                <button onClick={() => setApprovingInvId(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#666666", display:"flex" }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div style={{ padding:"24px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"16px", flex:1 }}>
                
                {/* Invoice Information Display */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", background:"#f8f8f8", borderRadius:"6px", padding:"12px", border:"1px solid #e4e2e1" }}>
                  <div>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Invoice ID</span>
                    <p style={{ fontSize:"13px", fontWeight:"bold", color:"#333333" }}>{inv.id}</p>
                  </div>
                  <div>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Vendor</span>
                    <p style={{ fontSize:"13px", fontWeight:"bold", color:"#333333" }}>{inv.vendor}</p>
                  </div>
                  <div>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Project</span>
                    <p style={{ fontSize:"13px", color:"#666666" }}>{inv.project}</p>
                  </div>
                  <div>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Total Invoice Amount</span>
                    <p style={{ fontSize:"13px", fontWeight:"bold", color:"#e30613" }}>
                      ₹{(approveTaxLines.reduce((s, l) => s + l.base + (l.base * (l.sgst + l.cgst + l.igst)) / 100, 0) + parseFloat(approveOtherCharges || "0")).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Optional Document Preview */}
                {previewUrl && inv.fileObj instanceof Blob && (
                  <div style={{ border:"1px solid #e4e2e1", borderRadius:"6px", overflow:"hidden" }}>
                    <span style={{ fontSize:"10px", fontWeight:"bold", textTransform:"uppercase", color:"#999999", padding:"6px 12px", display:"block", background:"#f8f8f8", borderBottom:"1px solid #e4e2e1" }}>Attached Document</span>
                    {inv.fileObj.type === "application/pdf" && previewUrl ? (
                      <iframe src={previewUrl} title="Invoice preview" style={{ width:"100%", height:"180px", border:"none" }} />
                    ) : previewUrl ? (
                      <img src={previewUrl} alt="Invoice preview" style={{ width:"100%", maxHeight:"180px", objectFit:"contain", background:"#f0f0f0" }} />
                    ) : null}
                  </div>
                )}

                {/* Approval Inputs Form */}
                <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Accounts Approver Name</label>
                    <input value={approveBy} onChange={e => setApproveBy(e.target.value)} placeholder="e.g. Arjun K."
                      style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Approval Remarks / Notes</label>
                    <textarea 
                      value={approveRemarks} 
                      onChange={e => setApproveRemarks(e.target.value)} 
                      rows={2} 
                      placeholder="Add remarks or instructions for finance/accounts team..." 
                      style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none", resize:"none", fontFamily:"inherit" }} 
                    />
                  </div>

                  <div style={{ borderTop:"1px solid #e4e2e1", paddingTop:"12px", marginTop:"4px", display:"flex", flexDirection:"column", gap:"14px" }}>
                    <span style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Base Values &amp; GST</span>
                    {/* Per-line GST — accounts confirm/adjust each base value's SGST/CGST/IGST. */}
                    {approveTaxLines.map((line, idx) => {
                      const setGst = (key: "sgst" | "cgst" | "igst", value: number) =>
                        setApproveTaxLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
                      return (
                        <div key={idx} style={{ border:"1px solid #e4e2e1", borderRadius:"8px", padding:"12px", display:"flex", flexDirection:"column", gap:"10px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#666666" }}>
                            <span>Base Value {approveTaxLines.length > 1 ? idx + 1 : ""}</span>
                            <span style={{ fontWeight:600, color:"#333333" }}>₹{line.base.toLocaleString("en-IN")}</span>
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px" }}>
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                              <label style={{ fontSize:"10px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>SGST %</label>
                              <input type="number" min="0" value={line.sgst} onChange={e => setGst("sgst", Number(e.target.value) || 0)}
                                style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"9px 10px", fontSize:"13px", outline:"none" }} />
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                              <label style={{ fontSize:"10px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>CGST %</label>
                              <input type="number" min="0" value={line.cgst} onChange={e => setGst("cgst", Number(e.target.value) || 0)}
                                style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"9px 10px", fontSize:"13px", outline:"none" }} />
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                              <label style={{ fontSize:"10px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>IGST %</label>
                              <input type="number" min="0" value={line.igst} onChange={e => setGst("igst", Number(e.target.value) || 0)}
                                style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"9px 10px", fontSize:"13px", outline:"none" }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Other charges — flat add-on, part of the TDS base */}
                    <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                      <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Other Charges (₹)</label>
                      <input type="number" min="0" value={approveOtherCharges} onChange={e => setApproveOtherCharges(e.target.value)} placeholder="0.00"
                        style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                      <span style={{ fontSize:"10px", color:"#999999" }}>Freight, handling, etc. Added to the amount payable and the TDS base.</span>
                    </div>
                    <span style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Financial Breakdown</span>
                    {(() => {
                      const advRemaining = vendorAdvanceRemaining(inv.vendor);
                      const otherCharges = parseFloat(approveOtherCharges || "0");
                      const { baseSum: base, subtotal, deduct, afterAdvance, tdsAmount, retentionAmt } = computeApproval({
                        lines: approveTaxLines, otherCharges, tdsPct: approveTdsPct,
                        deductFromAdvance, advanceDeductAmt: parseFloat(advanceDeductAmt || "0"), holdRetention, advRemaining,
                      });
                      const sgstAmount   = approveTaxLines.reduce((s, l) => s + l.base * l.sgst / 100, 0);
                      const cgstAmount   = approveTaxLines.reduce((s, l) => s + l.base * l.cgst / 100, 0);
                      const igstAmount   = approveTaxLines.reduce((s, l) => s + l.base * l.igst / 100, 0);
                      const rowStyle: React.CSSProperties = { display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#666666" };
                      return (
                        <>
                          {/* Advance deduction — only when vendor has an approved advance left */}
                          {advRemaining > 0 && (
                            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                              <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
                                <input type="checkbox" checked={deductFromAdvance} onChange={e => setDeductFromAdvance(e.target.checked)} style={{ width:"16px", height:"16px", accentColor:"#e30613" }} />
                                <span style={{ fontSize:"13px", fontWeight:"500", color:"#333333" }}>Deduct from Advance</span>
                                <span style={{ fontSize:"11px", color:"#a16207", marginLeft:"auto" }}>₹{advRemaining.toLocaleString("en-IN")} available</span>
                              </label>
                              {deductFromAdvance && (
                                <input type="number" min="0" max={Math.min(subtotal, advRemaining)} value={advanceDeductAmt} onChange={e => setAdvanceDeductAmt(e.target.value)}
                                  style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                              )}
                            </div>
                          )}
                          {/* TDS % */}
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                              <label style={{ fontSize:"11px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>TDS %</label>
                              <select value={approveTdsPct} onChange={e => setApproveTdsPct(Number(e.target.value))}
                                style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none", background:"white" }}>
                                <option value={0}>No TDS</option>
                                {[1,2,10].map(p => <option key={p} value={p}>{p}%</option>)}
                              </select>
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                              <label style={{ fontSize:"11px", fontWeight:"bold", color:"#666666", textTransform:"uppercase" }}>TDS Amount</label>
                              <div style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", background:"#f8f8f8", color:"#ba1a1a", fontWeight:"bold" }}>−₹{tdsAmount.toLocaleString("en-IN")}</div>
                            </div>
                          </div>
                          {/* Retention */}
                          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                            <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
                              <input type="checkbox" checked={holdRetention} onChange={e => setHoldRetention(e.target.checked)} style={{ width:"16px", height:"16px", accentColor:"#e30613" }} />
                              <span style={{ fontSize:"13px", fontWeight:"500", color:"#333333" }}>Hold 5% Retention</span>
                              {holdRetention && <span style={{ fontSize:"11px", color:"#a16207", marginLeft:"auto" }}>₹{retentionAmt.toLocaleString("en-IN")}</span>}
                            </label>
                            {holdRetention && (
                              <>
                                <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", paddingLeft:"24px" }}>
                                  <input type="checkbox" checked={retentionEarly} onChange={e => setRetentionEarly(e.target.checked)} style={{ width:"15px", height:"15px", accentColor:"#0059a8" }} />
                                  <span style={{ fontSize:"12px", color:"#333333" }}>Allow early payment (bypass 12-month hold)</span>
                                </label>
                                <span style={{ fontSize:"10px", color:"#999999" }}>
                                  {retentionEarly
                                    ? "Retention may be paid before 12 months — the held amount becomes requestable immediately."
                                    : "Retention releasable 12 months after project completion."}
                                </span>
                              </>
                            )}
                          </div>
                          {/* Summary */}
                          <div style={{ background:"#f8f8f8", border:"1px solid #e4e2e1", borderRadius:"8px", padding:"12px 14px", display:"flex", flexDirection:"column", gap:"5px" }}>
                            <div style={rowStyle}><span>Base Value{approveTaxLines.length > 1 ? ` (${approveTaxLines.length} lines)` : ""}</span><span style={{ color:"#333333", fontWeight:600 }}>₹{base.toLocaleString("en-IN")}</span></div>
                            {sgstAmount > 0 && <div style={rowStyle}><span>SGST</span><span style={{ color:"#333333", fontWeight:600 }}>+₹{sgstAmount.toLocaleString("en-IN")}</span></div>}
                            {cgstAmount > 0 && <div style={rowStyle}><span>CGST</span><span style={{ color:"#333333", fontWeight:600 }}>+₹{cgstAmount.toLocaleString("en-IN")}</span></div>}
                            {igstAmount > 0 && <div style={rowStyle}><span>IGST</span><span style={{ color:"#333333", fontWeight:600 }}>+₹{igstAmount.toLocaleString("en-IN")}</span></div>}
                            {otherCharges > 0 && <div style={rowStyle}><span>Other Charges</span><span style={{ color:"#333333", fontWeight:600 }}>+₹{otherCharges.toLocaleString("en-IN")}</span></div>}
                            <div style={rowStyle}><span>Invoice Total</span><span style={{ color:"#333333", fontWeight:600 }}>₹{subtotal.toLocaleString("en-IN")}</span></div>
                            {deduct > 0 && <div style={rowStyle}><span>Advance Deducted</span><span style={{ color:"#ba1a1a", fontWeight:600 }}>−₹{deduct.toLocaleString("en-IN")}</span></div>}
                            <div style={rowStyle}><span>After Advance</span><span style={{ color:"#333333", fontWeight:600 }}>₹{afterAdvance.toLocaleString("en-IN")}</span></div>
                            <div style={rowStyle}><span>TDS ({approveTdsPct}%)</span><span style={{ color:"#ba1a1a", fontWeight:600 }}>−₹{tdsAmount.toLocaleString("en-IN")}</span></div>
                            {retentionAmt > 0 && <div style={rowStyle}><span>Retention (5%)</span><span style={{ color:"#ba1a1a", fontWeight:600 }}>−₹{retentionAmt.toLocaleString("en-IN")}</span></div>}
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"14px", fontWeight:"bold", borderTop:"1px solid #e4e2e1", paddingTop:"6px", marginTop:"2px" }}>
                              <span style={{ color:"#333333" }}>Amount Payable</span>
                              <span style={{ color:"#16a34a" }}>₹{parseFloat(amountPayable || "0").toLocaleString("en-IN")}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

              </div>
              <div style={{ padding:"16px 24px", borderTop:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"flex-end", gap:"10px", flexShrink:0 }}>
                <button onClick={() => setApprovingInvId(null)} style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>Cancel</button>
                <button onClick={submitApproveInvoice}
                  style={{ padding:"8px 24px", border:"none", borderRadius:"6px", background:"#16a34a", color:"white", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>
                  Confirm Approval
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ── Raise Payment Request Modal ─────────────────────────── */}
      {mounted && raisingReqInv && (() => {
        const inv       = raisingReqInv;
        const payable   = inv.amountPayable ?? inv.amountNum;
        const requested = inv.requestedAmount ?? 0;
        const remaining = invoiceRemaining(inv);
        const val       = parseFloat(reqValInput || "0");
        const invalid   = !(val > 0) || val > remaining;

        return createPortal(
          <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }} onClick={() => setRaisingReqInv(null)}>
            <div style={{ background:"white", border:"1px solid #e4e2e1", width:"100%", maxWidth:"520px", borderRadius:"8px", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding:"16px 24px", borderBottom:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                <h3 style={{ fontSize:"20px", fontWeight:"bold", color:"#333333" }}>Raise Payment Request</h3>
                <button onClick={() => setRaisingReqInv(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#666666", display:"flex" }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div style={{ padding:"24px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"16px", flex:1 }}>
                {/* Invoice payable summary */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", background:"#f8f8f8", borderRadius:"6px", padding:"12px", border:"1px solid #e4e2e1" }}>
                  <div>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Invoice</span>
                    <p style={{ fontSize:"13px", fontWeight:"bold", color:"#333333" }}>{inv.id}</p>
                  </div>
                  <div>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Vendor</span>
                    <p style={{ fontSize:"13px", fontWeight:"bold", color:"#333333" }}>{inv.vendor}</p>
                  </div>
                  <div>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Amount Payable</span>
                    <p style={{ fontSize:"13px", fontWeight:"bold", color:"#333333" }}>₹{payable.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Already Requested</span>
                    <p style={{ fontSize:"13px", fontWeight:"bold", color:"#333333" }}>₹{requested.toLocaleString("en-IN")}</p>
                  </div>
                  {(inv.retentionHeld && (inv.retentionAmount ?? 0) > 0) && (
                    <div style={{ gridColumn:"1 / -1" }}>
                      <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Retention Held (5%)</span>
                      {inv.retentionEarlyRelease ? (
                        <p style={{ fontSize:"13px", fontWeight:"bold", color:"#16a34a", display:"flex", alignItems:"center", gap:"4px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>lock_open</span>
                          ₹{(inv.retentionAmount ?? 0).toLocaleString("en-IN")} eligible for early release — included in remaining
                        </p>
                      ) : (
                        <p style={{ fontSize:"13px", fontWeight:"bold", color:"#a16207", display:"flex", alignItems:"center", gap:"4px" }}>
                          <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>lock</span>
                          ₹{(inv.retentionAmount ?? 0).toLocaleString("en-IN")} locked until 12 months after completion
                        </p>
                      )}
                    </div>
                  )}
                  <div style={{ gridColumn:"1 / -1" }}>
                    <span style={{ fontSize:"9px", fontWeight:"bold", textTransform:"uppercase", color:"#999999" }}>Maximum Remaining</span>
                    <p style={{ fontSize:"16px", fontWeight:"bold", color:"#16a34a" }}>₹{remaining.toLocaleString("en-IN")}</p>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Requested Amount (₹) <span style={{ color:"#e30613" }}>*</span></label>
                    <input type="number" min="0" max={remaining} value={reqValInput} onChange={e => setReqValInput(e.target.value)} placeholder="0.00"
                      style={{ border:`1px solid ${val > remaining ? "#ba1a1a" : "#e4e2e1"}`, borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Priority</label>
                    <select value={reqPriority} onChange={e => setReqPriority(e.target.value as "Low" | "Medium" | "High")}
                      style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none", background:"white", color:"#333333" }}>
                      {(["Low","Medium","High"] as const).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                  <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>Remarks</label>
                  <textarea value={reqRemarks} onChange={e => setReqRemarks(e.target.value)} rows={2} placeholder="Reason for this payment request…"
                    style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none", resize:"none", fontFamily:"inherit" }} />
                </div>

                {val > remaining && (
                  <div style={{ padding:"12px 14px", background:"rgba(186,26,26,0.06)", border:"1px solid rgba(186,26,26,0.3)", borderRadius:"6px", display:"flex", gap:"8px", alignItems:"flex-start" }}>
                    <span className="material-symbols-outlined" style={{ fontSize:"18px", color:"#ba1a1a", flexShrink:0 }}>error</span>
                    <span style={{ fontSize:"12px", color:"#ba1a1a", lineHeight:1.5 }}>
                      Requested amount exceeds the remaining payable by ₹{(val - remaining).toLocaleString("en-IN")}.
                    </span>
                  </div>
                )}
              </div>
              <div style={{ padding:"16px 24px", borderTop:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"flex-end", gap:"10px", flexShrink:0 }}>
                <button onClick={() => setRaisingReqInv(null)} style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>Cancel</button>
                <button onClick={submitRaiseRequest} disabled={invalid}
                  style={{ padding:"8px 24px", border:"none", borderRadius:"6px", background: invalid ? "#f0bcc0" : "#e30613", color:"white", fontWeight:"bold", cursor: invalid ? "not-allowed" : "pointer", fontSize:"13px" }}>
                  Create Request
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ── Approver Confirmation Modal ──────────────────────────── */}
      {mounted && confirmAction && createPortal(
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }} onClick={() => setConfirmAction(null)}>
          <div style={{ background:"white", border:"1px solid #e4e2e1", width:"100%", maxWidth:"420px", borderRadius:"8px", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"16px 24px", borderBottom:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h3 style={{ fontSize:"18px", fontWeight:"bold", color:"#333333" }}>{confirmAction.title}</h3>
              <button onClick={() => setConfirmAction(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#666666", display:"flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"6px" }}>
              <label style={{ fontSize:"11px", fontWeight:"bold", color:"#e30613", textTransform:"uppercase" }}>{confirmAction.label} <span style={{ color:"#e30613" }}>*</span></label>
              <input value={confirmName} onChange={e => setConfirmName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === "Enter" && confirmName.trim()) { confirmAction.run(confirmName.trim()); setConfirmAction(null); } }}
                placeholder="Enter approver name"
                style={{ border:"1px solid #e4e2e1", borderRadius:"6px", padding:"10px 12px", fontSize:"13px", outline:"none" }} />
            </div>
            <div style={{ padding:"16px 24px", borderTop:"1px solid #e4e2e1", background:"#f8f8f8", display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button onClick={() => setConfirmAction(null)} style={{ padding:"8px 20px", border:"1px solid #e4e2e1", borderRadius:"6px", background:"white", color:"#333333", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }}>Cancel</button>
              <button onClick={() => { if (confirmName.trim()) { confirmAction.run(confirmName.trim()); setConfirmAction(null); } }} disabled={!confirmName.trim()}
                style={{ padding:"8px 24px", border:"none", borderRadius:"6px", background: confirmName.trim() ? "#16a34a" : "#bbdcc4", color:"white", fontWeight:"bold", cursor: confirmName.trim() ? "pointer" : "not-allowed", fontSize:"13px" }}>
                {confirmAction.cta}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
