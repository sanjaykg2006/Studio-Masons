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

const allActivity = [
  { icon: "verified",      color: "#e30613", route: "/design",        text: "Design approved for",        bold: "Indiranagar Residence", time: "2 hours ago • Arjun K.",        detail: "Design package v3 approved — includes updated floor plans, elevation drawings, and material finishes." },
  { icon: "priority_high", color: "#ba1a1a", route: "/snags",         text: "New snag raised in",          bold: "Whitefield Office",     time: "4 hours ago • Structural Team", detail: "Water seepage on 2nd floor slab. Requires waterproofing inspection before next concrete pour." },
  { icon: "cloud_upload",  color: "#e30613", route: "/orders",        text: "Material PO issued for",      bold: "Koramangala Villa",     time: "6 hours ago • Admin",           detail: "Purchase order #PO-2841 raised for cement and steel — ₹4.6L. Awaiting vendor confirmation." },
  { icon: "chat_bubble",   color: "#666666", route: "/design",        text: "Architect comment on",        bold: "HSR Layout G+3",        time: "Yesterday • Sameer M.",         detail: "Sameer noted revision required on staircase alignment — please review updated drawing set." },
  { icon: "trending_up",   color: "#16a34a", route: "/site-progress", text: "Progress updated to 65% on", bold: "Indiranagar Residence", time: "Yesterday • Vikram R.",         detail: "Plastering complete on floors 1–3. Electrical first fix in progress. Next milestone: tiling." },
  { icon: "receipt_long",  color: "#e30613", route: "/orders",        text: "Invoice ₹1.2L submitted for", bold: "Koramangala Villa",     time: "2 days ago • Accounts",         detail: "Invoice INV-0092 for tiling works submitted. Payment due in 7 days." },
  { icon: "photo_camera",  color: "#666666", route: "/site-progress", text: "Site photos uploaded for",    bold: "Jayanagar Apartment",   time: "2 days ago • Priya M.",         detail: "18 photos uploaded covering foundation work, rebar placement, and shuttering." },
  { icon: "check_circle",  color: "#16a34a", route: "/quality",       text: "Quality check passed for",    bold: "HSR Layout G+3",        time: "3 days ago • Rahul K.",         detail: "Concrete cube test results within spec — mix design approved for remaining columns." },
];

export default function DashboardPage() {
  const router = useRouter();
  const { projects, selectedProject } = useProject();
  const [showAdd, setShowAdd]         = useState(false);

  const onTrackCount   = projects.filter(p => p.status === "On Track" || p.status === "In Progress").length;
  const delayedCount   = projects.filter(p => p.status === "Delayed").length;
  const avgPct         = projects.length ? Math.round(projects.reduce((s, p) => s + p.pct, 0) / projects.length) : 0;
  const [showAll, setShowAll]         = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const activity = showAll ? allActivity : allActivity.slice(0, 4);

  function navigateTo(href: string) {
    setShowAdd(false);
    router.push(href);
  }

  return (
    <div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {[
          { label: "Active Projects",  value: String(projects.length), icon: "rocket_launch",  sub: <><span style={{ fontWeight: "bold" }}>{projects.length}</span> sites currently managed</> },
          { label: "On Track",         value: String(onTrackCount),    icon: "trending_up",    sub: <><span style={{ color: "#16a34a", fontWeight: "bold" }}>{onTrackCount}</span> of {projects.length} progressing</> },
          { label: "Delayed",          value: String(delayedCount),    icon: "report_problem", sub: delayedCount > 0 ? <><span style={{ color: "#ba1a1a", fontWeight: "bold" }}>{delayedCount}</span> need{delayedCount === 1 ? "s" : ""} attention</> : <>All sites on schedule</> },
          { label: "Avg. Completion",  value: `${avgPct}%`,            icon: "donut_large",    sub: <>Across <span style={{ fontWeight: "bold" }}>all {projects.length} sites</span></> },
        ].map((kpi, i) => (
          <div key={i} style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", padding: "24px", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
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
            {activity.map((a, i) => {
              const isExpanded = expandedIdx === i;
              return (
                <div key={i} style={{ borderBottom: i < activity.length - 1 ? "1px solid #e4e2e1" : "none" }}>
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
                      <span style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{a.time}</span>
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
    </div>
  );
}
