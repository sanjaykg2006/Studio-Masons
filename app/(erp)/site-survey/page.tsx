"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type SurveyStatus = "Completed" | "In Review" | "Pending";

interface Survey {
  id: string;
  project: string;
  date: string;
  conductor: string;
  status: SurveyStatus;
  photos: number;
  type: string;
  notes: string;
  checkedItems: string[];
}

const STATUS_INLINE: Record<SurveyStatus, React.CSSProperties> = {
  "Completed": { background: "rgba(34,197,94,0.1)",  color: "#16a34a", borderColor: "rgba(34,197,94,0.2)" },
  "In Review": { background: "rgba(227,6,19,0.1)",   color: "#e30613", borderColor: "rgba(227,6,19,0.2)" },
  "Pending":   { background: "rgba(202,138,4,0.1)",  color: "#a16207", borderColor: "rgba(202,138,4,0.2)" },
};

const STATUSES: SurveyStatus[] = ["Completed", "In Review", "Pending"];

type ChecklistCategory = { category: string; items: string[] };

const initialChecklist: ChecklistCategory[] = [
  { category: "Physical Measurements", items: ["Floor dimensions verified", "Ceiling height measured", "Door/window openings noted", "Structural beam locations marked"] },
  { category: "Site Conditions",        items: ["Existing plumbing mapped", "Electrical panel location", "Natural light assessment", "Ventilation points identified"] },
  { category: "Media Documentation",   items: ["360° photos captured", "Video walkthrough recorded", "Defect close-ups documented", "Site access points photographed"] },
];

const ALL_ITEMS = initialChecklist.flatMap(c => c.items);

const initialSurveys: Survey[] = [
  { id: "SS-001", project: "Indiranagar Residence", date: "Nov 12, 2024", conductor: "Vikram R.", status: "Completed", photos: 18, type: "Initial Recce",  notes: "Site access confirmed. All measurements captured. No major structural concerns.", checkedItems: ALL_ITEMS },
  { id: "SS-002", project: "Whitefield Office",     date: "Nov 10, 2024", conductor: "Sneha P.",  status: "In Review", photos: 22, type: "Progress Check", notes: "Awaiting sign-off from client. MEP routing flagged for review.",                  checkedItems: ALL_ITEMS.slice(0, 8) },
  { id: "SS-003", project: "Koramangala Villa",     date: "Nov 08, 2024", conductor: "Amit S.",   status: "Completed", photos: 14, type: "Pre-Handover",   notes: "Final walkthrough completed. Snag list shared with client.",                      checkedItems: ALL_ITEMS },
  { id: "SS-004", project: "HSR Layout G+3",        date: "Nov 05, 2024", conductor: "Rahul K.",  status: "Pending",   photos: 0,  type: "Initial Recce",  notes: "",                                                                                checkedItems: [] },
];

const ENGINEERS = ["Vikram R.", "Sneha P.", "Amit S.", "Rahul K.", "Priya M."];
const PROJECTS  = ["Indiranagar Residence", "Whitefield Office", "Koramangala Villa", "HSR Layout G+3", "Jayanagar Apartment"];
const TYPES     = ["Initial Recce", "Progress Check", "Pre-Handover", "Client Walkthrough"];

function nextId(surveys: Survey[]) {
  const nums = surveys.map(s => parseInt(s.id.replace("SS-", ""), 10));
  return `SS-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

export default function SiteSurveyPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>(initialSurveys);

  // View modal — store ID; derive live survey so checklist updates reflect immediately
  const [viewSurveyId, setViewSurveyId] = useState<string | null>(null);
  const activeSurvey = viewSurveyId ? (surveys.find(s => s.id === viewSurveyId) ?? null) : null;

  // New survey modal
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState({ project: PROJECTS[0], date: "", conductor: ENGINEERS[0], type: TYPES[0], notes: "" });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [showFilter, setShowFilter]     = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // More-vert menus
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Standard Checklist Template
  const [checklist, setChecklist]         = useState<ChecklistCategory[]>(initialChecklist);
  const [editChecklist, setEditChecklist] = useState(false);
  const [templateChecks, setTemplateChecks] = useState<string[]>([]);
  const [newItemText, setNewItemText]     = useState<Record<string, string>>({});
  const [newCategoryText, setNewCategoryText] = useState("");

  // Portal guard
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function onMouseDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Dynamic stats
  const total          = surveys.length;
  const completedCount = surveys.filter(s => s.status === "Completed").length;
  const inReviewCount  = surveys.filter(s => s.status === "In Review").length;
  const pendingCount   = surveys.filter(s => s.status === "Pending").length;

  const filtered = filterStatus === "All" ? surveys : surveys.filter(s => s.status === filterStatus);

  // ── Survey actions ──────────────────────────────────────────
  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = "";
    }
  }

  function handleCreateSurvey() {
    if (!form.date) return;
    const dateObj = new Date(form.date + "T00:00:00");
    const newSurvey: Survey = {
      id: nextId(surveys),
      project: form.project,
      date: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      conductor: form.conductor,
      status: "In Review",
      photos: uploadedFiles.length,
      type: form.type,
      notes: form.notes,
      checkedItems: [],
    };
    setSurveys(prev => [newSurvey, ...prev]);
    setFormSubmitted(true);
    setTimeout(() => {
      setShowModal(false);
      setFormSubmitted(false);
      setForm({ project: PROJECTS[0], date: "", conductor: ENGINEERS[0], type: TYPES[0], notes: "" });
      setUploadedFiles([]);
    }, 1500);
  }

  function handleDeleteSurvey(id: string) {
    setSurveys(prev => prev.filter(s => s.id !== id));
    setOpenMenu(null);
  }

  function handleCycleStatus(id: string) {
    setSurveys(prev => prev.map(s => {
      if (s.id !== id) return s;
      return { ...s, status: STATUSES[(STATUSES.indexOf(s.status) + 1) % STATUSES.length] };
    }));
    setOpenMenu(null);
  }

  // Toggle a checklist item for a specific survey
  function toggleSurveyItem(surveyId: string, item: string) {
    setSurveys(prev => prev.map(s => {
      if (s.id !== surveyId) return s;
      const already = s.checkedItems.includes(item);
      return { ...s, checkedItems: already ? s.checkedItems.filter(i => i !== item) : [...s.checkedItems, item] };
    }));
  }

  // ── Template editing helpers ─────────────────────────────────
  function toggleTemplateCheck(item: string) {
    setTemplateChecks(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  }

  function addItem(catIdx: number) {
    const key  = checklist[catIdx].category;
    const text = (newItemText[key] ?? "").trim();
    if (!text) return;
    setChecklist(prev => prev.map((c, i) => i === catIdx ? { ...c, items: [...c.items, text] } : c));
    setNewItemText(prev => ({ ...prev, [key]: "" }));
  }

  function removeItem(catIdx: number, itemIdx: number) {
    setChecklist(prev => prev.map((c, i) => i === catIdx ? { ...c, items: c.items.filter((_, j) => j !== itemIdx) } : c));
  }

  function addCategory() {
    const text = newCategoryText.trim();
    if (!text) return;
    setChecklist(prev => [...prev, { category: text, items: [] }]);
    setNewCategoryText("");
  }

  function removeCategory(catIdx: number) {
    setChecklist(prev => prev.filter((_, i) => i !== catIdx));
  }

  // ── All template items flat list (for view modal) ────────────
  const allChecklistItems = checklist.flatMap(c => c.items);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <button onClick={() => router.push("/dashboard")} className="hover:text-[#e30613] transition-colors">Dashboard</button>
        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
        <span className="text-[#e30613]">Site Survey</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Site Survey / Recce</h2>
          <p className="text-[#666666]">Capture site information including physical measurements, videos, and site conditions.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-[#e30613] text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>add_circle</span>
          NEW SURVEY
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[
          { label: "Total Surveys", value: total,          icon: "assignment",      color: "#e30613" },
          { label: "Completed",     value: completedCount, icon: "task_alt",        color: "#16a34a" },
          { label: "In Review",     value: inReviewCount,  icon: "pending_actions", color: "#e30613" },
          { label: "Pending",       value: pendingCount,   icon: "schedule",        color: "#ca8a04" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666" }}>{s.label}</span>
              <span className="material-symbols-outlined" style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: "40px", fontWeight: "bold", color: "#333333" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Survey Table */}
      <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm mb-10">
        <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-[#e30613]" />
            <h3 className="text-[20px] font-medium text-[#333333]">Recent Surveys</h3>
            {filterStatus !== "All" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e30613]/10 text-[#e30613] border border-[#e30613]/20">{filterStatus}</span>
            )}
          </div>
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-[12px] font-bold transition-colors ${showFilter ? "border-[#e30613] text-[#e30613] bg-[#e30613]/5" : "border-[#e4e2e1] text-[#666666] hover:bg-[#f0eded]"}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>filter_list</span>
              Filter
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#e4e2e1] rounded-lg shadow-xl z-[60] w-40 overflow-hidden">
                {["All", ...STATUSES].map(opt => (
                  <button key={opt} onClick={() => { setFilterStatus(opt); setShowFilter(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center justify-between ${filterStatus === opt ? "bg-[#e30613]/5 text-[#e30613] font-bold" : "text-[#333333] hover:bg-[#f8f8f8]"}`}>
                    {opt}
                    {filterStatus === opt && <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#999999]">
            <span className="material-symbols-outlined" style={{ fontSize: "40px" }}>search_off</span>
            <p className="text-[14px]">No surveys with status &ldquo;{filterStatus}&rdquo;</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
                {["Survey ID", "Project", "Date", "Conducted By", "Type", "Checklist", "Photos", "Status", "Actions"].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e2e1]">
              {filtered.map((s, i) => (
                <tr key={s.id} className="hover:bg-[#f8f8f8] transition-colors">
                  <td className="px-6 py-4 font-bold text-[#e30613] text-[14px]">{s.id}</td>
                  <td className="px-6 py-4 font-medium text-[#333333]">{s.project}</td>
                  <td className="px-6 py-4 text-[#666666] text-[14px]">{s.date}</td>
                  <td className="px-6 py-4 text-[#333333]">{s.conductor}</td>
                  <td className="px-6 py-4 text-[#666666] text-[14px]">{s.type}</td>
                  <td className="px-6 py-4 text-[#333333] text-[14px]">
                    {s.checkedItems.length > 0
                      ? <span className="text-green-600 font-medium">{s.checkedItems.length}/{allChecklistItems.length}</span>
                      : <span className="text-[#999999]">—</span>}
                  </td>
                  <td className="px-6 py-4 text-[#333333]">{s.photos > 0 ? `${s.photos} files` : "—"}</td>
                  <td className="px-6 py-4">
                    <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", border: "1px solid", whiteSpace: "nowrap", ...STATUS_INLINE[s.status] }}>{s.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 items-center">
                      <button onClick={() => setViewSurveyId(s.id)}
                        className="px-3 py-1.5 border border-[#e4e2e1] rounded text-[10px] font-bold text-[#333333] hover:bg-[#e30613]/5 hover:border-[#e30613] hover:text-[#e30613] transition-colors">
                        View
                      </button>
                      <div ref={openMenu === i ? menuRef : undefined} className="relative">
                        <button onClick={() => setOpenMenu(openMenu === i ? null : i)}
                          className="p-1.5 border border-[#e4e2e1] rounded text-[#666666] hover:bg-[#f0eded] transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>more_vert</span>
                        </button>
                        {openMenu === i && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-[#e4e2e1] rounded-lg shadow-xl z-[70] w-44 overflow-hidden">
                            <button onClick={() => handleCycleStatus(s.id)}
                              className="w-full text-left px-4 py-2.5 text-[13px] text-[#333333] hover:bg-[#f8f8f8] flex items-center gap-2 transition-colors">
                              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#e30613" }}>sync</span>
                              Cycle Status
                            </button>
                            <button onClick={() => handleDeleteSurvey(s.id)}
                              className="w-full text-left px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Standard Checklist Template */}
      <div className="border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#e30613]" />
              <h3 className="text-[20px] font-medium text-[#333333]">Standard Checklist Template</h3>
            </div>
            <p className="text-[#666666] text-[14px] mt-1 ml-3">Captured on site during every survey — click items to mark them</p>
          </div>
          <div className="flex items-center gap-3">
            {templateChecks.length > 0 && (
              <button onClick={() => setTemplateChecks([])} className="text-[12px] text-[#999999] hover:text-[#e30613] transition-colors">
                Clear ({templateChecks.length})
              </button>
            )}
            <button
              onClick={() => setEditChecklist(v => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded border text-[12px] font-bold transition-all ${editChecklist ? "bg-[#e30613] text-white border-[#e30613]" : "border-[#e4e2e1] text-[#666666] hover:border-[#e30613] hover:text-[#e30613]"}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{editChecklist ? "done" : "edit"}</span>
              {editChecklist ? "Done Editing" : "Edit Template"}
            </button>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {checklist.map((section, catIdx) => (
            <div key={catIdx}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[12px] font-bold uppercase tracking-widest text-[#e30613]">{section.category}</h4>
                {editChecklist && (
                  <button onClick={() => removeCategory(catIdx)} className="text-red-400 hover:text-red-600 transition-colors" title="Remove category">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {section.items.map((item, itemIdx) => {
                  const checked = templateChecks.includes(item);
                  return (
                    <div key={itemIdx}
                      onClick={() => !editChecklist && toggleTemplateCheck(item)}
                      className={`flex items-center gap-2 p-2.5 border rounded transition-all group ${editChecklist ? "cursor-default border-[#e4e2e1]" : "cursor-pointer hover:border-[#e30613]/40 hover:bg-[#f8f8f8]"} ${checked ? "border-[#e30613]/30 bg-[#e30613]/5" : "border-[#e4e2e1]"}`}
                    >
                      <div style={{ width: "16px", height: "16px", borderRadius: "3px", border: `2px solid ${checked ? "#e30613" : "#e4e2e1"}`, background: checked ? "#e30613" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                        {checked && <span className="material-symbols-outlined" style={{ fontSize: "11px", color: "white" }}>check</span>}
                      </div>
                      <span className={`text-[13px] flex-1 ${checked ? "text-[#333333] line-through opacity-60" : "text-[#333333]"}`}>{item}</span>
                      {editChecklist && (
                        <button onClick={e => { e.stopPropagation(); removeItem(catIdx, itemIdx); }}
                          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                        </button>
                      )}
                    </div>
                  );
                })}
                {editChecklist && (
                  <div className="flex gap-2 mt-2">
                    <input type="text" placeholder="Add item..."
                      value={newItemText[section.category] ?? ""}
                      onChange={e => setNewItemText(prev => ({ ...prev, [section.category]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") addItem(catIdx); }}
                      className="flex-1 px-3 py-1.5 border border-dashed border-[#e4e2e1] rounded text-[12px] focus:outline-none focus:border-[#e30613] placeholder:text-[#cccccc]"
                    />
                    <button onClick={() => addItem(catIdx)}
                      className="px-2 py-1.5 bg-[#e30613]/10 text-[#e30613] rounded border border-[#e30613]/20 hover:bg-[#e30613] hover:text-white transition-all">
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {editChecklist && (
            <div>
              <h4 className="text-[12px] font-bold uppercase tracking-widest text-[#999999] mb-4">New Category</h4>
              <div className="flex gap-2">
                <input type="text" placeholder="Category name..."
                  value={newCategoryText}
                  onChange={e => setNewCategoryText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addCategory(); }}
                  className="flex-1 px-3 py-2 border border-dashed border-[#e4e2e1] rounded text-[13px] focus:outline-none focus:border-[#e30613] placeholder:text-[#cccccc]"
                />
                <button onClick={addCategory} className="px-3 py-2 bg-[#e30613] text-white rounded hover:opacity-90 transition-all">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── View Survey Modal ─────────────────────────────────────── */}
      {mounted && activeSurvey && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setViewSurveyId(null)}>
          <div style={{ background: "white", border: "1px solid #e4e2e1", width: "100%", maxWidth: "680px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999999", marginBottom: "2px" }}>Survey Detail</p>
                <h3 style={{ fontSize: "22px", fontWeight: "bold", color: "#333333" }}>{activeSurvey.id} — {activeSurvey.project}</h3>
              </div>
              <button onClick={() => setViewSurveyId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body — scrollable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Survey info grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                {[
                  { label: "Date",           value: activeSurvey.date },
                  { label: "Conducted By",   value: activeSurvey.conductor },
                  { label: "Survey Type",    value: activeSurvey.type },
                  { label: "Photos",         value: activeSurvey.photos > 0 ? `${activeSurvey.photos} files` : "None" },
                  { label: "Checklist",      value: `${activeSurvey.checkedItems.length} / ${allChecklistItems.length} items` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999999", marginBottom: "4px" }}>{label}</p>
                    <p style={{ fontSize: "14px", fontWeight: "500", color: "#333333" }}>{value}</p>
                  </div>
                ))}
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999999", marginBottom: "6px" }}>Status</p>
                  <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", border: "1px solid", whiteSpace: "nowrap", ...STATUS_INLINE[activeSurvey.status] }}>{activeSurvey.status}</span>
                </div>
              </div>

              {activeSurvey.notes && (
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999999", marginBottom: "6px" }}>Notes</p>
                  <p style={{ fontSize: "14px", color: "#555555", lineHeight: 1.6 }}>{activeSurvey.notes}</p>
                </div>
              )}

              {/* Checklist */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <p style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#333333" }}>Checklist</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ height: "4px", width: "120px", background: "#e4e2e1", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "#e30613", width: `${allChecklistItems.length ? (activeSurvey.checkedItems.length / allChecklistItems.length) * 100 : 0}%`, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: "12px", color: "#666666" }}>{activeSurvey.checkedItems.length}/{allChecklistItems.length}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {checklist.map((section) => (
                    <div key={section.category}>
                      <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#e30613", marginBottom: "8px" }}>{section.category}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {section.items.map((item) => {
                          const checked = activeSurvey.checkedItems.includes(item);
                          return (
                            <div key={item} onClick={() => toggleSurveyItem(activeSurvey.id, item)}
                              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", border: `1px solid ${checked ? "rgba(34,197,94,0.3)" : "#e4e2e1"}`, borderRadius: "6px", cursor: "pointer", background: checked ? "rgba(34,197,94,0.05)" : "white", transition: "all 0.15s" }}>
                              <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: `2px solid ${checked ? "#16a34a" : "#d0d0d0"}`, background: checked ? "#16a34a" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                                {checked && <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "white" }}>check</span>}
                              </div>
                              <span style={{ fontSize: "13px", color: checked ? "#16a34a" : "#333333", flex: 1, textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.7 : 1 }}>{item}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
              <button onClick={() => setViewSurveyId(null)} style={{ padding: "8px 24px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── New Survey Modal ──────────────────────────────────────── */}
      {mounted && showModal && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "white", border: "1px solid #e4e2e1", width: "100%", maxWidth: "680px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e4e2e1", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f8f8", flexShrink: 0 }}>
              <h3 style={{ fontSize: "24px", fontWeight: "bold", color: "#333333" }}>New Site Survey</h3>
              <button onClick={() => { setShowModal(false); setFormSubmitted(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formSubmitted ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "64px 24px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ color: "#16a34a", fontSize: "32px" }}>check_circle</span>
                </div>
                <p style={{ fontSize: "20px", fontWeight: "bold", color: "#333333" }}>Survey Created</p>
                <p style={{ fontSize: "14px", color: "#666666" }}>Added to the survey list as &ldquo;In Review&rdquo;</p>
              </div>
            ) : (
              <>
                <div style={{ padding: "32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px", flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "bold", color: "#e30613", textTransform: "uppercase", letterSpacing: "0.05em" }}>Project</label>
                      <select value={form.project} onChange={e => setField("project", e.target.value)} style={{ background: "white", border: "1px solid #e4e2e1", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", color: "#333333", outline: "none" }}>
                        {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "bold", color: "#e30613", textTransform: "uppercase", letterSpacing: "0.05em" }}>Survey Date *</label>
                      <input type="date" value={form.date} onChange={e => setField("date", e.target.value)} style={{ background: "white", border: "1px solid #e4e2e1", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", color: "#333333", outline: "none" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "bold", color: "#e30613", textTransform: "uppercase", letterSpacing: "0.05em" }}>Conducted By</label>
                      <select value={form.conductor} onChange={e => setField("conductor", e.target.value)} style={{ background: "white", border: "1px solid #e4e2e1", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", color: "#333333", outline: "none" }}>
                        {ENGINEERS.map(eng => <option key={eng} value={eng}>{eng}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "bold", color: "#e30613", textTransform: "uppercase", letterSpacing: "0.05em" }}>Survey Type</label>
                      <select value={form.type} onChange={e => setField("type", e.target.value)} style={{ background: "white", border: "1px solid #e4e2e1", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", color: "#333333", outline: "none" }}>
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold", color: "#e30613", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setField("notes", e.target.value)} rows={3} placeholder="Site observations, access notes, special conditions..." style={{ background: "white", border: "1px solid #e4e2e1", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", color: "#333333", outline: "none", resize: "none", fontFamily: "inherit" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold", color: "#e30613", textTransform: "uppercase", letterSpacing: "0.05em" }}>Upload Site Media</label>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf" onChange={handleFileChange} style={{ display: "none" }} />
                    <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed #e4e2e1", borderRadius: "8px", padding: "32px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", cursor: "pointer", background: "#f8f8f8" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#999999" }}>cloud_upload</span>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontSize: "14px", fontWeight: "bold", color: "#333333" }}>Click to select files</p>
                        <p style={{ fontSize: "11px", color: "#999999", marginTop: "4px" }}>Photos, Videos, PDFs (Max 50 MB each)</p>
                      </div>
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f8f8f8", border: "1px solid #e4e2e1", borderRadius: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#e30613", flexShrink: 0 }}>
                                {file.type.startsWith("video") ? "videocam" : file.type === "application/pdf" ? "picture_as_pdf" : "image"}
                              </span>
                              <span style={{ fontSize: "13px", color: "#333333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                              <span style={{ fontSize: "12px", color: "#999999", flexShrink: 0 }}>({(file.size / 1024).toFixed(0)} KB)</span>
                            </div>
                            <button onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "#999999", display: "flex", flexShrink: 0, marginLeft: "8px" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "12px", flexShrink: 0 }}>
                  <button onClick={() => setShowModal(false)} style={{ padding: "8px 24px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>Cancel</button>
                  <button onClick={handleCreateSurvey} disabled={!form.date} style={{ padding: "8px 32px", border: "none", borderRadius: "6px", background: form.date ? "#e30613" : "#e4e2e1", color: form.date ? "white" : "#999999", fontWeight: "bold", cursor: form.date ? "pointer" : "not-allowed", fontSize: "14px" }}>
                    Create Survey
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
