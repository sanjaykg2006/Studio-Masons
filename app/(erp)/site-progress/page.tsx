"use client";
import { useState, useEffect, useMemo } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { loadBoqItems, type BoqItemDTO } from "../data";

const subTabs = ["BOQ Level", "Project Schedule", "DPR/WPR Reports", "Material Update"];

// ── Hardcoded demo data for the non-BOQ tabs ──────────────────────────────
// These stand in for what would come from the database. Kept in the page so the
// whole screen is functional end-to-end while the backend tables don't exist yet.
type SchedulePhase = { name: string; start: string; end: string; status: "Completed" | "In Progress" | "Scheduled" | "Delayed"; pct: number };
const SCHEDULE: SchedulePhase[] = [
  { name: "Phase 1: Civil Structure", start: "01 Jan", end: "28 Feb", status: "Completed", pct: 100 },
  { name: "Phase 2: MEP Rough-in", start: "15 Feb", end: "10 Apr", status: "In Progress", pct: 68 },
  { name: "Phase 3: Internal Finishing", start: "01 Apr", end: "20 May", status: "In Progress", pct: 34 },
  { name: "Phase 4: Tiling & Flooring", start: "10 May", end: "15 Jun", status: "Delayed", pct: 8 },
  { name: "Phase 5: Handover & Snagging", start: "16 Jun", end: "30 Jun", status: "Scheduled", pct: 0 },
];
const SCHEDULE_STATUS: Record<SchedulePhase["status"], string> = {
  Completed: "bg-green-500/10 text-green-600 border-green-500/20",
  "In Progress": "bg-primary/10 text-primary border-primary/20",
  Delayed: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  Scheduled: "bg-surface-container-highest text-[#666666] border-surface-container-highest",
};
const SCHEDULE_BAR: Record<SchedulePhase["status"], string> = {
  Completed: "bg-green-500", "In Progress": "bg-primary", Delayed: "bg-yellow-500", Scheduled: "bg-[#666666]",
};

type Report = { id: string; date: string; type: "DPR" | "WPR"; author: string; manpower: number; summary: string; status: "Submitted" | "Draft" };
const SEED_REPORTS: Report[] = [
  { id: "r1", date: "16 Jun", type: "DPR", author: "Ravi Kumar", manpower: 28, summary: "Plastering on L2 north wing completed; electrical conduit pulled on L3.", status: "Submitted" },
  { id: "r2", date: "15 Jun", type: "DPR", author: "Ravi Kumar", manpower: 31, summary: "Brickwork floor 4 finished. Tiling material inspection pending.", status: "Submitted" },
  { id: "r3", date: "14 Jun", type: "WPR", author: "S. Mehta", manpower: 26, summary: "Weekly roll-up: civil 100%, MEP at 68%, finishing started.", status: "Submitted" },
  { id: "r4", date: "13 Jun", type: "DPR", author: "Ravi Kumar", manpower: 24, summary: "AC ducting layout marked; awaiting material delivery.", status: "Draft" },
];

type Material = { name: string; ordered: number; received: number; used: number; unit: string };
const MATERIALS: Material[] = [
  { name: "Cement (OPC 53)", ordered: 1200, received: 1200, used: 940, unit: "bags" },
  { name: "TMT Steel", ordered: 45, received: 45, used: 38, unit: "tonnes" },
  { name: "Italian Marble", ordered: 800, received: 0, used: 0, unit: "sq.ft" },
  { name: "Electrical Conduit", ordered: 5000, received: 3200, used: 2100, unit: "metres" },
  { name: "Vitrified Tiles", ordered: 2400, received: 600, used: 120, unit: "sq.ft" },
];

const PAGE_SIZE = 5;

export default function SiteProgressPage() {
  const { selectedProject } = useProject();
  const [activeTab, setActiveTab] = useState(0);
  const [boqItems, setBoqItems] = useState<BoqItemDTO[]>([]);
  const [phase, setPhase] = useState("All Phases");
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<Report[]>(SEED_REPORTS);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    loadBoqItems().then(setBoqItems).catch((err) => console.warn("[SiteProgress] BOQ load failed:", err));
  }, []);

  // Unique categories drive the BOQ phase/category filter so it filters real rows.
  const categories = useMemo(() => Array.from(new Set(boqItems.map((b) => b.category))), [boqItems]);
  const filteredBoq = useMemo(
    () => (phase === "All Phases" ? boqItems : boqItems.filter((b) => b.category === phase)),
    [boqItems, phase],
  );
  const pageCount = Math.max(1, Math.ceil(filteredBoq.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedBoq = filteredBoq.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 whenever the filter changes.
  useEffect(() => setPage(1), [phase]);

  // Export the currently-active tab's data as a CSV download.
  function exportReport() {
    let rows: string[][];
    if (activeTab === 0) {
      rows = [["Work Item", "Category", "Status", "Budgeted", "Installed", "Progress %"], ...filteredBoq.map((b) => [b.name, b.category, b.status, b.budgeted, b.installed, String(b.pct)])];
    } else if (activeTab === 1) {
      rows = [["Phase", "Start", "End", "Status", "Progress %"], ...SCHEDULE.map((s) => [s.name, s.start, s.end, s.status, String(s.pct)])];
    } else if (activeTab === 2) {
      rows = [["Date", "Type", "Author", "Manpower", "Summary", "Status"], ...reports.map((r) => [r.date, r.type, r.author, String(r.manpower), r.summary, r.status])];
    } else {
      rows = [["Material", "Ordered", "Received", "Used", "Balance", "Unit"], ...MATERIALS.map((m) => [m.name, String(m.ordered), String(m.received), String(m.used), String(m.received - m.used), m.unit])];
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProject?.name ?? "site"}-${subTabs[activeTab].replace(/\W+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Capture a new daily progress report from the modal and prepend it.
  function addReport(form: { type: "DPR" | "WPR"; author: string; manpower: number; summary: string }) {
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    setReports((prev) => [{ id: `r_${Date.now()}`, date, status: "Submitted", ...form }, ...prev]);
    setShowLog(false);
    setActiveTab(2); // jump to the reports tab so the new entry is visible
  }

  // No project selected — show prompt
  if (!selectedProject) {
    return (
      <div>
        <nav className="flex items-center gap-2 mb-8 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
          <span>Dashboard</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-bold">Site Progress</span>
        </nav>
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">Site Progress</h2>
        <p className="text-[#666666] max-w-2xl mb-10">Real-time monitoring of site execution metrics, BOQ utilization, and schedule compliance.</p>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[#f8f8f8] border border-[#e4e2e1] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-[#e4e2e1]">construction</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#333333] mb-2">No Project Selected</h3>
          <p className="text-[16px] text-[#666666] w-full max-w-[28rem]">Use the <span className="font-bold text-[#e30613]">Project Selector</span> in the top bar to choose a project and track its site progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="flex items-center gap-2 mb-8 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <span>Dashboard</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-primary font-bold">Site Progress</span>
      </nav>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h2 className="text-[32px] font-bold mb-2 text-[#333333]">{selectedProject.name} <span className="text-primary opacity-30 font-light">/ Progress</span></h2>
          <p className="text-[#666666] max-w-2xl">Real-time monitoring of site execution metrics. Reviewing BOQ utilization and schedule compliance for the current phase.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportReport} className="px-6 py-2 border border-surface-container-highest text-[#333333] hover:border-primary transition-colors rounded text-[14px] font-bold flex items-center gap-2 bg-white shadow-sm">
            <span className="material-symbols-outlined text-[#666666]">download</span> EXPORT REPORT
          </button>
          <button onClick={() => setShowLog(true)} className="px-6 py-2 bg-primary text-white hover:opacity-90 rounded text-[14px] font-bold flex items-center gap-2 shadow-md">
            <span className="material-symbols-outlined">add</span> LOG DAILY PROGRESS
          </button>
        </div>
      </div>
      {/* Sub-tabs */}
      <div className="border-b border-surface-container-highest mb-10">
        <div className="flex gap-8">
          {subTabs.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={`pb-4 border-b-4 text-[14px] font-bold uppercase tracking-widest transition-all ${activeTab === i ? "border-primary text-primary" : "border-transparent text-[#666666] hover:text-[#333333]"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Overall Completion", value: `${selectedProject.pct}%`, sub: "▲ 4.2%", valueStyle: "text-primary", accent: true },
          { label: "Days Elapsed", value: "142", sub: "/ 210", valueStyle: "text-[#333333]", accent: false },
          { label: "Total BOQ Value", value: "₹2.4M", sub: null, valueStyle: "text-[#333333]", accent: false },
          { label: "Active Labors", value: "28", sub: "On Site", valueStyle: "text-[#333333]", accent: false },
        ].map((s, i) => (
          <div key={i} className={`p-6 bg-[#f8f8f8] border border-surface-container-highest rounded shadow-sm relative overflow-hidden ${s.accent ? "border-l-4 border-l-primary" : ""}`}>
            <p className="text-[#666666] text-[10px] font-bold uppercase tracking-widest mb-4">{s.label}</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-[48px] font-bold leading-none ${s.valueStyle}`}>{s.value}</span>
              {s.sub && <span className={`text-[16px] font-bold ${i === 0 ? "text-primary opacity-60" : "text-[#666666]"}`}>{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab: BOQ Level ─────────────────────────────────────────── */}
      {activeTab === 0 && (
      <div className="bg-white border border-surface-container-highest rounded overflow-hidden shadow-sm mb-10">
        <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-[#f8f8f8]">
          <h3 className="text-[20px] font-medium text-[#333333]">BOQ Level Breakdown</h3>
          <select value={phase} onChange={(e) => setPhase(e.target.value)} className="bg-white border border-surface-container-highest rounded px-3 py-1 text-[16px] focus:border-primary outline-none">
            <option>All Phases</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white border-b border-surface-container-highest">
              {["Work Item", "Status", "Budgeted Value", "Installed Value", "Progress"].map((h, i) => (
                <th key={h} className={`px-6 py-4 text-[10px] font-bold uppercase text-[#666666] ${i >= 2 && i <= 3 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-highest">
            {pagedBoq.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-[#666666] text-[14px]">No work items for this filter.</td></tr>
            ) : pagedBoq.map((item, i) => (
              <tr key={i} className="hover:bg-[#f8f8f8] transition-colors group">
                <td className="px-6 py-5">
                  <div className="text-[16px] font-bold text-[#333333] group-hover:text-primary transition-colors">{item.name}</div>
                  <div className="text-[10px] text-[#666666] uppercase tracking-tighter">Category: {item.category}</div>
                </td>
                <td className="px-6 py-5">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${item.statusStyle}`}>{item.status}</span>
                </td>
                <td className="px-6 py-5 text-right text-[16px] text-[#333333]">{item.budgeted}</td>
                <td className="px-6 py-5 text-right text-[16px] text-[#333333]">{item.installed}</td>
                <td className="px-6 py-5">
                  <div className="w-48">
                    <div className="text-[10px] text-[#666666] mb-2">{item.pct}%</div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div className={`h-full ${item.barColor}`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-6 flex justify-between items-center border-t border-surface-container-highest">
          <p className="text-[#666666] text-[14px] font-bold">Showing {pagedBoq.length} of {filteredBoq.length} work items</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="w-8 h-8 flex items-center justify-center border border-surface-container-highest rounded hover:border-primary bg-white disabled:opacity-40 disabled:hover:border-surface-container-highest"><span className="material-symbols-outlined text-[16px] text-[#666666]">chevron_left</span></button>
            {Array.from({ length: pageCount }, (_, n) => n + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 flex items-center justify-center rounded font-bold ${n === safePage ? "border border-primary text-white bg-primary shadow-sm" : "border border-surface-container-highest bg-white text-[#666666] hover:border-primary"}`}>{n}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount} className="w-8 h-8 flex items-center justify-center border border-surface-container-highest rounded hover:border-primary bg-white disabled:opacity-40 disabled:hover:border-surface-container-highest"><span className="material-symbols-outlined text-[16px] text-[#666666]">chevron_right</span></button>
          </div>
        </div>
      </div>
      )}

      {/* ── Tab: Project Schedule ──────────────────────────────────── */}
      {activeTab === 1 && (
      <div className="bg-white border border-surface-container-highest rounded overflow-hidden shadow-sm mb-10">
        <div className="p-6 border-b border-surface-container-highest bg-[#f8f8f8]">
          <h3 className="text-[20px] font-medium text-[#333333]">Project Schedule</h3>
          <p className="text-[#666666] text-[14px] mt-1">Planned phases against current execution status.</p>
        </div>
        <div className="divide-y divide-surface-container-highest">
          {SCHEDULE.map((s, i) => (
            <div key={i} className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="md:w-64">
                <div className="text-[16px] font-bold text-[#333333]">{s.name}</div>
                <div className="text-[10px] text-[#666666] uppercase tracking-tighter">{s.start} → {s.end}</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border self-start ${SCHEDULE_STATUS[s.status]}`}>{s.status}</span>
              <div className="flex-1 flex items-center gap-3">
                <div className="h-2 flex-1 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className={`h-full ${SCHEDULE_BAR[s.status]}`} style={{ width: `${s.pct}%` }} />
                </div>
                <span className="text-[12px] font-bold text-[#666666] w-10 text-right">{s.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ── Tab: DPR/WPR Reports ───────────────────────────────────── */}
      {activeTab === 2 && (
      <div className="bg-white border border-surface-container-highest rounded overflow-hidden shadow-sm mb-10">
        <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-[#f8f8f8]">
          <h3 className="text-[20px] font-medium text-[#333333]">Daily / Weekly Progress Reports</h3>
          <button onClick={() => setShowLog(true)} className="text-primary text-[14px] font-bold hover:underline">+ NEW REPORT</button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white border-b border-surface-container-highest">
              {["Date", "Type", "Author", "Manpower", "Summary", "Status"].map((h) => (
                <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase text-[#666666]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-highest">
            {reports.map((r) => (
              <tr key={r.id} className="hover:bg-[#f8f8f8] transition-colors">
                <td className="px-6 py-5 text-[16px] font-bold text-[#333333]">{r.date}</td>
                <td className="px-6 py-5"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${r.type === "DPR" ? "bg-primary/10 text-primary border-primary/20" : "bg-tertiary/10 text-tertiary border-tertiary/20"}`}>{r.type}</span></td>
                <td className="px-6 py-5 text-[16px] text-[#333333]">{r.author}</td>
                <td className="px-6 py-5 text-[16px] text-[#333333]">{r.manpower}</td>
                <td className="px-6 py-5 text-[14px] text-[#666666] max-w-md">{r.summary}</td>
                <td className="px-6 py-5"><span className={`text-[10px] font-bold uppercase ${r.status === "Submitted" ? "text-green-600" : "text-yellow-700"}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* ── Tab: Material Update ───────────────────────────────────── */}
      {activeTab === 3 && (
      <div className="bg-white border border-surface-container-highest rounded overflow-hidden shadow-sm mb-10">
        <div className="p-6 border-b border-surface-container-highest bg-[#f8f8f8]">
          <h3 className="text-[20px] font-medium text-[#333333]">Material Update</h3>
          <p className="text-[#666666] text-[14px] mt-1">Ordered, received, and consumed quantities on site.</p>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white border-b border-surface-container-highest">
              {["Material", "Ordered", "Received", "Used", "Balance", "Status"].map((h, i) => (
                <th key={h} className={`px-6 py-4 text-[10px] font-bold uppercase text-[#666666] ${i >= 1 && i <= 4 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-highest">
            {MATERIALS.map((m, i) => {
              const balance = m.received - m.used;
              const awaited = m.received === 0;
              const low = !awaited && balance <= m.ordered * 0.1;
              const status = awaited ? "Awaited" : low ? "Low Stock" : "In Stock";
              const style = awaited ? "text-[#666666]" : low ? "text-yellow-700" : "text-green-600";
              return (
                <tr key={i} className="hover:bg-[#f8f8f8] transition-colors">
                  <td className="px-6 py-5 text-[16px] font-bold text-[#333333]">{m.name}</td>
                  <td className="px-6 py-5 text-right text-[16px] text-[#333333]">{m.ordered.toLocaleString("en-IN")} {m.unit}</td>
                  <td className="px-6 py-5 text-right text-[16px] text-[#333333]">{m.received.toLocaleString("en-IN")}</td>
                  <td className="px-6 py-5 text-right text-[16px] text-[#333333]">{m.used.toLocaleString("en-IN")}</td>
                  <td className="px-6 py-5 text-right text-[16px] font-bold text-[#333333]">{balance.toLocaleString("en-IN")}</td>
                  <td className="px-6 py-5"><span className={`text-[10px] font-bold uppercase ${style}`}>{status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-[#f8f8f8] border border-surface-container-highest rounded flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[20px] font-medium text-[#333333]">Recent Site Images</h4>
            <button className="text-primary text-[14px] font-bold hover:underline">VIEW ALL GALLERY</button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {["Main Atrium - L2", "MEP Details - North", "Exterior Shell"].map((label, i) => (
              <div key={i} className="aspect-square rounded overflow-hidden relative group cursor-pointer border border-surface-container-highest bg-surface-container-high flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[32px] text-surface-container-highest">image</span>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <p className="text-[10px] font-bold uppercase text-white">{label}</p>
                </div>
              </div>
            ))}
            <div className="aspect-square rounded overflow-hidden relative group cursor-pointer border-dashed border-2 border-surface-container-highest bg-white flex flex-col items-center justify-center text-[#666666] hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[32px] mb-2">add_a_photo</span>
              <span className="text-[10px] font-bold uppercase">Upload</span>
            </div>
          </div>
        </div>
        <div className="p-6 bg-[#f8f8f8] border border-surface-container-highest rounded shadow-sm">
          <h4 className="text-[20px] font-medium mb-6 text-[#333333]">Execution Risk</h4>
          <div className="space-y-6">
            {[
              { icon: "warning", iconStyle: "text-error", bgStyle: "bg-error-container", title: "Material Delay: Tiling", desc: "Italian marble shipment delayed by 12 days at customs. Impacting Phase 3 completion.", tag: "High Priority", tagStyle: "text-error" },
              { icon: "info", iconStyle: "text-primary", bgStyle: "bg-primary/10", title: "Weather Warning", desc: "Heavy rain predicted for Tuesday. Exterior painting schedule must be moved to Friday.", tag: "Notice", tagStyle: "text-primary" },
            ].map((r, i) => (
              <div key={i} className="flex gap-4">
                <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 shadow-sm ${r.bgStyle}`}>
                  <span className={`material-symbols-outlined ${r.iconStyle}`}>{r.icon}</span>
                </div>
                <div>
                  <p className="text-[16px] font-bold text-[#333333]">{r.title}</p>
                  <p className="text-[#666666] text-[12px] leading-tight mt-1">{r.desc}</p>
                  <div className={`mt-2 text-[10px] font-bold uppercase ${r.tagStyle}`}>{r.tag}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-3 border border-surface-container-highest rounded text-[14px] font-bold hover:bg-surface-container-high transition-colors bg-white shadow-sm text-[#333333]">VIEW ALL ALERTS</button>
        </div>
      </div>

      {/* Log Daily Progress modal */}
      {showLog && <LogProgressModal onClose={() => setShowLog(false)} onSubmit={addReport} />}
    </div>
  );
}

// Modal form for logging a daily/weekly progress report. Kept in-file since it's
// only used here; submits captured fields back to the page.
function LogProgressModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (f: { type: "DPR" | "WPR"; author: string; manpower: number; summary: string }) => void }) {
  const [type, setType] = useState<"DPR" | "WPR">("DPR");
  const [author, setAuthor] = useState("");
  const [manpower, setManpower] = useState("");
  const [summary, setSummary] = useState("");
  const valid = author.trim() && summary.trim() && Number(manpower) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded shadow-xl w-full max-w-[32rem] p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[20px] font-bold text-[#333333]">Log Daily Progress</h3>
          <button onClick={onClose} className="text-[#666666] hover:text-primary"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#666666] mb-2 block">Report Type</label>
            <div className="flex gap-3">
              {(["DPR", "WPR"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} className={`px-4 py-2 rounded text-[14px] font-bold border ${type === t ? "border-primary text-primary bg-primary/10" : "border-surface-container-highest text-[#666666]"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#666666] mb-2 block">Author</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Site engineer name" className="w-full border border-surface-container-highest rounded px-3 py-2 text-[16px] focus:border-primary outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#666666] mb-2 block">Manpower On Site</label>
            <input value={manpower} onChange={(e) => setManpower(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 28" className="w-full border border-surface-container-highest rounded px-3 py-2 text-[16px] focus:border-primary outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#666666] mb-2 block">Work Done Summary</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="What was accomplished today…" className="w-full border border-surface-container-highest rounded px-3 py-2 text-[16px] focus:border-primary outline-none resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-6 py-2 border border-surface-container-highest rounded text-[14px] font-bold text-[#333333] hover:border-primary">CANCEL</button>
          <button disabled={!valid} onClick={() => onSubmit({ type, author: author.trim(), manpower: Number(manpower), summary: summary.trim() })} className="px-6 py-2 bg-primary text-white rounded text-[14px] font-bold shadow-md disabled:opacity-40">SAVE REPORT</button>
        </div>
      </div>
    </div>
  );
}
