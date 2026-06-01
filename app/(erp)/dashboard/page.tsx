"use client";
import { useProject } from "../../../contexts/ProjectContext";

export default function DashboardPage() {
  const { projects, selectedProject } = useProject();

  const activity = [
    { icon: "verified", color: "#e30613", text: "Design approved for", bold: "Indiranagar Residence", time: "2 hours ago • Arjun K." },
    { icon: "priority_high", color: "#ba1a1a", text: "New snag raised in", bold: "Whitefield Office", time: "4 hours ago • Structural Team" },
    { icon: "cloud_upload", color: "#e30613", text: "Material PO issued for", bold: "Koramangala Villa", time: "6 hours ago • Admin" },
    { icon: "chat_bubble", color: "#666666", text: "Architect comment on", bold: "HSR Layout G+3", time: "Yesterday • Sameer M." },
  ];

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
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-[#666666]">Viewing:</span>
            <span className="text-[14px] font-bold text-[#333333]">{selectedProject.name}</span>
            <span className="text-[10px] text-[#666666]">•</span>
            <span className="text-[10px] text-[#666666]">{selectedProject.location}</span>
            <span className="text-[10px] text-[#666666]">•</span>
            <span className="text-[10px] font-bold text-[#e30613] uppercase">{selectedProject.status}</span>
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
          { label: "Active Projects", value: String(projects.length), icon: "rocket_launch", sub: <><span style={{ color: "#e30613", fontWeight: "bold" }}>+2</span> from last month</> },
          { label: "Pending Snags", value: "45", icon: "report_problem", sub: <><span style={{ color: "#ba1a1a", fontWeight: "bold" }}>12 urgent</span> needing review</> },
          { label: "Open Vendor Invoices", value: "₹12.4L", icon: "account_balance_wallet", sub: <>Due within <span style={{ fontWeight: "bold" }}>7 days</span></> },
          { label: "Pending Approvals", value: "8", icon: "approval_delegation", sub: <>Requires <span style={{ color: "#e30613", fontWeight: "bold" }}>immediate action</span></> },
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
            <button style={{ color: "#e30613", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", background: "none", border: "none", cursor: "pointer" }}>View All</button>
          </div>
          <div style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            {activity.map((a, i) => (
              <div key={i} style={{ padding: "16px", display: "flex", gap: "16px", borderBottom: i < activity.length - 1 ? "1px solid #e4e2e1" : "none" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "white", border: "1px solid #e4e2e1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: a.color }}>{a.icon}</span>
                </div>
                <div>
                  <p style={{ fontSize: "16px", color: "#333333", marginBottom: "4px" }}>{a.text} <strong>{a.bold}</strong></p>
                  <span style={{ color: "#666666", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{a.time}</span>
                </div>
              </div>
            ))}
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
                  const delayed = p.status === "Delayed";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid white", background: selectedProject?.id === p.id ? "rgba(227,6,19,0.04)" : "rgba(255,255,255,0.5)" }}>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "4px", height: "16px", background: delayed ? "#ba1a1a" : "#e30613" }} />
                          <span style={{ color: "#333333", fontWeight: selectedProject?.id === p.id ? 700 : 500 }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ maxWidth: "120px" }}>
                          <div style={{ fontSize: "10px", color: "#666666", marginBottom: "4px" }}>{p.pct}%</div>
                          <div style={{ height: "4px", width: "100%", background: "#e4e2e1" }}>
                            <div style={{ height: "100%", background: delayed ? "#ba1a1a" : "#e30613", width: `${p.pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ padding: "4px 12px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", borderRadius: "999px", border: `1px solid ${delayed ? "rgba(186,26,26,0.2)" : "rgba(227,6,19,0.2)"}`, background: delayed ? "rgba(186,26,26,0.1)" : "rgba(227,6,19,0.1)", color: delayed ? "#ba1a1a" : "#e30613" }}>{p.status}</span>
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
      <button style={{ position: "fixed", bottom: "32px", right: "32px", width: "56px", height: "56px", background: "#e30613", color: "white", borderRadius: "50%", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 50 }}>
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}
