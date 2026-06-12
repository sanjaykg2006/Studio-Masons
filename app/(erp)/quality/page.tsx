"use client";
import { useState, useEffect } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { loadInspections, saveInspections, loadQualityChecklist, type QualityChecklistDTO } from "../data";

type Result = "Pass" | "Fail" | "Conditional" | "Draft";

interface Inspection {
  id: string;
  project: string;
  area: string;
  category: string;
  inspector: string;
  date: string;
  result: Result;
  score: number;
  remarks?: string;
}

const RESULT_STYLE: Record<Result, string> = {
  Pass:        "bg-green-500/10 text-green-600 border-green-500/20",
  Fail:        "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20",
  Conditional: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  Draft:       "bg-gray-400/10 text-gray-600 border-gray-400/30",
};

// The checklist template is loaded from the database; freshChecklist resets the
// "checked" flags for a new inspection.
const freshChecklist = (template: QualityChecklistDTO[]) =>
  template.map(c => ({ name: c.name, items: c.items.map(i => ({ ...i, checked: false })) }));

function nextId(list: Inspection[]) {
  const max = list.reduce((m, c) => {
    const n = parseInt(c.id.replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `QC-${String(max + 1).padStart(3, "0")}`;
}

function resultFromScore(score: number): Result {
  return score >= 80 ? "Pass" : score >= 70 ? "Conditional" : "Fail";
}

export default function QualityPage() {
  const { projects } = useProject();

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [template, setTemplate] = useState<QualityChecklistDTO[]>([]);

  // Live checklist (right panel) + the inspection currently being conducted.
  const [checks2, setChecks2] = useState<ReturnType<typeof freshChecklist>>([]);
  const [active, setActive] = useState<{ project: string; area: string; category: string; inspector: string; remarks: string } | null>(null);

  // New inspection modal
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ project: "", area: "", category: "", inspector: "", remarks: "" });

  // Detail / edit modal
  const [editing, setEditing] = useState<Inspection | null>(null);
  const [editResult, setEditResult] = useState<Result>("Pass");
  const [editRemarks, setEditRemarks] = useState("");

  // Load inspections + checklist template from the database, then persist changes.
  useEffect(() => {
    loadInspections().then(rows => setInspections(rows as Inspection[])).catch(err => console.warn("[Quality] load failed:", err)).finally(() => setHydrated(true));
    loadQualityChecklist().then(t => { setTemplate(t); setChecks2(freshChecklist(t)); }).catch(err => console.warn("[Quality] checklist load failed:", err));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveInspections(inspections.map(i => ({ id: i.id, project: i.project, area: i.area, category: i.category, inspector: i.inspector, date: i.date, result: i.result, score: i.score, remarks: i.remarks ?? "" })))
      .catch(err => console.warn("[Quality] save failed:", err));
  }, [inspections, hydrated]);

  const toggle = (ci: number, ii: number) => {
    if (!active) return;
    setChecks2(prev => prev.map((cat, cIdx) => cIdx !== ci ? cat : {
      ...cat, items: cat.items.map((item, iIdx) => iIdx !== ii ? item : { ...item, checked: !item.checked })
    }));
  };

  const totalChecked = checks2.flatMap(c => c.items).filter(i => i.checked).length;
  const totalItems = checks2.flatMap(c => c.items).length;

  // Stats derived from the live inspection list.
  const stats = [
    { label: "Total Checks", value: String(inspections.length),                                  icon: "fact_check", color: "#e30613" },
    { label: "Passed",       value: String(inspections.filter(i => i.result === "Pass").length),        icon: "task_alt",   color: "#16a34a" },
    { label: "Failed",       value: String(inspections.filter(i => i.result === "Fail").length),        icon: "cancel",     color: "#ba1a1a" },
    { label: "Conditional",  value: String(inspections.filter(i => i.result === "Conditional").length), icon: "warning",    color: "#ca8a04" },
  ];

  function startInspection() {
    setActive({ ...newForm, project: newForm.project || projects[0]?.name || "" });
    setChecks2(freshChecklist(template));
    setShowNew(false);
  }

  // Persist the active inspection with a given result; score = % of items checked.
  function finishInspection(result: Result) {
    if (!active) return;
    const score = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
    const insp: Inspection = {
      id: nextId(inspections),
      project: active.project,
      area: active.area || "—",
      category: active.category || "—",
      inspector: active.inspector || "—",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      result,
      score,
      remarks: active.remarks,
    };
    setInspections(prev => [insp, ...prev]);
    setActive(null);
    setChecks2(freshChecklist(template));
  }

  function openEdit(insp: Inspection) {
    setEditing(insp);
    setEditResult(insp.result);
    setEditRemarks(insp.remarks ?? "");
  }

  function saveEdit() {
    if (!editing) return;
    setInspections(prev => prev.map(x => x.id === editing.id ? { ...x, result: editResult, remarks: editRemarks } : x));
    setEditing(null);
  }

  const labelCls = "text-[11px] font-bold uppercase text-[#e30613] tracking-wider";
  const inputCls = "border border-[#e4e2e1] rounded px-3 py-2.5 text-[13px] outline-none focus:border-[#e30613]";

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
        <button onClick={() => { setNewForm({ project: "", area: "", category: "", inspector: "", remarks: "" }); setShowNew(true); }}
          className="bg-[#e30613] text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all">
          <span className="material-symbols-outlined" style={{fontSize:"20px"}}>add_circle</span>
          NEW INSPECTION
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {stats.map((s, i) => (
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
                {["ID", "Project / Area", "Inspector", "Result"].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e2e1]">
              {inspections.map((c) => (
                <tr key={c.id} onClick={() => openEdit(c)} className="hover:bg-[#f8f8f8] transition-colors cursor-pointer">
                  <td className="px-4 py-4 font-bold text-[#e30613] text-[13px]">{c.id}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#333333] text-[14px]">{c.project}</div>
                    <div className="text-[#666666] text-[11px]">{c.area} · {c.category}</div>
                  </td>
                  <td className="px-4 py-4 text-[#333333] text-[14px]">{c.inspector}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${RESULT_STYLE[c.result]}`}>{c.result}</span>
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
            {active && (
              <div className="text-[11px] text-[#666666] mt-2">
                {active.project} · {active.area || "—"} · {active.inspector || "—"}
              </div>
            )}
            <div style={{height:"4px",background:"#e4e2e1",borderRadius:"2px",marginTop:"12px"}}>
              <div style={{width:`${(totalChecked/totalItems)*100}%`,height:"100%",background:"#e30613",borderRadius:"2px",transition:"width 0.3s"}} />
            </div>
          </div>

          {!active ? (
            <div className="p-10 flex flex-col items-center justify-center text-center gap-3" style={{minHeight:"320px"}}>
              <span className="material-symbols-outlined" style={{fontSize:"40px",color:"#e4e2e1"}}>checklist</span>
              <p className="text-[14px] text-[#666666]">No active inspection.</p>
              <button onClick={() => { setNewForm({ project: "", area: "", category: "", inspector: "", remarks: "" }); setShowNew(true); }}
                className="text-[13px] font-bold text-[#e30613] hover:underline">Start a new inspection →</button>
            </div>
          ) : (
            <>
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
                <button onClick={() => finishInspection("Draft")} className="flex-1 border border-[#e4e2e1] py-2 rounded text-[#333333] text-[13px] font-bold hover:bg-[#eae8e7] transition-all">SAVE DRAFT</button>
                <button onClick={() => finishInspection(resultFromScore(totalItems > 0 ? Math.round((totalChecked/totalItems)*100) : 0))} className="flex-[2] bg-[#e30613] text-white py-2 rounded text-[13px] font-bold hover:opacity-90 shadow-sm transition-all">SUBMIT INSPECTION</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Inspection Modal */}
      {showNew && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{background:"rgba(0,0,0,0.45)"}} onClick={() => setShowNew(false)}>
          <div className="bg-white border border-[#e4e2e1] w-full max-w-[480px] rounded-lg overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
              <h3 className="text-[20px] font-bold text-[#333333]">New Inspection</h3>
              <button onClick={() => setShowNew(false)} className="text-[#666666] flex"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Project</label>
                <select value={newForm.project} onChange={e => setNewForm(f => ({ ...f, project: e.target.value }))} className={inputCls + " bg-white"}>
                  <option value="">Select a project…</option>
                  {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Area</label>
                  <input value={newForm.area} onChange={e => setNewForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Master Bedroom" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Category</label>
                  <input value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Finishing" className={inputCls} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Inspector</label>
                <input value={newForm.inspector} onChange={e => setNewForm(f => ({ ...f, inspector: e.target.value }))} placeholder="e.g. Vikram R." className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Remarks</label>
                <textarea value={newForm.remarks} onChange={e => setNewForm(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Notes for this inspection…" className={inputCls + " resize-none font-[inherit]"} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-end gap-3">
              <button onClick={() => setShowNew(false)} className="px-5 py-2 border border-[#e4e2e1] rounded bg-white text-[#333333] font-bold text-[13px]">Cancel</button>
              <button onClick={startInspection} disabled={!newForm.project && projects.length === 0}
                className="px-6 py-2 rounded text-white font-bold text-[13px]" style={{background:"#e30613"}}>Start Inspection</button>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Detail / Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{background:"rgba(0,0,0,0.45)"}} onClick={() => setEditing(null)}>
          <div className="bg-white border border-[#e4e2e1] w-full max-w-[480px] rounded-lg overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
              <h3 className="text-[20px] font-bold text-[#333333]">Inspection {editing.id}</h3>
              <button onClick={() => setEditing(null)} className="text-[#666666] flex"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 bg-[#f8f8f8] border border-[#e4e2e1] rounded p-4">
                {[
                  { k: "Project", v: editing.project },
                  { k: "Area", v: editing.area },
                  { k: "Category", v: editing.category },
                  { k: "Inspector", v: editing.inspector },
                  { k: "Date", v: editing.date },
                  { k: "Score", v: `${editing.score}%` },
                ].map(d => (
                  <div key={d.k}>
                    <p className="text-[9px] font-bold uppercase text-[#999999]">{d.k}</p>
                    <p className="text-[13px] font-medium text-[#333333]">{d.v}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Result</label>
                <select value={editResult} onChange={e => setEditResult(e.target.value as Result)} className={inputCls + " bg-white"}>
                  {(["Pass", "Conditional", "Fail", "Draft"] as Result[]).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Remarks</label>
                <textarea value={editRemarks} onChange={e => setEditRemarks(e.target.value)} rows={3} placeholder="Inspection remarks…" className={inputCls + " resize-none font-[inherit]"} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="px-5 py-2 border border-[#e4e2e1] rounded bg-white text-[#333333] font-bold text-[13px]">Cancel</button>
              <button onClick={saveEdit} className="px-6 py-2 rounded text-white font-bold text-[13px]" style={{background:"#16a34a"}}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
