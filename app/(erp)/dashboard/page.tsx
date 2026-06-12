"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "../../../contexts/ProjectContext";

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
  const { projects, selectedProject, vendorPOs, requests, activities } = useProject();
  const [showAdd, setShowAdd]         = useState(false);
  const [showPayable, setShowPayable] = useState(false);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? "—";

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
