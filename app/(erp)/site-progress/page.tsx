"use client";
import { useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";

const boqItems = [
  { name: "Internal Plastering", category: "Civil Works", status: "In Progress", statusStyle: "bg-primary/10 text-primary border-primary/20", budgeted: "₹45,000.00", installed: "₹32,400.00", pct: 72, barColor: "bg-primary" },
  { name: "Electrical Concealing", category: "MEP", status: "In Progress", statusStyle: "bg-primary/10 text-primary border-primary/20", budgeted: "₹28,000.00", installed: "₹11,200.00", pct: 40, barColor: "bg-primary" },
  { name: "Brick Work – Floor 4", category: "Civil Works", status: "Completed", statusStyle: "bg-green-500/10 text-green-600 border-green-500/20", budgeted: "₹62,500.00", installed: "₹62,500.00", pct: 100, barColor: "bg-green-500" },
  { name: "Tiling – Bathrooms", category: "Finishing", status: "Delayed", statusStyle: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", budgeted: "₹18,700.00", installed: "₹1,496.00", pct: 8, barColor: "bg-yellow-500" },
  { name: "AC Ducting Installation", category: "HVAC", status: "Scheduled", statusStyle: "bg-surface-container-highest text-[#666666] border-surface-container-highest", budgeted: "₹84,000.00", installed: "₹0.00", pct: 0, barColor: "bg-primary" },
];

const subTabs = ["BOQ Level", "Project Schedule", "DPR/WPR Reports", "Material Update"];

export default function SiteProgressPage() {
  const { selectedProject } = useProject();
  const [activeTab, setActiveTab] = useState(0);

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
          <p className="text-[16px] text-[#666666] max-w-md">Use the <span className="font-bold text-[#e30613]">Project Selector</span> in the top bar to choose a project and track its site progress.</p>
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
          <button className="px-6 py-2 border border-surface-container-highest text-[#333333] hover:border-primary transition-colors rounded text-[14px] font-bold flex items-center gap-2 bg-white shadow-sm">
            <span className="material-symbols-outlined text-[#666666]">download</span> EXPORT REPORT
          </button>
          <button className="px-6 py-2 bg-primary text-white hover:opacity-90 rounded text-[14px] font-bold flex items-center gap-2 shadow-md">
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
      {/* BOQ Table */}
      <div className="bg-white border border-surface-container-highest rounded overflow-hidden shadow-sm mb-10">
        <div className="p-6 border-b border-surface-container-highest flex justify-between items-center bg-[#f8f8f8]">
          <h3 className="text-[20px] font-medium text-[#333333]">BOQ Level Breakdown</h3>
          <select className="bg-white border border-surface-container-highest rounded px-3 py-1 text-[16px] focus:border-primary outline-none">
            <option>All Phases</option>
            <option>Phase 1: Civil</option>
            <option>Phase 2: MEP</option>
            <option>Phase 3: Interiors</option>
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
            {boqItems.map((item, i) => (
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
          <p className="text-[#666666] text-[14px] font-bold">Showing 5 of 48 work items</p>
          <div className="flex gap-2">
            <button className="w-8 h-8 flex items-center justify-center border border-surface-container-highest rounded hover:border-primary bg-white"><span className="material-symbols-outlined text-[16px] text-[#666666]">chevron_left</span></button>
            {[1, 2, 3].map(n => (
              <button key={n} className={`w-8 h-8 flex items-center justify-center rounded font-bold ${n === 1 ? "border border-primary text-white bg-primary shadow-sm" : "border border-surface-container-highest bg-white text-[#666666] hover:border-primary"}`}>{n}</button>
            ))}
            <button className="w-8 h-8 flex items-center justify-center border border-surface-container-highest rounded hover:border-primary bg-white"><span className="material-symbols-outlined text-[16px] text-[#666666]">chevron_right</span></button>
          </div>
        </div>
      </div>
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
    </div>
  );
}
