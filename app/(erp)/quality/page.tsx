"use client";
import { useState } from "react";

const checks = [
  { id: "QC-041", project: "Indiranagar Residence", area: "Master Bedroom", category: "Finishing", inspector: "Vikram R.", date: "Nov 14, 2024", result: "Pass", resultStyle: "bg-green-500/10 text-green-600 border-green-500/20", score: 94 },
  { id: "QC-040", project: "Whitefield Office", area: "Reception Lobby", category: "Civil Works", inspector: "Sneha P.", date: "Nov 13, 2024", result: "Fail", resultStyle: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20", score: 61 },
  { id: "QC-039", project: "Koramangala Villa", area: "Kitchen", category: "MEP", inspector: "Amit S.", date: "Nov 12, 2024", result: "Pass", resultStyle: "bg-green-500/10 text-green-600 border-green-500/20", score: 88 },
  { id: "QC-038", project: "HSR Layout G+3", area: "Staircase", category: "Civil Works", inspector: "Rahul K.", date: "Nov 11, 2024", result: "Conditional", resultStyle: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", score: 74 },
  { id: "QC-037", project: "Indiranagar Residence", area: "Bathrooms", category: "Plumbing", inspector: "Vikram R.", date: "Nov 10, 2024", result: "Pass", resultStyle: "bg-green-500/10 text-green-600 border-green-500/20", score: 91 },
];

const checklistCategories = [
  { name: "Surface Finishing", items: [
    { label: "Paint uniformity & coverage", linked: false },
    { label: "Plaster smoothness (no cracks)", linked: false },
    { label: "Tile alignment & grouting", linked: true },
    { label: "Skirting installation", linked: false },
  ]},
  { name: "Structural Integrity", items: [
    { label: "Column plumb & level", linked: false },
    { label: "Beam alignment verified", linked: false },
    { label: "Slab thickness compliance", linked: false },
    { label: "Waterproofing membrane", linked: true },
  ]},
  { name: "MEP Systems", items: [
    { label: "Electrical load test", linked: false },
    { label: "Plumbing pressure test", linked: false },
    { label: "HVAC airflow measurement", linked: false },
    { label: "Fire safety compliance", linked: true },
  ]},
];

export default function QualityPage() {
  const [checks2, setChecks2] = useState(checklistCategories.map(c => ({
    ...c, items: c.items.map(i => ({ ...i, checked: false }))
  })));

  const toggle = (ci: number, ii: number) => {
    setChecks2(prev => prev.map((cat, cIdx) => cIdx !== ci ? cat : {
      ...cat, items: cat.items.map((item, iIdx) => iIdx !== ii ? item : { ...item, checked: !item.checked })
    }));
  };

  const totalChecked = checks2.flatMap(c => c.items).filter(i => i.checked).length;
  const totalItems = checks2.flatMap(c => c.items).length;

  return (
    <div>
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <span>Dashboard</span>
        <span className="material-symbols-outlined" style={{fontSize:"12px"}}>chevron_right</span>
        <span className="text-[#e30613]">Quality Checks</span>
      </nav>

      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Quality Checks</h2>
          <p className="text-[#666666]">Systematic inspection of workmanship, materials, and compliance across all active sites.</p>
        </div>
        <button className="bg-[#e30613] text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all">
          <span className="material-symbols-outlined" style={{fontSize:"20px"}}>add_circle</span>
          NEW INSPECTION
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[
          { label: "Total Checks", value: "41", icon: "fact_check", color: "#e30613" },
          { label: "Passed", value: "31", icon: "task_alt", color: "#16a34a" },
          { label: "Failed", value: "6", icon: "cancel", color: "#ba1a1a" },
          { label: "Conditional", value: "4", icon: "warning", color: "#ca8a04" },
        ].map((s, i) => (
          <div key={i} style={{background:"#f8f8f8",border:"1px solid #e4e2e1",padding:"24px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px"}}>
              <span style={{fontSize:"10px",fontWeight:"bold",textTransform:"uppercase",letterSpacing:"0.1em",color:"#666666"}}>{s.label}</span>
              <span className="material-symbols-outlined" style={{color:s.color}}>{s.icon}</span>
            </div>
            <div style={{fontSize:"40px",fontWeight:"bold",color:"#333333"}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
        {/* Table */}
        <div className="lg:col-span-3 bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex items-center gap-2">
            <div className="w-1 h-5 bg-[#e30613]" />
            <h3 className="text-[20px] font-medium text-[#333333]">Recent Inspections</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
                {["ID", "Project / Area", "Inspector", "Score", "Result"].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e2e1]">
              {checks.map((c, i) => (
                <tr key={i} className="hover:bg-[#f8f8f8] transition-colors">
                  <td className="px-4 py-4 font-bold text-[#e30613] text-[13px]">{c.id}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#333333] text-[14px]">{c.project}</div>
                    <div className="text-[#666666] text-[11px]">{c.area} · {c.category}</div>
                  </td>
                  <td className="px-4 py-4 text-[#333333] text-[14px]">{c.inspector}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#333333]">{c.score}%</span>
                      <div style={{width:"60px",height:"4px",background:"#e4e2e1",borderRadius:"2px"}}>
                        <div style={{width:`${c.score}%`,height:"100%",background:c.score>=80?"#16a34a":c.score>=70?"#ca8a04":"#ba1a1a",borderRadius:"2px"}} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${c.resultStyle}`}>{c.result}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Live Checklist */}
        <div className="lg:col-span-2 border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[#e30613]" />
                <h3 className="text-[18px] font-medium text-[#333333]">Inspection Checklist</h3>
              </div>
              <span className="text-[12px] font-bold text-[#e30613]">{totalChecked}/{totalItems}</span>
            </div>
            <div style={{height:"4px",background:"#e4e2e1",borderRadius:"2px",marginTop:"12px"}}>
              <div style={{width:`${(totalChecked/totalItems)*100}%`,height:"100%",background:"#e30613",borderRadius:"2px",transition:"width 0.3s"}} />
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[500px] custom-scrollbar">
            {checks2.map((cat, ci) => (
              <div key={ci} className="mb-6">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#e30613] mb-3">{cat.name}</h4>
                <div className="space-y-2">
                  {cat.items.map((item, ii) => (
                    <div key={ii} onClick={() => toggle(ci, ii)}
                      className="flex items-center gap-3 p-3 border border-[#e4e2e1] rounded cursor-pointer hover:border-[#e30613]/40 hover:bg-[#f8f8f8] transition-all">
                      <div style={{width:"18px",height:"18px",borderRadius:"4px",border:`2px solid ${item.checked?"#e30613":"#e4e2e1"}`,background:item.checked?"#e30613":"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                        {item.checked && <span className="material-symbols-outlined text-white" style={{fontSize:"12px"}}>check</span>}
                      </div>
                      <span className="text-[13px] text-[#333333] flex-1">{item.label}</span>
                      {item.linked && <span className="text-[10px] text-[#e30613] font-bold">→ SNAG</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex gap-3">
            <button className="flex-1 border border-[#e4e2e1] py-2 rounded text-[#333333] text-[13px] font-bold hover:bg-[#eae8e7] transition-all">SAVE DRAFT</button>
            <button className="flex-[2] bg-[#e30613] text-white py-2 rounded text-[13px] font-bold hover:opacity-90 shadow-sm transition-all">SUBMIT INSPECTION</button>
          </div>
        </div>
      </div>
    </div>
  );
}
