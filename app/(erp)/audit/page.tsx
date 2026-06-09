"use client";
import { useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";

interface AuditItem {
  label: string;
  signed: boolean;
  signedBy: string | null;
  date: string | null;
}

interface AuditSection {
  section: string;
  items: AuditItem[];
}

const initialAuditItems: AuditSection[] = [
  { section: "Structural & Civil", items: [
    { label: "Final structural inspection sign-off", signed: true, signedBy: "Vikram R.", date: "Nov 10, 2024" },
    { label: "Waterproofing test completed", signed: true, signedBy: "Amit S.", date: "Nov 09, 2024" },
    { label: "Slab & column compliance verified", signed: false, signedBy: null, date: null },
    { label: "Roof drainage functional test", signed: false, signedBy: null, date: null },
  ]},
  { section: "MEP Commissioning", items: [
    { label: "Electrical load test passed", signed: true, signedBy: "Rahul K.", date: "Nov 11, 2024" },
    { label: "Plumbing pressure test signed", signed: true, signedBy: "Sneha P.", date: "Nov 11, 2024" },
    { label: "HVAC balancing report approved", signed: false, signedBy: null, date: null },
    { label: "Fire suppression system checked", signed: false, signedBy: null, date: null },
  ]},
  { section: "Finishing & Handover", items: [
    { label: "Snag list cleared (zero open snags)", signed: false, signedBy: null, date: null },
    { label: "Client walkthrough conducted", signed: false, signedBy: null, date: null },
    { label: "Measurement book submitted", signed: true, signedBy: "Vikram R.", date: "Nov 12, 2024" },
    { label: "As-built drawings handed over", signed: false, signedBy: null, date: null },
  ]},
  { section: "Documentation", items: [
    { label: "Warranty documents compiled", signed: false, signedBy: null, date: null },
    { label: "Vendor invoices reconciled", signed: true, signedBy: "Sneha P.", date: "Nov 13, 2024" },
    { label: "BOQ vs actual cost statement", signed: false, signedBy: null, date: null },
    { label: "Project closeout report", signed: false, signedBy: null, date: null },
  ]},
];

const auditProjects = [
  { name: "Indiranagar Residence", completion: 78, status: "In Audit" },
  { name: "Koramangala Villa", completion: 95, status: "Near Complete" },
  { name: "Whitefield Office", completion: 42, status: "Early Stage" },
];

export default function AuditPage() {
  const { selectedProject } = useProject();
  const [selected, setSelected] = useState(0);
  const [items, setItems] = useState<AuditSection[]>(initialAuditItems);

  const toggleSign = (si: number, ii: number) => {
    setItems(prev =>
      prev.map((sec, sIdx): AuditSection =>
        sIdx !== si ? sec : {
          ...sec,
          items: sec.items.map((item, iIdx): AuditItem =>
            iIdx !== ii ? item : {
              ...item,
              signed: !item.signed,
              signedBy: !item.signed ? "You" : null,
              date: !item.signed
                ? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                : null,
            }
          ),
        }
      )
    );
  };

  const totalItems = items.flatMap(s => s.items).length;
  const signedItems = items.flatMap(s => s.items).filter(i => i.signed).length;
  const pct = Math.round((signedItems / totalItems) * 100);

  if (!selectedProject) {
    return (
      <div>
        <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
          <span>Dashboard</span>
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
          <span className="text-[#e30613]">Audit & Handover</span>
        </nav>
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">Audit & Handover</h2>
        <p className="text-[#666666] mb-10">Final sign-off checklist, measurement book, and project closeout documentation.</p>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[#f8f8f8] border border-[#e4e2e1] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-[#e4e2e1]">checklist</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#333333] mb-2">No Project Selected</h3>
          <p className="text-[16px] text-[#666666] w-full max-w-[28rem]">Use the <span className="font-bold text-[#e30613]">Project Selector</span> in the top bar to choose a project and view its audit checklist.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <span>Dashboard</span>
        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
        <span className="text-[#e30613]">Audit & Handover</span>
      </nav>

      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Audit & Handover</h2>
          <p className="text-[#666666]">
            Final sign-off checklist for <span className="font-bold text-[#333333]">{selectedProject.name}</span>
          </p>
        </div>
        <button className="bg-[#e30613] text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>download</span>
          EXPORT REPORT
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
        {/* Project selector panel */}
        <div className="border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8]">
            <h3 className="text-[14px] font-bold text-[#333333] uppercase tracking-wider">Projects</h3>
          </div>
          <div className="divide-y divide-[#e4e2e1]">
            {auditProjects.map((p, i) => (
              <div key={i} onClick={() => setSelected(i)}
                className={`p-4 cursor-pointer transition-all ${selected === i ? "bg-[#e30613]/5 border-l-4 border-[#e30613]" : "hover:bg-[#f8f8f8]"}`}>
                <p className={`font-medium text-[14px] mb-2 ${selected === i ? "text-[#e30613]" : "text-[#333333]"}`}>{p.name}</p>
                <div style={{ height: "4px", background: "#e4e2e1", borderRadius: "2px", marginBottom: "6px" }}>
                  <div style={{ width: `${p.completion}%`, height: "100%", background: selected === i ? "#e30613" : "#666666", borderRadius: "2px" }} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-[#666666]">{p.completion}% complete</span>
                  <span className={`text-[10px] font-bold ${selected === i ? "text-[#e30613]" : "text-[#666666]"}`}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="lg:col-span-3 border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
            <div>
              <h3 className="text-[20px] font-medium text-[#333333]">{auditProjects[selected].name} — Handover Checklist</h3>
              <p className="text-[#666666] text-[13px] mt-1">{signedItems} of {totalItems} items signed off</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "60px", height: "60px", borderRadius: "50%", border: "4px solid #e4e2e1", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: `conic-gradient(#e30613 ${pct * 3.6}deg, #e4e2e1 0deg)` }}>
                <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#e30613" }}>{pct}%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 overflow-y-auto max-h-[520px] custom-scrollbar">
            {items.map((section, si) => (
              <div key={si} className="mb-8">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#e30613] mb-4 flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-[#e30613] inline-block" />
                  {section.section}
                </h4>
                <div className="space-y-2">
                  {section.items.map((item, ii) => (
                    <div key={ii} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 16px", border: `1px solid ${item.signed ? "rgba(22,163,74,0.2)" : "#e4e2e1"}`, borderRadius: "8px", background: item.signed ? "rgba(22,163,74,0.03)" : "white", transition: "all 0.2s" }}>
                      <button onClick={() => toggleSign(si, ii)}
                        style={{ width: "22px", height: "22px", borderRadius: "50%", border: `2px solid ${item.signed ? "#16a34a" : "#e4e2e1"}`, background: item.signed ? "#16a34a" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
                        {item.signed && <span className="material-symbols-outlined text-white" style={{ fontSize: "14px" }}>check</span>}
                      </button>
                      <span style={{ flex: 1, fontSize: "14px", color: "#333333", textDecoration: item.signed ? "line-through" : "none", opacity: item.signed ? 0.7 : 1 }}>{item.label}</span>
                      {item.signed ? (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "11px", fontWeight: "bold", color: "#16a34a" }}>{item.signedBy}</p>
                          <p style={{ fontSize: "10px", color: "#666666" }}>{item.date}</p>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#666666", fontStyle: "italic" }}>Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
            <p className="text-[#666666] text-[13px]">All items must be signed off before handover</p>
            <button
              className={`px-6 py-2 rounded font-bold text-[14px] transition-all shadow-sm ${pct === 100 ? "bg-[#16a34a] text-white hover:opacity-90" : "bg-[#e4e2e1] text-[#666666] cursor-not-allowed"}`}
              disabled={pct !== 100}>
              {pct === 100 ? "COMPLETE HANDOVER" : `${100 - pct}% REMAINING`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
