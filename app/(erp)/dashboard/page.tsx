"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "../../../contexts/ProjectContext";
import { useToast } from "@/lib/toast";

const statusStyle: Record<string, { bg: string; border: string; color: string }> = {
  "In Progress": { bg: "rgba(227,6,19,0.1)",  border: "rgba(227,6,19,0.2)",  color: "#e30613" },
  "Delayed":     { bg: "rgba(186,26,26,0.1)",  border: "rgba(186,26,26,0.2)",  color: "#ba1a1a" },
  "On Track":    { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.2)",  color: "#16a34a" },
  "New Site":    { bg: "rgba(0,89,168,0.1)",   border: "rgba(0,89,168,0.2)",   color: "#0059a8" },
  "Completed":   { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.2)",  color: "#16a34a" },
};

const quickActions = [
  { icon: "add_business",  label: "Add Project",       sub: "Create a new construction project", href: "/projects/new" },
  { icon: "flag",          label: "Raise a Snag",      sub: "Log a new issue on site",           href: "/snags" },
  { icon: "trending_up",   label: "Log Site Progress", sub: "Update completion percentage",      href: "/site-progress" },
  { icon: "receipt_long",  label: "Add Expense",       sub: "Record a vendor invoice or cost",   href: "/orders" },
  { icon: "cloud_upload",  label: "Upload Document",   sub: "Drawings, approvals, photos",       href: "/design" },
];

// Relative "time ago" label for activity timestamps.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { projects, selectedProject, vendorPOs, addVendorPO, acceptVendorPO, approveAdvance, getProjectVendorPOs, requests, activities } = useProject();
  const [showAdd, setShowAdd]         = useState(false);
  const [showPayable, setShowPayable] = useState(false);

  // ── Vendor / Purchase Order add flow ──────────────────────────────
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vendorForm, setVendorForm]       = useState({ vendorName: "", poNumber: "", poValue: "", fixedContract: false, contractStart: "", contractEnd: "" });
  const [poFile, setPoFile]               = useState<File | null>(null);

  // ── Acceptance stage flow (PO → acceptance + advance) ─────────────
  const [showAcceptance, setShowAcceptance] = useState<string | null>(null); // vendor PO id
  const [acceptFile, setAcceptFile]         = useState<File | null>(null);
  const [acceptAdvance, setAcceptAdvance]   = useState("");
  const acceptingPO = showAcceptance ? vendorPOs.find(v => v.id === showAcceptance) ?? null : null;
  const acceptValid =
    acceptFile != null &&
    Number(acceptAdvance) > 0 &&
    (!acceptingPO || Number(acceptAdvance) <= acceptingPO.poValue);

  // ── Advance approval flow (accounts picks TDS) ───────────────────
  const [approvingAdvance, setApprovingAdvance] = useState<string | null>(null); // vendor PO id
  const [advanceTdsPct, setAdvanceTdsPct]       = useState<number>(2);
  const advancePO = approvingAdvance ? vendorPOs.find(v => v.id === approvingAdvance) ?? null : null;
  const advReqAmount = advancePO?.advanceRequested ?? 0;
  const advTds       = advReqAmount * advanceTdsPct / 100;
  const advPayable   = advReqAmount - advTds;

  function submitApproveAdvance() {
    if (!advancePO) return;
    try {
      approveAdvance({ projectId: advancePO.projectId, vendorName: advancePO.vendorName, tdsPct: advanceTdsPct });
      toast.success("Advance approved", `${advancePO.vendorName}: ₹${advPayable.toLocaleString("en-IN")} payable after ${advanceTdsPct}% TDS.`);
      setApprovingAdvance(null);
      setAdvanceTdsPct(2);
    } catch (err) {
      console.error("[Dashboard] Failed to approve advance:", err);
      toast.error("Couldn't approve advance", "Something went wrong while saving. Please try again.");
    }
  }

  function submitAcceptance() {
    if (!acceptingPO || !acceptFile || !acceptValid) {
      toast.warning("Missing details", "Attach the acceptance document and enter an advance within the purchase-order value.");
      return;
    }
    try {
      acceptVendorPO({
        projectId: acceptingPO.projectId,
        vendorName: acceptingPO.vendorName,
        acceptanceFileName: acceptFile.name,
        advanceRequested: Number(acceptAdvance),
      });
      toast.success("Acceptance recorded", `${acceptingPO.vendorName} accepted — advance of ₹${Number(acceptAdvance).toLocaleString("en-IN")} pending approval.`);
      setShowAcceptance(null);
      setAcceptFile(null);
      setAcceptAdvance("");
    } catch (err) {
      console.error("[Dashboard] Failed to record acceptance:", err);
      toast.error("Couldn't record acceptance", "Something went wrong while saving. Please try again.");
    }
  }

  // Vendors shown: the selected project's, or all when viewing the overview.
  const vendorRows = selectedProject ? getProjectVendorPOs(selectedProject.id) : vendorPOs;
  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? "—";
  const totalPO = vendorRows.reduce((s, v) => s + v.poValue, 0);

  // Outstanding advances — advance paid to vendors, not yet offset (consumed) by their
  // invoices, across all pending (non-completed) projects. Always all projects/vendors,
  // independent of the selected-project filter.
  const isPendingProject = (id: string) => {
    const pr = projects.find(p => p.id === id);
    return !pr || pr.status !== "Completed";
  };
  const advanceRows = vendorPOs
    .filter(po => po.advanceApproved && isPendingProject(po.projectId))
    .map(po => {
      const requested   = po.advanceRequested ?? 0;
      const payable     = po.advancePayable ?? requested;
      const consumed    = po.advanceConsumed ?? 0;
      const outstanding = Math.max(0, requested - consumed);
      return { id: po.id, vendorName: po.vendorName, projectId: po.projectId, requested, payable, consumed, outstanding, tdsPct: po.advanceTdsPct ?? 0 };
    })
    .filter(r => r.outstanding > 0);
  const totalOutstandingAdvance = advanceRows.reduce((s, r) => s + r.outstanding, 0);

  // When a fixed contract period is requested, both dates are required and must be ordered.
  const contractDatesValid =
    !vendorForm.fixedContract ||
    (!!vendorForm.contractStart && !!vendorForm.contractEnd && vendorForm.contractStart <= vendorForm.contractEnd);

  const vendorFormValid =
    vendorForm.vendorName.trim() &&
    vendorForm.poNumber.trim() &&
    Number(vendorForm.poValue) > 0 &&
    poFile != null &&
    contractDatesValid;

  function submitVendor() {
    if (!selectedProject || !vendorFormValid || !poFile) {
      toast.warning("Missing details", "Fill in every field and attach the purchase-order document before saving.");
      return;
    }
    try {
      addVendorPO({
        projectId: selectedProject.id,
        vendorName: vendorForm.vendorName,
        poNumber: vendorForm.poNumber,
        poValue: Number(vendorForm.poValue),
        poFileName: poFile.name,
        fixedContract: vendorForm.fixedContract,
        contractStart: vendorForm.fixedContract ? vendorForm.contractStart : undefined,
        contractEnd: vendorForm.fixedContract ? vendorForm.contractEnd : undefined,
      });
      setVendorForm({ vendorName: "", poNumber: "", poValue: "", fixedContract: false, contractStart: "", contractEnd: "" });
      setPoFile(null);
      setShowAddVendor(false);
      toast.success("Vendor added", `${vendorForm.vendorName.trim()} was procured for ${selectedProject.name}.`);
    } catch (err) {
      console.error("[Dashboard] Failed to add vendor:", err);
      toast.error("Couldn't add vendor", "Something went wrong while saving. Please try again.");
    }
  }

  const onTrackCount   = projects.filter(p => p.status === "On Track" || p.status === "In Progress").length;
  const delayedCount   = projects.filter(p => p.status === "Delayed").length;
  const avgPct         = projects.length ? Math.round(projects.reduce((s, p) => s + p.pct, 0) / projects.length) : 0;
  // Total owed across all projects — every payment request not yet marked Paid.
  const payablePendingTotal = requests.filter(r => r.status !== "Paid").reduce((s, r) => s + r.amountNum, 0);
  const [showAll, setShowAll]         = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const activity = showAll ? activities : activities.slice(0, 4);

  function navigateTo(href: string) {
    setShowAdd(false);
    router.push(href);
  }

  return (
    <div style={{ paddingBottom: "120px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "#666666", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        <span>Main</span>
        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
        <span style={{ color: "#e30613" }}>Dashboard</span>
      </div>

      {/* Context Banner */}
      <div className="flex items-center gap-3 mb-8 px-4 py-3 bg-[#f8f8f8] border border-[#e4e2e1] rounded-lg">
        <span className="material-symbols-outlined text-[#e30613]" style={{ fontSize: "20px" }}>
          {selectedProject ? "apartment" : "monitoring"}
        </span>
        {selectedProject ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] text-[#666666]">Viewing:</span>
            <span className="text-[14px] font-bold text-[#333333]">{selectedProject.name}</span>
            <span className="text-[10px] text-[#666666]">•</span>
            <span className="text-[10px] text-[#666666]">{selectedProject.location}</span>
            <span className="text-[10px] text-[#666666]">•</span>
            <span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", whiteSpace: "nowrap", padding: "2px 8px", borderRadius: "999px", background: statusStyle[selectedProject.status]?.bg, border: `1px solid ${statusStyle[selectedProject.status]?.border}`, color: statusStyle[selectedProject.status]?.color }}>
              {selectedProject.status}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-[#333333]">Overview — All Projects</span>
            <span className="text-[10px] text-[#666666]">Showing aggregate stats across {projects.length} active sites</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {[
          { label: "Active Projects",  value: String(projects.length), icon: "rocket_launch",  sub: <><span style={{ fontWeight: "bold" }}>{projects.length}</span> sites currently managed</>, onClick: undefined as undefined | (() => void) },
          { label: "On Track",         value: String(onTrackCount),    icon: "trending_up",    sub: <><span style={{ color: "#16a34a", fontWeight: "bold" }}>{onTrackCount}</span> of {projects.length} progressing</>, onClick: undefined as undefined | (() => void) },
          { label: "Delayed",          value: String(delayedCount),    icon: "report_problem", sub: delayedCount > 0 ? <><span style={{ color: "#ba1a1a", fontWeight: "bold" }}>{delayedCount}</span> need{delayedCount === 1 ? "s" : ""} attention</> : <>All sites on schedule</>, onClick: undefined as undefined | (() => void) },
          { label: "Avg. Completion",  value: `${avgPct}%`,            icon: "donut_large",    sub: <>Across <span style={{ fontWeight: "bold" }}>all {projects.length} sites</span></>, onClick: undefined as undefined | (() => void) },
          { label: "Payable Pending",  value: `₹${payablePendingTotal.toLocaleString("en-IN")}`, icon: "account_balance_wallet", sub: <>Across all <span style={{ fontWeight: "bold" }}>unpaid payment requests</span> — <span style={{ color: "#e30613", fontWeight: "bold" }}>view breakdown</span></>, onClick: () => setShowPayable(true) },
          { label: "Outstanding Advance", value: `₹${totalOutstandingAdvance.toLocaleString("en-IN")}`, icon: "savings", sub: <>Advance paid, <span style={{ fontWeight: "bold" }}>not yet offset by invoices</span></>, onClick: undefined as undefined | (() => void) },
        ].map((kpi, i) => (
          <div key={i} onClick={kpi.onClick} title={kpi.onClick ? "View payable breakdown" : undefined} style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", padding: "24px", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", cursor: kpi.onClick ? "pointer" : "default" }}>
            {i === 0 && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "2px", background: "#e30613" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <span style={{ color: "#666666", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em" }}>{kpi.label}</span>
              <span className="material-symbols-outlined" style={{ color: "#e30613" }}>{kpi.icon}</span>
            </div>
            <div style={{ fontSize: "48px", fontWeight: "bold", lineHeight: 1, color: "#333333", marginBottom: "8px" }}>{kpi.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#666666", fontSize: "12px" }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Activity + Project Health */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <div className="lg:col-span-4">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333333" }}>Recent Activity</h2>
            <button
              onClick={() => setShowAll(v => !v)}
              style={{ color: "#e30613", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", background: "none", border: "none", cursor: "pointer" }}
            >
              {showAll ? "Show Less" : "View All"}
            </button>
          </div>
          <div style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            {activity.length === 0 && (
              <div style={{ padding: "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "#999999" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>history</span>
                <p style={{ fontSize: "13px" }}>No activity yet — actions you take will appear here.</p>
              </div>
            )}
            {activity.map((a, i) => {
              const isExpanded = expandedIdx === i;
              return (
                <div key={a.id} style={{ borderBottom: i < activity.length - 1 ? "1px solid #e4e2e1" : "none" }}>
                  {/* Main row */}
                  <div
                    style={{ padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer", transition: "background 0.15s" }}
                    onClick={() => router.push(a.route)}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "white", border: "1px solid #e4e2e1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: a.color }}>{a.icon}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "14px", color: "#333333", marginBottom: "3px", lineHeight: 1.4 }}>{a.text} <strong>{a.bold}</strong></p>
                      <span style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{timeAgo(a.at)}{a.by ? ` • ${a.by}` : ""}</span>
                    </div>
                    {/* Expand / navigate icons */}
                    <div style={{ display: "flex", gap: "2px", flexShrink: 0, alignItems: "center" }}>
                      <button
                        onClick={e => { e.stopPropagation(); setExpandedIdx(isExpanded ? null : i); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "2px", lineHeight: 1, display: "flex" }}
                        title="Show details"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>expand_more</span>
                      </button>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#ccc" }}>chevron_right</span>
                    </div>
                  </div>
                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: "0 16px 14px 64px", fontSize: "12px", color: "#666666", lineHeight: 1.6, borderTop: "1px solid #f0eded" }}>
                      <p>{a.detail}</p>
                      <button
                        onClick={() => router.push(a.route)}
                        style={{ marginTop: "8px", color: "#e30613", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        Open in {a.route.replace("/", "")} <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_forward</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333333" }}>Project Health</h2>
            <div style={{ display: "flex", gap: "16px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#666666", fontSize: "12px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#e30613", display: "inline-block" }} /> On Track</span>
              <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#666666", fontSize: "12px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ba1a1a", display: "inline-block" }} /> Delayed</span>
            </div>
          </div>
          <div style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e4e2e1" }}>
                  {["Project Name", "% Complete", "Status", "Engineer"].map(h => (
                    <th key={h} style={{ padding: "16px 24px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => {
                  const s = statusStyle[p.status] ?? statusStyle["In Progress"];
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid white", background: selectedProject?.id === p.id ? "rgba(227,6,19,0.04)" : "rgba(255,255,255,0.5)" }}>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "4px", height: "16px", background: s.color, flexShrink: 0 }} />
                          <span style={{ color: "#333333", fontWeight: selectedProject?.id === p.id ? 700 : 500 }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ maxWidth: "120px" }}>
                          <div style={{ fontSize: "10px", color: "#666666", marginBottom: "4px" }}>{p.pct}%</div>
                          <div style={{ height: "4px", width: "100%", background: "#e4e2e1" }}>
                            <div style={{ height: "100%", background: s.color, width: `${p.pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ padding: "4px 10px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", borderRadius: "999px", whiteSpace: "nowrap", border: `1px solid ${s.border}`, background: s.bg, color: s.color }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px", color: "#666666", fontSize: "14px" }}>{p.engineer}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Vendors & Purchase Orders */}
      <div style={{ marginTop: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333333" }}>Vendors & Purchase Orders</h2>
            <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>
              {selectedProject
                ? <>Vendors procured for <strong style={{ color: "#333333" }}>{selectedProject.name}</strong> and the purchase orders given</>
                : <>Vendors procured across all projects — select a project to add one</>}
            </p>
          </div>
          <button
            onClick={() => { setVendorForm({ vendorName: "", poNumber: "", poValue: "", fixedContract: false, contractStart: "", contractEnd: "" }); setPoFile(null); setShowAddVendor(true); }}
            disabled={!selectedProject}
            title={selectedProject ? "Add a vendor and purchase order" : "Select a project first"}
            style={{ padding: "10px 20px", border: "none", borderRadius: "8px", background: selectedProject ? "#e30613" : "#e4e2e1", color: "white", fontSize: "13px", fontWeight: "bold", cursor: selectedProject ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add_business</span>
            Add Vendor
          </button>
        </div>
        <div style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", borderRadius: "8px" }}>
          {vendorRows.length === 0 ? (
            <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", color: "#999999" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px" }}>inventory_2</span>
              <p style={{ fontSize: "14px" }}>No vendors procured yet{selectedProject ? ` for ${selectedProject.name}` : ""}</p>
              {selectedProject && (
                <button onClick={() => setShowAddVendor(true)} style={{ color: "#e30613", fontSize: "12px", fontWeight: "bold", background: "none", border: "none", cursor: "pointer" }}>
                  + Add the first vendor
                </button>
              )}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e4e2e1" }}>
                  {(selectedProject
                    ? ["Vendor Procured", "PO Number", "Acceptance & Advance", "Purchase Order Given"]
                    : ["Vendor Procured", "Project", "PO Number", "Acceptance & Advance", "Purchase Order Given"]
                  ).map(h => (
                    <th key={h} style={{ padding: "14px 24px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666", textAlign: h === "Purchase Order Given" ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorRows.map(v => (
                  <tr key={v.id} style={{ borderBottom: "1px solid white", background: "rgba(255,255,255,0.5)" }}>
                    <td style={{ padding: "14px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "4px", height: "16px", background: "#e30613", flexShrink: 0 }} />
                        <span style={{ color: "#333333", fontWeight: 500 }}>{v.vendorName}</span>
                      </div>
                    </td>
                    {!selectedProject && (
                      <td style={{ padding: "14px 24px", color: "#666666", fontSize: "14px" }}>{projectName(v.projectId)}</td>
                    )}
                    <td style={{ padding: "14px 24px", color: "#666666", fontSize: "13px", fontWeight: 600 }}>
                      <span>{v.poNumber}</span>
                      {v.poFileName && (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "11px", fontWeight: 400, color: "#999999" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>description</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>{v.poFileName}</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 24px" }}>
                      {v.advanceApproved ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", alignSelf: "flex-start", padding: "2px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#16a34a" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>verified</span>
                            Advance Approved · ₹{(v.advancePayable ?? 0).toLocaleString("en-IN")} payable
                          </span>
                          <span style={{ fontSize: "11px", color: "#999999" }}>
                            ₹{(v.advanceRequested ?? 0).toLocaleString("en-IN")} requested · {v.advanceTdsPct}% TDS
                          </span>
                        </div>
                      ) : v.advanceRequested != null ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", background: "rgba(202,138,4,0.1)", border: "1px solid rgba(202,138,4,0.25)", color: "#a16207" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>hourglass_top</span>
                            Advance ₹{(v.advanceRequested ?? 0).toLocaleString("en-IN")} Pending
                          </span>
                          {selectedProject && (
                            <button
                              onClick={() => { setApprovingAdvance(v.id); setAdvanceTdsPct(2); }}
                              style={{ padding: "6px 12px", border: "1px solid #16a34a", borderRadius: "6px", background: "white", color: "#16a34a", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>price_check</span>
                              Approve Advance
                            </button>
                          )}
                        </div>
                      ) : selectedProject ? (
                        <button
                          onClick={() => { setShowAcceptance(v.id); setAcceptFile(null); setAcceptAdvance(""); }}
                          style={{ padding: "6px 12px", border: "1px solid #e30613", borderRadius: "6px", background: "white", color: "#e30613", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>upload_file</span>
                          Upload Acceptance
                        </button>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#999999" }}>Pending acceptance</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 24px", color: "#333333", fontSize: "14px", fontWeight: "bold", textAlign: "right" }}>₹{v.poValue.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                <tr style={{ background: "#f0eded" }}>
                  <td colSpan={selectedProject ? 3 : 4} style={{ padding: "14px 24px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666" }}>
                    Total Purchase Orders ({vendorRows.length})
                  </td>
                  <td style={{ padding: "14px 24px", color: "#e30613", fontSize: "15px", fontWeight: "bold", textAlign: "right" }}>₹{totalPO.toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Outstanding Advances */}
      <div style={{ marginTop: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333333" }}>Outstanding Advances</h2>
            <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>
              Advance paid to vendors not yet offset by their invoices — across all vendors and pending projects
            </p>
          </div>
        </div>
        <div style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", borderRadius: "8px" }}>
          {advanceRows.length === 0 ? (
            <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", color: "#999999" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px" }}>savings</span>
              <p style={{ fontSize: "14px" }}>No outstanding advances across any project</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e4e2e1" }}>
                  {["Vendor", "Project", "Advance Paid", "Consumed by Invoices", "Outstanding"].map(h => (
                    <th key={h} style={{ padding: "14px 24px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666", textAlign: h === "Vendor" || h === "Project" ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {advanceRows.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid white", background: "rgba(255,255,255,0.5)" }}>
                    <td style={{ padding: "14px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "4px", height: "16px", background: "#a16207", flexShrink: 0 }} />
                        <span style={{ color: "#333333", fontWeight: 500 }}>{r.vendorName}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 24px", color: "#666666", fontSize: "14px" }}>{projectName(r.projectId)}</td>
                    <td style={{ padding: "14px 24px", textAlign: "right" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "#333333" }}>₹{r.payable.toLocaleString("en-IN")}</span>
                        <span style={{ fontSize: "11px", color: "#999999" }}>₹{r.requested.toLocaleString("en-IN")} req · {r.tdsPct}% TDS</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 24px", color: "#666666", fontSize: "14px", textAlign: "right" }}>₹{r.consumed.toLocaleString("en-IN")}</td>
                    <td style={{ padding: "14px 24px", color: "#a16207", fontSize: "14px", fontWeight: "bold", textAlign: "right" }}>₹{r.outstanding.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                <tr style={{ background: "#f0eded" }}>
                  <td colSpan={4} style={{ padding: "14px 24px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666" }}>
                    Total Outstanding Advance ({advanceRows.length})
                  </td>
                  <td style={{ padding: "14px 24px", color: "#e30613", fontSize: "15px", fontWeight: "bold", textAlign: "right" }}>₹{totalOutstandingAdvance.toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        style={{ position: "fixed", bottom: "32px", right: "32px", width: "56px", height: "56px", background: "#e30613", color: "white", borderRadius: "50%", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 50 }}
      >
        <span className="material-symbols-outlined">add</span>
      </button>

      {/* Quick Add Modal */}
      {showAdd && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAdd(false)}
        >
          <div
            style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "420px", margin: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e4e2e1" }}>
              <div>
                <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333333" }}>Quick Add</p>
                <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>What would you like to create?</p>
              </div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding: "8px" }}>
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => navigateTo(a.href)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "16px", padding: "14px 16px", borderRadius: "8px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8f8f8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(227,6,19,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: "#e30613", fontSize: "20px" }}>{a.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: "600", color: "#333333" }}>{a.label}</p>
                    <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>{a.sub}</p>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: "#ccc", fontSize: "20px" }}>chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor / Purchase Order Modal */}
      {showAddVendor && selectedProject && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAddVendor(false)}
        >
          <div
            style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "440px", margin: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e4e2e1" }}>
              <div>
                <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333333" }}>Add Vendor</p>
                <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>Procure a vendor for {selectedProject.name}</p>
              </div>
              <button onClick={() => setShowAddVendor(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                  Vendor Name <span style={{ color: "#e30613" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Blackwood Stonemasons Ltd."
                  value={vendorForm.vendorName}
                  onChange={e => setVendorForm(prev => ({ ...prev, vendorName: e.target.value }))}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "#e30613")}
                  onBlur={e => (e.target.style.borderColor = "#e4e2e1")}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                    PO Number <span style={{ color: "#e30613" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-2841"
                    value={vendorForm.poNumber}
                    onChange={e => setVendorForm(prev => ({ ...prev, poNumber: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#e30613")}
                    onBlur={e => (e.target.style.borderColor = "#e4e2e1")}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                    Purchase Order Value (₹) <span style={{ color: "#e30613" }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={vendorForm.poValue}
                    onChange={e => setVendorForm(prev => ({ ...prev, poValue: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#e30613")}
                    onBlur={e => (e.target.style.borderColor = "#e4e2e1")}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                  Purchase Order Document <span style={{ color: "#e30613" }}>*</span>
                </label>
                <label
                  htmlFor="po-file"
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", border: `1px ${poFile ? "solid" : "dashed"} ${poFile ? "#16a34a" : "#e4e2e1"}`, borderRadius: "6px", cursor: "pointer", background: poFile ? "rgba(22,163,74,0.05)" : "white" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: poFile ? "#16a34a" : "#666666" }}>
                    {poFile ? "task" : "upload_file"}
                  </span>
                  <span style={{ fontSize: "13px", color: poFile ? "#333333" : "#999999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {poFile ? poFile.name : "Upload the signed purchase order (PDF, image, or document)"}
                  </span>
                </label>
                <input
                  id="po-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={e => setPoFile(e.target.files?.[0] ?? null)}
                  style={{ display: "none" }}
                />
              </div>
              {/* Fixed contract period */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={vendorForm.fixedContract}
                    onChange={e => setVendorForm(prev => ({ ...prev, fixedContract: e.target.checked }))}
                    style={{ width: "16px", height: "16px", accentColor: "#e30613" }}
                  />
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#333333" }}>Fixed Contract Period</span>
                </label>
                {vendorForm.fixedContract && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                        Start Date <span style={{ color: "#e30613" }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={vendorForm.contractStart}
                        max={vendorForm.contractEnd || undefined}
                        onChange={e => setVendorForm(prev => ({ ...prev, contractStart: e.target.value }))}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                        End Date <span style={{ color: "#e30613" }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={vendorForm.contractEnd}
                        min={vendorForm.contractStart || undefined}
                        onChange={e => setVendorForm(prev => ({ ...prev, contractEnd: e.target.value }))}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                )}
                {vendorForm.fixedContract && !contractDatesValid && (
                  <p style={{ fontSize: "11px", color: "#ba1a1a" }}>Enter a start and end date, with the end on or after the start.</p>
                )}
              </div>
              <p style={{ fontSize: "11px", color: "#999999", lineHeight: 1.5 }}>
                A purchase order document is required for every vendor. Invoices from this vendor can only be uploaded once the purchase order exists, and their total may not exceed this value.
                {vendorForm.fixedContract && " With a fixed contract period, invoices from this vendor can only be filed with an invoice date inside the period above."}
              </p>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setShowAddVendor(false)} style={{ padding: "8px 20px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
              <button
                onClick={submitVendor}
                disabled={!vendorFormValid}
                style={{ padding: "8px 24px", border: "none", borderRadius: "6px", background: vendorFormValid ? "#e30613" : "#f0bcc0", color: "white", fontWeight: "bold", cursor: vendorFormValid ? "pointer" : "not-allowed", fontSize: "13px" }}
              >
                Add Vendor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Acceptance + Advance Modal */}
      {acceptingPO && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAcceptance(null)}
        >
          <div
            style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "440px", margin: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e4e2e1" }}>
              <div>
                <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333333" }}>Vendor Acceptance</p>
                <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>Record the acceptance document and advance for {acceptingPO.vendorName}</p>
              </div>
              <button onClick={() => setShowAcceptance(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Read-only vendor + PO summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8f8f8", border: "1px solid #e4e2e1", borderRadius: "8px", padding: "12px 14px" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#999999", marginBottom: "2px" }}>Vendor</p>
                  <p style={{ fontSize: "13px", fontWeight: "bold", color: "#333333" }}>{acceptingPO.vendorName}</p>
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#999999", marginBottom: "2px" }}>PO Number · Value</p>
                  <p style={{ fontSize: "13px", fontWeight: "bold", color: "#333333" }}>{acceptingPO.poNumber} · ₹{acceptingPO.poValue.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                  Advance Amount (₹) <span style={{ color: "#e30613" }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={acceptingPO.poValue}
                  placeholder={`e.g. 5000 (max ₹${acceptingPO.poValue.toLocaleString("en-IN")})`}
                  value={acceptAdvance}
                  onChange={e => setAcceptAdvance(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: `1px solid ${Number(acceptAdvance) > acceptingPO.poValue ? "#ba1a1a" : "#e4e2e1"}`, borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                />
                {Number(acceptAdvance) > acceptingPO.poValue && (
                  <p style={{ fontSize: "11px", color: "#ba1a1a", marginTop: "4px" }}>Advance cannot exceed the purchase-order value.</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>
                  Acceptance Document <span style={{ color: "#e30613" }}>*</span>
                </label>
                <label
                  htmlFor="accept-file"
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", border: `1px ${acceptFile ? "solid" : "dashed"} ${acceptFile ? "#16a34a" : "#e4e2e1"}`, borderRadius: "6px", cursor: "pointer", background: acceptFile ? "rgba(22,163,74,0.05)" : "white" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: acceptFile ? "#16a34a" : "#666666" }}>
                    {acceptFile ? "task" : "upload_file"}
                  </span>
                  <span style={{ fontSize: "13px", color: acceptFile ? "#333333" : "#999999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {acceptFile ? acceptFile.name : "Upload the signed acceptance document (PDF, image, or document)"}
                  </span>
                </label>
                <input
                  id="accept-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={e => setAcceptFile(e.target.files?.[0] ?? null)}
                  style={{ display: "none" }}
                />
              </div>
              <p style={{ fontSize: "11px", color: "#999999", lineHeight: 1.5 }}>
                The advance stays pending until accounts approves it and applies TDS. It is then offset against this vendor&apos;s invoices.
              </p>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setShowAcceptance(null)} style={{ padding: "8px 20px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
              <button
                onClick={submitAcceptance}
                disabled={!acceptValid}
                style={{ padding: "8px 24px", border: "none", borderRadius: "6px", background: acceptValid ? "#e30613" : "#f0bcc0", color: "white", fontWeight: "bold", cursor: acceptValid ? "pointer" : "not-allowed", fontSize: "13px" }}
              >
                Record Acceptance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Approval Modal (accounts) */}
      {advancePO && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setApprovingAdvance(null)}
        >
          <div
            style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "440px", margin: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e4e2e1" }}>
              <div>
                <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333333" }}>Approve Advance</p>
                <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>Apply TDS and approve the advance for {advancePO.vendorName}</p>
              </div>
              <button onClick={() => setApprovingAdvance(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8f8f8", border: "1px solid #e4e2e1", borderRadius: "8px", padding: "12px 14px" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#999999", marginBottom: "2px" }}>Vendor</p>
                  <p style={{ fontSize: "13px", fontWeight: "bold", color: "#333333" }}>{advancePO.vendorName}</p>
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#999999", marginBottom: "2px" }}>Advance Requested</p>
                  <p style={{ fontSize: "13px", fontWeight: "bold", color: "#333333" }}>₹{advReqAmount.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333333", marginBottom: "6px" }}>TDS %</label>
                <select
                  value={advanceTdsPct}
                  onChange={e => setAdvanceTdsPct(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "14px", color: "#333333", background: "white", outline: "none", boxSizing: "border-box" }}
                >
                  {[1, 2, 10].map(p => <option key={p} value={p}>{p}%</option>)}
                </select>
              </div>
              {/* Financial breakdown */}
              <div style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", borderRadius: "8px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#666666" }}>
                  <span>Advance Requested</span><span style={{ fontWeight: 600, color: "#333333" }}>₹{advReqAmount.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#666666" }}>
                  <span>TDS ({advanceTdsPct}%)</span><span style={{ fontWeight: 600, color: "#ba1a1a" }}>−₹{advTds.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "bold", borderTop: "1px solid #e4e2e1", paddingTop: "6px" }}>
                  <span style={{ color: "#333333" }}>Advance Payable</span><span style={{ color: "#16a34a" }}>₹{advPayable.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setApprovingAdvance(null)} style={{ padding: "8px 20px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
              <button
                onClick={submitApproveAdvance}
                style={{ padding: "8px 24px", border: "none", borderRadius: "6px", background: "#16a34a", color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}
              >
                Approve Advance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payable Pending Breakdown Modal */}
      {showPayable && (() => {
        const unpaid = requests.filter(r => r.status !== "Paid");
        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowPayable(false)}
          >
            <div
              style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "640px", margin: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e4e2e1", flexShrink: 0 }}>
                <div>
                  <p style={{ fontSize: "18px", fontWeight: "bold", color: "#333333" }}>Payable Pending Breakdown</p>
                  <p style={{ fontSize: "12px", color: "#666666", marginTop: "2px" }}>Unpaid payment requests by project and vendor</p>
                </div>
                <button onClick={() => setShowPayable(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {unpaid.length === 0 ? (
                  <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", color: "#999999" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "36px" }}>price_check</span>
                    <p style={{ fontSize: "14px" }}>No payable amounts pending — every payment request is paid.</p>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f8f8", borderBottom: "1px solid #e4e2e1" }}>
                        {["Project", "Vendor", "Request", "Status", "Amount"].map(h => (
                          <th key={h} style={{ padding: "12px 20px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666", textAlign: h === "Amount" ? "right" : "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unpaid.map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "12px 20px", fontSize: "13px", color: "#333333" }}>{r.project}</td>
                          <td style={{ padding: "12px 20px", fontSize: "13px", color: "#333333" }}>{r.vendor}</td>
                          <td style={{ padding: "12px 20px", fontSize: "12px", fontWeight: "bold", color: "#e30613" }}>{r.id}</td>
                          <td style={{ padding: "12px 20px", fontSize: "11px", color: "#666666" }}>{r.status}</td>
                          <td style={{ padding: "12px 20px", fontSize: "13px", fontWeight: "600", color: "#333333", textAlign: "right" }}>{r.amount}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#f0eded" }}>
                        <td colSpan={4} style={{ padding: "12px 20px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666" }}>
                          Total Payable Pending ({unpaid.length})
                        </td>
                        <td style={{ padding: "12px 20px", color: "#e30613", fontSize: "15px", fontWeight: "bold", textAlign: "right" }}>₹{payablePendingTotal.toLocaleString("en-IN")}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
