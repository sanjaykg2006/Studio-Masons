"use client";
import { useState, useEffect } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { useToast } from "@/lib/toast";
import {
  loadQualityPage, saveInspections,
  createQualityTemplate, updateQualityTemplate, deleteQualityTemplate,
  type QualityChecklistDTO, type QualityTemplateDTO, type InspectionResponseDTO,
} from "../data";

type Result = "Pass" | "Fail" | "Conditional" | "Draft";

// A live checklist item gathers the two inspection levels, a not-applicable flag,
// and free-text remarks — the controls that replace the old single checkbox.
type LiveItem = { label: string; linked: boolean; level1: boolean; level2: boolean; na: boolean; remarks: string };
type LiveCat = { name: string; items: LiveItem[] };

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
  workType?: string;
  contractor?: string;
  drawingNo?: string;
  responses?: InspectionResponseDTO[];
}

// The inspection report number, auto-generated per report from its sequential
// ID so each downloaded document carries its own number (SMPL/PJ/R<NN> format).
const reportNoFor = (insp: Inspection) => {
  const n = parseInt(insp.id.replace(/\D/g, ""), 10);
  return `SMPL/PJ/R${isNaN(n) ? insp.id : String(n).padStart(2, "0")}`;
};

const RESULT_STYLE: Record<Result, string> = {
  Pass:        "bg-green-500/10 text-green-600 border-green-500/20",
  Fail:        "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20",
  Conditional: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  Draft:       "bg-gray-400/10 text-gray-600 border-gray-400/30",
};

// Build a blank live checklist from a template's sections.
const freshChecklist = (template: QualityChecklistDTO[]): LiveCat[] =>
  template.map(c => ({ name: c.name, items: c.items.map(i => ({ label: i.label, linked: i.linked, level1: false, level2: false, na: false, remarks: "" })) }));

// Level 2 is the final sign-off, so an item is complete only when Level 2 (or N/A)
// is set. Level 1 alone is an in-progress first-stage check.
const isDone = (it: { level1: boolean; level2: boolean; na: boolean }) => it.na || it.level2;
const isPartial = (it: { level1: boolean; level2: boolean; na: boolean }) => !it.na && it.level1 && !it.level2;

const todayStr = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const blankForm = () => ({ project: "", area: "", category: "", inspector: "", remarks: "", workType: "", contractor: "", drawingNo: "", date: todayStr() });
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

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

// Render a completed inspection as a print-ready HTML document matching the SMPL
// "Installation Check List" template, then open the browser print dialog (Save as PDF).
function downloadInspection(insp: Inspection) {
  const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const logo = `${window.location.origin}/logo-full.jpg`;
  const cats = insp.responses ?? [];

  let n = 0;
  const rows = cats.map((cat) => {
    const head = `<tr class="sec"><td></td><td colspan="4">${esc(cat.name)}</td></tr>`;
    const items = cat.items.map((it) => {
      n += 1;
      const l1 = it.na ? "N/A" : it.level1 ? "✓" : "";
      const l2 = it.na ? "" : it.level2 ? "✓" : "";
      return `<tr><td class="c">${n}</td><td>${esc(it.label)}</td><td class="c">${l1}</td><td class="c">${l2}</td><td>${esc(it.remarks)}</td></tr>`;
    }).join("");
    return head + items;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(insp.id)} — ${esc(insp.workType || "Checklist")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1b1c1c; margin: 24px; font-size: 12px; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .top h1 { font-size: 18px; margin: 0; flex: 1; text-align: center; }
  .top img { height: 38px; }
  table { width: 100%; border-collapse: collapse; }
  .meta td { border: 1px solid #1b1c1c; padding: 4px 6px; }
  .meta .lbl { font-weight: bold; width: 26%; }
  .grid { margin-top: 10px; }
  .grid th, .grid td { border: 1px solid #1b1c1c; padding: 5px 6px; vertical-align: top; }
  .grid th { background: #f0f0f0; text-align: center; font-size: 11px; }
  .grid td.c { text-align: center; width: 60px; font-weight: bold; }
  .grid td:first-child { width: 42px; text-align: center; }
  .grid tr.sec td { background: #f6f6f6; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }
  .obs { border: 1px solid #1b1c1c; border-top: none; padding: 8px 6px; min-height: 42px; }
  .sign { margin-top: 18px; width: 100%; border-collapse: collapse; }
  .sign td { border: 1px solid #1b1c1c; padding: 6px 8px; width: 33.33%; vertical-align: top; }
  .sign .hdr { font-weight: bold; background: #f0f0f0; }
  .sign .line { padding-top: 22px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <div class="top"><h1>Installation Check List</h1><img src="${logo}" alt="Studio Masons" onerror="this.style.display='none'"/></div>
  <table class="meta">
    <tr><td class="lbl">Name of the Contractor</td><td>${esc(insp.contractor || "")}</td><td class="lbl">Date</td><td>${esc(insp.date || "")}</td></tr>
    <tr><td class="lbl">Description of work / BOQ no</td><td colspan="3">${esc(insp.workType || "")}</td></tr>
    <tr><td class="lbl">Drawing no</td><td colspan="3">${esc(insp.drawingNo || "")}</td></tr>
    <tr><td class="lbl">Name of the cabin/location</td><td colspan="3">${esc(insp.area || "")}</td></tr>
    <tr><td class="lbl">Inspection Report No</td><td colspan="3">${esc(reportNoFor(insp))}</td></tr>
  </table>
  <table class="grid">
    <thead><tr><th>S NO</th><th>Description</th><th>Level 1</th><th>Level 2</th><th>Remarks</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#999;padding:16px">No checklist items recorded.</td></tr>`}</tbody>
  </table>
  <div class="obs"><b>Observations:</b> ${esc(insp.remarks || "")}</div>
  <table class="sign">
    <tr><td class="hdr">For Contractor</td><td class="hdr">For Consultant</td><td class="hdr">For Client</td></tr>
    <tr><td>Name:</td><td>Name:</td><td>Name:</td></tr>
    <tr><td class="line">Signature:</td><td class="line">Signature:</td><td class="line">Signature:</td></tr>
    <tr><td>Date:</td><td>Date:</td><td>Date:</td></tr>
  </table>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to download the document."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export default function QualityPage() {
  const { projects } = useProject();
  const toast = useToast();

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [templates, setTemplates] = useState<QualityTemplateDTO[]>([]);

  // Live checklist (right panel) + the inspection currently being conducted.
  const [checks2, setChecks2] = useState<LiveCat[]>([]);
  const [active, setActive] = useState<ReturnType<typeof blankForm> | null>(null);
  // Id of the inspection being edited; null while conducting a brand-new one.
  const [activeId, setActiveId] = useState<string | null>(null);

  // New inspection modal
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(blankForm());
  // Work-type picker: filter by discipline + free-text search over the templates.
  const [discFilter, setDiscFilter] = useState("All");
  const [tplSearch, setTplSearch] = useState("");

  // Detail / edit modal
  const [editing, setEditing] = useState<Inspection | null>(null);
  const [editResult, setEditResult] = useState<Result>("Pass");
  const [editRemarks, setEditRemarks] = useState("");

  // Checklist template editor
  const [showEditor, setShowEditor] = useState(false);
  const [editTpl, setEditTpl] = useState<QualityTemplateDTO | null>(null);
  const [edDisc, setEdDisc] = useState("All");
  const [edSearch, setEdSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Load inspections + checklist templates from the database, then persist changes.
  useEffect(() => {
    loadQualityPage()
      .then(d => { setInspections(d.inspections as Inspection[]); setTemplates(d.templates); })
      .catch(err => console.warn("[Quality] load failed:", err))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveInspections(inspections.map(i => ({ id: i.id, project: i.project, area: i.area, category: i.category, inspector: i.inspector, date: i.date, result: i.result, score: i.score, remarks: i.remarks ?? "", workType: i.workType ?? "", contractor: i.contractor ?? "", drawingNo: i.drawingNo ?? "", responses: i.responses ?? [] })))
      .catch(err => console.warn("[Quality] save failed:", err));
  }, [inspections, hydrated]);

  // ── Live checklist item mutators ──────────────────────────────
  const patchItem = (ci: number, ii: number, patch: Partial<LiveItem>) =>
    setChecks2(prev => prev.map((cat, c) => c !== ci ? cat : { ...cat, items: cat.items.map((it, i) => i !== ii ? it : { ...it, ...patch }) }));
  // Level 2 (final sign-off) implies Level 1; clearing Level 1 also clears Level 2.
  const toggleL1 = (ci: number, ii: number, it: LiveItem) => patchItem(ci, ii, it.level1 ? { level1: false, level2: false, na: false } : { level1: true, na: false });
  const toggleL2 = (ci: number, ii: number, it: LiveItem) => patchItem(ci, ii, it.level2 ? { level2: false } : { level1: true, level2: true, na: false });
  const toggleNA = (ci: number, ii: number, it: LiveItem) => patchItem(ci, ii, { na: !it.na, level1: false, level2: false });

  const allItems = checks2.flatMap(c => c.items);
  const totalItems = allItems.length;
  const totalChecked = allItems.filter(isDone).length;
  const liveScore = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;

  // Work-type picker: discipline tabs + search over template names.
  const disciplines = ["All", ...Array.from(new Set(templates.map(t => t.discipline)))];
  const filterTemplates = (disc: string, q: string) => templates.filter(t =>
    (disc === "All" || t.discipline === disc) && t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const filteredTemplates = filterTemplates(discFilter, tplSearch);
  const editorList = filterTemplates(edDisc, edSearch);

  // Stats derived from the live inspection list.
  const stats = [
    { label: "Total Checks", value: String(inspections.length),                                  icon: "fact_check", color: "#e30613" },
    { label: "Passed",       value: String(inspections.filter(i => i.result === "Pass").length),        icon: "task_alt",   color: "#16a34a" },
    { label: "Failed",       value: String(inspections.filter(i => i.result === "Fail").length),        icon: "cancel",     color: "#ba1a1a" },
    { label: "Conditional",  value: String(inspections.filter(i => i.result === "Conditional").length), icon: "warning",    color: "#ca8a04" },
  ];

  function openNew() {
    setNewForm(blankForm());
    setDiscFilter("All");
    setTplSearch("");
    setShowNew(true);
  }

  function startInspection() {
    const tpl = templates.find(t => t.name === newForm.workType);
    setActive({ ...newForm, project: newForm.project || projects[0]?.name || "" });
    setChecks2(freshChecklist(tpl?.categories ?? []));
    setActiveId(null);
    setShowNew(false);
  }

  // Reopen an existing inspection's checklist in the live panel to keep editing it.
  // Falls back to a fresh template if the inspection has no saved item snapshot.
  function resumeInspection(insp: Inspection) {
    const blank = (v: string) => (v === "—" ? "" : v);
    setActive({
      project: insp.project, area: blank(insp.area), category: blank(insp.category),
      inspector: blank(insp.inspector), remarks: insp.remarks ?? "", workType: insp.workType ?? "",
      contractor: insp.contractor ?? "", drawingNo: insp.drawingNo ?? "", date: insp.date || todayStr(),
    });
    const tpl = templates.find(t => t.name === insp.workType);
    setChecks2(insp.responses && insp.responses.length ? clone(insp.responses) as LiveCat[] : freshChecklist(tpl?.categories ?? []));
    setActiveId(insp.id);
    setEditing(null);
  }

  // Persist the active inspection with a given result; snapshots the filled checklist.
  // Updates the existing inspection when resuming, otherwise creates a new one.
  function finishInspection(result: Result) {
    if (!active) return;
    const fields = {
      project: active.project,
      area: active.area || "—",
      category: active.category || "—",
      inspector: active.inspector || "—",
      date: active.date || todayStr(),
      result,
      score: liveScore,
      remarks: active.remarks,
      workType: active.workType || "",
      contractor: active.contractor || "",
      drawingNo: active.drawingNo || "",
      responses: clone(checks2),
    };
    if (activeId) {
      setInspections(prev => prev.map(x => x.id === activeId ? { ...x, ...fields } : x));
    } else {
      setInspections(prev => [{ id: nextId(prev), ...fields }, ...prev]);
    }
    setActive(null);
    setActiveId(null);
    setChecks2([]);
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

  function deleteInspection() {
    if (!editing) return;
    if (!confirm(`Delete inspection ${editing.id}? This cannot be undone.`)) return;
    const id = editing.id;
    setInspections(prev => prev.filter(x => x.id !== id));
    if (activeId === id) { setActive(null); setActiveId(null); setChecks2([]); }
    setEditing(null);
    toast.success("Inspection deleted", `${id} was removed.`);
  }

  // ── Template editor ───────────────────────────────────────────
  function openEditor() {
    setEditTpl(null);
    setEdDisc("All");
    setEdSearch("");
    setShowEditor(true);
  }
  const mutTpl = (fn: (t: QualityTemplateDTO) => void) => setEditTpl(prev => { if (!prev) return prev; const next = clone(prev); fn(next); return next; });
  const addSection = () => mutTpl(t => { t.categories.push({ name: "New Section", items: [] }); });
  const renameSection = (ci: number, name: string) => mutTpl(t => { t.categories[ci].name = name; });
  const deleteSection = (ci: number) => mutTpl(t => { t.categories.splice(ci, 1); });
  const addItem = (ci: number) => mutTpl(t => { t.categories[ci].items.push({ label: "", linked: false }); });
  const editItem = (ci: number, ii: number, label: string) => mutTpl(t => { t.categories[ci].items[ii].label = label; });
  const toggleItemLinked = (ci: number, ii: number) => mutTpl(t => { t.categories[ci].items[ii].linked = !t.categories[ci].items[ii].linked; });
  const deleteItem = (ci: number, ii: number) => mutTpl(t => { t.categories[ci].items.splice(ii, 1); });

  async function saveTemplate() {
    if (!editTpl) return;
    setSaving(true);
    try {
      const cleaned: QualityTemplateDTO = {
        ...editTpl,
        categories: editTpl.categories.map(c => ({ name: c.name.trim() || "Section", items: c.items.filter(i => i.label.trim()).map(i => ({ label: i.label.trim(), linked: i.linked })) })),
      };
      await updateQualityTemplate(cleaned);
      setTemplates(prev => prev.map(t => t.id === cleaned.id ? cleaned : t));
      setEditTpl(null);
      toast.success("Checklist saved", `"${cleaned.name}" was updated.`);
    } catch (err) {
      console.warn("[Quality] template save failed:", err);
      toast.error("Couldn't save the checklist", "Your changes were not saved — please try again.");
    } finally {
      setSaving(false);
    }
  }
  async function newTemplate() {
    setSaving(true);
    try {
      const dto = await createQualityTemplate({ name: "New Checklist", discipline: "C&I" });
      setTemplates(prev => [...prev, dto]);
      setEditTpl(clone(dto));
    } catch (err) {
      console.warn("[Quality] template create failed:", err);
      toast.error("Couldn't create the checklist", "Please try again.");
    } finally {
      setSaving(false);
    }
  }
  async function removeTemplate() {
    if (!editTpl) return;
    if (!confirm(`Delete the "${editTpl.name}" checklist? This cannot be undone.`)) return;
    const name = editTpl.name;
    setSaving(true);
    try {
      await deleteQualityTemplate(editTpl.id);
      setTemplates(prev => prev.filter(t => t.id !== editTpl.id));
      setEditTpl(null);
      toast.success("Checklist deleted", `"${name}" was removed.`);
    } catch (err) {
      console.warn("[Quality] template delete failed:", err);
      toast.error("Couldn't delete the checklist", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const labelCls = "text-[11px] font-bold uppercase text-[#e30613] tracking-wider";
  const inputCls = "border border-[#e4e2e1] rounded px-3 py-2.5 text-[13px] outline-none focus:border-[#e30613]";

  // Small reusable level/NA toggle for the live checklist.
  const Toggle = ({ on, label, color, onClick }: { on: boolean; label: string; color: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all ${on ? "text-white" : "bg-white text-[#666666] border-[#e4e2e1] hover:border-[#e30613]/40"}`}
      style={on ? { background: color, borderColor: color } : undefined}>
      {label}
    </button>
  );

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
        <div className="flex items-center gap-3">
          <button onClick={openEditor}
            className="border border-[#e4e2e1] text-[#333333] px-5 py-2.5 rounded font-bold flex items-center gap-2 hover:bg-[#f8f8f8] transition-all">
            <span className="material-symbols-outlined" style={{fontSize:"20px"}}>edit_note</span>
            EDIT CHECKLISTS
          </button>
          <button onClick={openNew}
            className="bg-[#e30613] text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all">
            <span className="material-symbols-outlined" style={{fontSize:"20px"}}>add_circle</span>
            NEW INSPECTION
          </button>
        </div>
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
                {["ID", "Project / Area", "Inspector", "Result", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e2e1]">
              {inspections.map((c) => (
                <tr key={c.id} onClick={() => openEdit(c)} className="hover:bg-[#f8f8f8] transition-colors cursor-pointer">
                  <td className="px-4 py-4 font-bold text-[#e30613] text-[13px]">{c.id}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#333333] text-[14px]">{c.project}</div>
                    <div className="text-[#666666] text-[11px]">{c.workType || c.area} · {c.category}</div>
                  </td>
                  <td className="px-4 py-4 text-[#333333] text-[14px]">{c.inspector}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${RESULT_STYLE[c.result]}`}>{c.result}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); downloadInspection(c); }} title="Download document"
                      className="text-[#666666] hover:text-[#e30613] transition-colors flex"><span className="material-symbols-outlined" style={{fontSize:"20px"}}>download</span></button>
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
                {activeId && <span className="text-[10px] font-bold uppercase tracking-wide text-[#0059a8] bg-[#0059a8]/10 px-2 py-0.5 rounded-full">Editing {activeId}</span>}
              </div>
              <span className="text-[12px] font-bold text-[#e30613]">{totalChecked}/{totalItems}</span>
            </div>
            {active && (
              <div className="text-[11px] text-[#666666] mt-2">
                {active.workType ? <span className="font-bold text-[#333333]">{active.workType}</span> : null}
                {active.workType ? " · " : ""}{active.project} · {active.area || "—"} · {active.inspector || "—"}
              </div>
            )}
            <div style={{height:"4px",background:"#e4e2e1",borderRadius:"2px",marginTop:"12px"}}>
              <div style={{width:`${liveScore}%`,height:"100%",background:"#e30613",borderRadius:"2px",transition:"width 0.3s"}} />
            </div>
          </div>

          {!active ? (
            <div className="p-10 flex flex-col items-center justify-center text-center gap-3" style={{minHeight:"320px"}}>
              <span className="material-symbols-outlined" style={{fontSize:"40px",color:"#e4e2e1"}}>checklist</span>
              <p className="text-[14px] text-[#666666]">No active inspection.</p>
              <button onClick={openNew} className="text-[13px] font-bold text-[#e30613] hover:underline">Start a new inspection →</button>
            </div>
          ) : (
            <>
              <div className="p-4 overflow-y-auto max-h-[560px] custom-scrollbar">
                {checks2.map((cat, ci) => (
                  <div key={ci} className="mb-6">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#e30613] mb-3">{cat.name}</h4>
                    <div className="space-y-2">
                      {cat.items.map((item, ii) => (
                        <div key={ii} className={`p-3 border rounded transition-all ${item.na ? "border-[#e4e2e1] bg-[#f8f8f8]" : isDone(item) ? "border-[#16a34a]/30 bg-[#16a34a]/5" : isPartial(item) ? "border-[#ca8a04]/40 bg-[#ca8a04]/5" : "border-[#e4e2e1]"}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-[13px] text-[#333333] flex-1">{item.label}</span>
                            {item.linked && <span className="text-[10px] text-[#e30613] font-bold shrink-0">→ SNAG</span>}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Toggle on={item.level1} label="Level 1" color="#16a34a" onClick={() => toggleL1(ci, ii, item)} />
                            <Toggle on={item.level2} label="Level 2" color="#0059a8" onClick={() => toggleL2(ci, ii, item)} />
                            <Toggle on={item.na} label="N/A" color="#666666" onClick={() => toggleNA(ci, ii, item)} />
                          </div>
                          <input value={item.remarks} onChange={e => patchItem(ci, ii, { remarks: e.target.value })}
                            placeholder="Remarks…" className="w-full border border-[#e4e2e1] rounded px-2.5 py-1.5 text-[12px] outline-none focus:border-[#e30613]" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex gap-3">
                <button onClick={() => finishInspection("Draft")} className="flex-1 border border-[#e4e2e1] py-2 rounded text-[#333333] text-[13px] font-bold hover:bg-[#eae8e7] transition-all">SAVE DRAFT</button>
                <button onClick={() => finishInspection(resultFromScore(liveScore))} className="flex-[2] bg-[#e30613] text-white py-2 rounded text-[13px] font-bold hover:opacity-90 shadow-sm transition-all">SUBMIT INSPECTION</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Inspection Modal */}
      {showNew && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{background:"rgba(0,0,0,0.45)"}} onClick={() => setShowNew(false)}>
          <div className="bg-white border border-[#e4e2e1] w-full max-w-[480px] max-h-[90vh] rounded-lg overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center shrink-0">
              <h3 className="text-[20px] font-bold text-[#333333]">New Inspection</h3>
              <button onClick={() => setShowNew(false)} className="text-[#666666] flex"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Project</label>
                <select value={newForm.project} onChange={e => setNewForm(f => ({ ...f, project: e.target.value }))} className={inputCls + " bg-white"}>
                  <option value="">Select a project…</option>
                  {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              {/* Work-type checklist picker: discipline tabs + search + selectable list */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Work Type / Checklist</label>
                <div className="flex gap-1.5 flex-wrap">
                  {disciplines.map(d => (
                    <button key={d} type="button" onClick={() => setDiscFilter(d)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${discFilter === d ? "bg-[#e30613] text-white border-[#e30613]" : "bg-white text-[#666666] border-[#e4e2e1] hover:border-[#e30613]/40"}`}>
                      {d}
                    </button>
                  ))}
                </div>
                <input value={tplSearch} onChange={e => setTplSearch(e.target.value)} placeholder="Search checklists…" className={inputCls} />
                <div className="border border-[#e4e2e1] rounded max-h-[180px] overflow-y-auto custom-scrollbar divide-y divide-[#e4e2e1]">
                  {filteredTemplates.length === 0 ? (
                    <div className="px-3 py-4 text-[12px] text-[#999999] text-center">No checklists match.</div>
                  ) : filteredTemplates.map(t => (
                    <div key={t.id} onClick={() => setNewForm(f => ({ ...f, workType: t.name }))}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer transition-all ${newForm.workType === t.name ? "bg-[#e30613]/5" : "hover:bg-[#f8f8f8]"}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div style={{width:"16px",height:"16px",borderRadius:"50%",border:`2px solid ${newForm.workType===t.name?"#e30613":"#e4e2e1"}`,background:newForm.workType===t.name?"#e30613":"white",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {newForm.workType === t.name && <div style={{width:"6px",height:"6px",borderRadius:"50%",background:"white"}} />}
                        </div>
                        <span className="text-[13px] text-[#333333] truncate">{t.name}</span>
                      </div>
                      <span className="text-[9px] font-bold uppercase text-[#999999] shrink-0">{t.discipline}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Contractor</label>
                  <input value={newForm.contractor} onChange={e => setNewForm(f => ({ ...f, contractor: e.target.value }))} placeholder="e.g. ABC Interiors" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Drawing No</label>
                  <input value={newForm.drawingNo} onChange={e => setNewForm(f => ({ ...f, drawingNo: e.target.value }))} placeholder="e.g. SD-204" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Location / Cabin</label>
                  <input value={newForm.area} onChange={e => setNewForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Master Bedroom" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Category</label>
                  <input value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Finishing" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Inspector</label>
                  <input value={newForm.inspector} onChange={e => setNewForm(f => ({ ...f, inspector: e.target.value }))} placeholder="e.g. Vikram R." className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Date</label>
                  <input value={newForm.date} onChange={e => setNewForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Remarks</label>
                <textarea value={newForm.remarks} onChange={e => setNewForm(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Notes for this inspection…" className={inputCls + " resize-none font-[inherit]"} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowNew(false)} className="px-5 py-2 border border-[#e4e2e1] rounded bg-white text-[#333333] font-bold text-[13px]">Cancel</button>
              <button onClick={startInspection} disabled={!newForm.workType || (!newForm.project && projects.length === 0)}
                className="px-6 py-2 rounded text-white font-bold text-[13px] disabled:opacity-50 disabled:cursor-not-allowed" style={{background:"#e30613"}}>Start Inspection</button>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Detail / Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{background:"rgba(0,0,0,0.45)"}} onClick={() => setEditing(null)}>
          <div className="bg-white border border-[#e4e2e1] w-full max-w-[560px] max-h-[90vh] rounded-lg overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center shrink-0">
              <h3 className="text-[20px] font-bold text-[#333333]">Inspection {editing.id}</h3>
              <button onClick={() => setEditing(null)} className="text-[#666666] flex"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4 bg-[#f8f8f8] border border-[#e4e2e1] rounded p-4">
                {[
                  { k: "Project", v: editing.project },
                  { k: "Work Type", v: editing.workType || "—" },
                  { k: "Contractor", v: editing.contractor || "—" },
                  { k: "Drawing No", v: editing.drawingNo || "—" },
                  { k: "Location", v: editing.area },
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

              {/* Filled checklist (read-only) */}
              {editing.responses && editing.responses.length > 0 && (
                <div className="border border-[#e4e2e1] rounded overflow-hidden">
                  {editing.responses.map((cat, ci) => (
                    <div key={ci}>
                      <div className="px-3 py-2 bg-[#f8f8f8] text-[10px] font-bold uppercase tracking-widest text-[#e30613] border-b border-[#e4e2e1]">{cat.name}</div>
                      {cat.items.map((it, ii) => (
                        <div key={ii} className="px-3 py-2 border-b border-[#e4e2e1] last:border-0 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[12px] text-[#333333]">{it.label}</div>
                            {it.remarks && <div className="text-[11px] text-[#999999] italic mt-0.5">{it.remarks}</div>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {it.na ? <span className="text-[10px] font-bold text-[#666666]">N/A</span> : <>
                              <span className={`text-[10px] font-bold ${it.level1 ? "text-[#16a34a]" : "text-[#e4e2e1]"}`}>L1</span>
                              <span className={`text-[10px] font-bold ${it.level2 ? "text-[#0059a8]" : "text-[#e4e2e1]"}`}>L2</span>
                            </>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Result</label>
                <select value={editResult} onChange={e => setEditResult(e.target.value as Result)} className={inputCls + " bg-white"}>
                  {(["Pass", "Conditional", "Fail", "Draft"] as Result[]).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Observations / Remarks</label>
                <textarea value={editRemarks} onChange={e => setEditRemarks(e.target.value)} rows={3} placeholder="Inspection remarks…" className={inputCls + " resize-none font-[inherit]"} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center gap-3 shrink-0">
              <div className="flex gap-2">
                <button onClick={() => downloadInspection({ ...editing, remarks: editRemarks, result: editResult })}
                  className="px-4 py-2 border border-[#e4e2e1] rounded bg-white text-[#333333] font-bold text-[13px] flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{fontSize:"18px"}}>download</span>Download
                </button>
                <button onClick={() => resumeInspection(editing)}
                  className="px-4 py-2 border border-[#0059a8]/30 text-[#0059a8] rounded font-bold text-[13px] flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{fontSize:"18px"}}>edit</span>Edit Checklist
                </button>
                <button onClick={deleteInspection}
                  className="px-4 py-2 border border-[#ba1a1a]/30 text-[#ba1a1a] rounded font-bold text-[13px] flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{fontSize:"18px"}}>delete</span>Delete
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditing(null)} className="px-5 py-2 border border-[#e4e2e1] rounded bg-white text-[#333333] font-bold text-[13px]">Cancel</button>
                <button onClick={saveEdit} className="px-6 py-2 rounded text-white font-bold text-[13px]" style={{background:"#16a34a"}}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Template Editor */}
      {showEditor && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{background:"rgba(0,0,0,0.45)"}} onClick={() => { if (!saving) setShowEditor(false); }}>
          <div className="bg-white border border-[#e4e2e1] w-full max-w-[640px] max-h-[90vh] rounded-lg overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center shrink-0">
              <h3 className="text-[20px] font-bold text-[#333333]">{editTpl ? "Edit Checklist" : "Manage Checklists"}</h3>
              <button onClick={() => setShowEditor(false)} disabled={saving} className="text-[#666666] flex disabled:opacity-40 disabled:cursor-not-allowed"><span className="material-symbols-outlined">close</span></button>
            </div>

            {!editTpl ? (
              <>
                <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                  <div className="flex gap-1.5 flex-wrap">
                    {disciplines.map(d => (
                      <button key={d} type="button" onClick={() => setEdDisc(d)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${edDisc === d ? "bg-[#e30613] text-white border-[#e30613]" : "bg-white text-[#666666] border-[#e4e2e1] hover:border-[#e30613]/40"}`}>{d}</button>
                    ))}
                  </div>
                  <input value={edSearch} onChange={e => setEdSearch(e.target.value)} placeholder="Search checklists…" className={inputCls} />
                  <div className="border border-[#e4e2e1] rounded max-h-[340px] overflow-y-auto custom-scrollbar divide-y divide-[#e4e2e1]">
                    {editorList.map(t => (
                      <div key={t.id} onClick={() => setEditTpl(clone(t))} className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer hover:bg-[#f8f8f8] transition-all">
                        <div className="min-w-0">
                          <div className="text-[13px] text-[#333333] truncate">{t.name}</div>
                          <div className="text-[10px] text-[#999999]">{t.categories.reduce((n, c) => n + c.items.length, 0)} items · {t.categories.length} section(s)</div>
                        </div>
                        <span className="material-symbols-outlined text-[#999999]" style={{fontSize:"18px"}}>chevron_right</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-between shrink-0">
                  <button onClick={newTemplate} disabled={saving} className="px-5 py-2 rounded text-white font-bold text-[13px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" style={{background:"#e30613"}}>
                    <span className="material-symbols-outlined" style={{fontSize:"18px"}}>add</span>{saving ? "Creating…" : "New Checklist"}
                  </button>
                  <button onClick={() => setShowEditor(false)} disabled={saving} className="px-5 py-2 border border-[#e4e2e1] rounded bg-white text-[#333333] font-bold text-[13px] disabled:opacity-50 disabled:cursor-not-allowed">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                  <button onClick={() => setEditTpl(null)} disabled={saving} className="text-[12px] font-bold text-[#e30613] flex items-center gap-1 self-start disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined" style={{fontSize:"16px"}}>arrow_back</span>All checklists
                  </button>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <label className={labelCls}>Checklist Name</label>
                      <input value={editTpl.name} onChange={e => mutTpl(t => { t.name = e.target.value; })} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Discipline</label>
                      <select value={editTpl.discipline} onChange={e => mutTpl(t => { t.discipline = e.target.value; })} className={inputCls + " bg-white"}>
                        {["C&I", "MEP", "Structural"].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {editTpl.categories.map((cat, ci) => (
                    <div key={ci} className="border border-[#e4e2e1] rounded p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input value={cat.name} onChange={e => renameSection(ci, e.target.value)} placeholder="Section name"
                          className="flex-1 border border-[#e4e2e1] rounded px-2.5 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[#e30613] outline-none focus:border-[#e30613]" />
                        <button onClick={() => deleteSection(ci)} title="Delete section" className="text-[#666666] hover:text-[#ba1a1a] flex"><span className="material-symbols-outlined" style={{fontSize:"18px"}}>delete</span></button>
                      </div>
                      {cat.items.map((it, ii) => (
                        <div key={ii} className="flex items-center gap-2 pl-1">
                          <input value={it.label} onChange={e => editItem(ci, ii, e.target.value)} placeholder="Checklist item…"
                            className="flex-1 border border-[#e4e2e1] rounded px-2.5 py-1.5 text-[12px] outline-none focus:border-[#e30613]" />
                          <button onClick={() => toggleItemLinked(ci, ii)} title="Toggle SNAG link"
                            className={`px-2 py-1 rounded text-[10px] font-bold border shrink-0 ${it.linked ? "bg-[#e30613] text-white border-[#e30613]" : "bg-white text-[#999999] border-[#e4e2e1]"}`}>SNAG</button>
                          <button onClick={() => deleteItem(ci, ii)} title="Delete item" className="text-[#666666] hover:text-[#ba1a1a] flex shrink-0"><span className="material-symbols-outlined" style={{fontSize:"18px"}}>close</span></button>
                        </div>
                      ))}
                      <button onClick={() => addItem(ci)} className="text-[12px] font-bold text-[#e30613] flex items-center gap-1 self-start mt-1">
                        <span className="material-symbols-outlined" style={{fontSize:"16px"}}>add</span>Add item
                      </button>
                    </div>
                  ))}
                  <button onClick={addSection} className="border border-dashed border-[#e4e2e1] rounded py-2.5 text-[13px] font-bold text-[#666666] hover:border-[#e30613] hover:text-[#e30613] transition-all flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined" style={{fontSize:"18px"}}>add</span>Add Section
                  </button>
                </div>
                <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center gap-3 shrink-0">
                  <button onClick={removeTemplate} disabled={saving} className="px-4 py-2 border border-[#ba1a1a]/30 text-[#ba1a1a] rounded font-bold text-[13px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined" style={{fontSize:"18px"}}>delete</span>Delete
                  </button>
                  <div className="flex gap-3">
                    <button onClick={() => setEditTpl(null)} disabled={saving} className="px-5 py-2 border border-[#e4e2e1] rounded bg-white text-[#333333] font-bold text-[13px] disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                    <button onClick={saveTemplate} disabled={saving} className="px-6 py-2 rounded text-white font-bold text-[13px] disabled:opacity-50" style={{background:"#16a34a"}}>{saving ? "Saving…" : "Save Checklist"}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
