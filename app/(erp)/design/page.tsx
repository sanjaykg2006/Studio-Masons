"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useProject } from "../../../contexts/ProjectContext";

type FileStatus = "Pending Review" | "Approved" | "Changes Needed";

interface DesignFile {
  id: string;
  icon: string;
  name: string;
  meta: string;
  by: string;
  date: string;
  status: FileStatus;
  feedback?: string;
  fileObj?: File;   // populated for user-uploaded files; null for demo entries
}

const STATUS_INLINE: Record<FileStatus, React.CSSProperties> = {
  "Pending Review":  { background: "rgba(227,6,19,0.08)",  color: "#e30613", borderColor: "rgba(227,6,19,0.2)" },
  "Approved":        { background: "rgba(34,197,94,0.08)", color: "#16a34a", borderColor: "rgba(34,197,94,0.2)" },
  "Changes Needed":  { background: "rgba(186,26,26,0.08)", color: "#ba1a1a", borderColor: "rgba(186,26,26,0.2)" },
};

const initialFiles: DesignFile[] = [
  { id: "f1", icon: "architecture",  name: "Master_Plan_V3.pdf",            meta: "Architectural Set • 24.5 MB",   by: "Marcus Sterling",  date: "Oct 24, 2023", status: "Pending Review",  feedback: "" },
  { id: "f2", icon: "texture",       name: "Material_Specs_Final.rvt",       meta: "Revit Model • 142.1 MB",       by: "Elena Rossi",      date: "Oct 22, 2023", status: "Approved" },
  { id: "f3", icon: "imagesmode",    name: "Kitchen_Lighting_Mockups.zip",   meta: "Asset Bundle • 89.4 MB",       by: "Marcus Sterling",  date: "Oct 20, 2023", status: "Changes Needed",  feedback: "Lighting temperature does not match spec. Please revise warm-white fixtures on island and peninsula. Reference colour chip #WW3200K." },
  { id: "f4", icon: "description",   name: "Structural_Analysis_B.pdf",      meta: "Engineering Report • 5.1 MB",  by: "Dr. Sarah Laine",  date: "Oct 19, 2023", status: "Approved" },
  { id: "f5", icon: "crop_landscape",name: "Elevation_South_V2.dwg",         meta: "CAD Drawing • 8.7 MB",         by: "Elena Rossi",      date: "Oct 17, 2023", status: "Pending Review",  feedback: "" },
  { id: "f6", icon: "bolt",          name: "Electrical_Layout_Floor1.pdf",   meta: "Engineering Drawing • 3.2 MB", by: "Dr. Sarah Laine",  date: "Oct 15, 2023", status: "Approved" },
  { id: "f7", icon: "air",           name: "HVAC_Schematic_R1.pdf",          meta: "MEP Drawing • 6.9 MB",         by: "Marcus Sterling",  date: "Oct 13, 2023", status: "Changes Needed",  feedback: "Duct routing conflicts with beam on Grid Line C. Coordinate with structural engineer before resubmission." },
  { id: "f8", icon: "map",           name: "Site_Plan_Final.pdf",            meta: "Site Layout • 12.3 MB",        by: "Elena Rossi",      date: "Oct 11, 2023", status: "Approved" },
];

const PAGE_SIZE = 4;

// ── Review panel (status picker + feedback + save) ───────────────
function ReviewPanel({ status, feedback, dirty, onStatusChange, onFeedbackChange, onSave }: {
  status: FileStatus;
  feedback: string;
  dirty: boolean;
  onStatusChange: (s: FileStatus) => void;
  onFeedbackChange: (fb: string) => void;
  onSave: () => void;
}) {
  const pills: { value: FileStatus; label: string; color: string; bg: string; border: string }[] = [
    { value: "Approved",       label: "Approve",          color: "#16a34a", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.3)" },
    { value: "Pending Review", label: "Pending Review",   color: "#e30613", bg: "rgba(227,6,19,0.08)",   border: "rgba(227,6,19,0.3)" },
    { value: "Changes Needed", label: "Request Changes",  color: "#ba1a1a", bg: "rgba(186,26,26,0.08)",  border: "rgba(186,26,26,0.3)" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999999" }}>Set Review Status</p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {pills.map(p => (
          <button key={p.value} onClick={() => onStatusChange(p.value)}
            style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", border: `1px solid ${status === p.value ? p.border : "#e4e2e1"}`, background: status === p.value ? p.bg : "white", color: status === p.value ? p.color : "#666666", transition: "all 0.15s" }}>
            {status === p.value && <span style={{ marginRight: "4px" }}>✓</span>}{p.label}
          </button>
        ))}
      </div>
      {status === "Changes Needed" && (
        <textarea
          value={feedback}
          onChange={e => onFeedbackChange(e.target.value)}
          rows={3}
          placeholder="Describe the changes required…"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "13px", color: "#333333", resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          onFocus={e => { e.target.style.borderColor = "#e30613"; }}
          onBlur={e => { e.target.style.borderColor = "#e4e2e1"; }}
        />
      )}
      {dirty && (
        <button onClick={onSave}
          style={{ alignSelf: "flex-start", padding: "8px 20px", border: "none", borderRadius: "6px", background: "#e30613", color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
          Save Review
        </button>
      )}
    </div>
  );
}

export default function DesignPage() {
  const { selectedProject } = useProject();

  const [files, setFiles]           = useState<DesignFile[]>(initialFiles);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [showFilter, setShowFilter] = useState(false);
  const [viewMode, setViewMode]     = useState<"table" | "grid">("table");
  const [page, setPage]             = useState(0);

  // Modals
  const [uploadOpen, setUploadOpen]         = useState(false);
  const [viewFile, setViewFile]             = useState<DesignFile | null>(null);
  const [feedbackFile, setFeedbackFile]     = useState<DesignFile | null>(null);
  const [uploadedFiles, setUploadedFiles]   = useState<File[]>([]);
  const [dragActive, setDragActive]         = useState(false);
  const [mounted, setMounted]               = useState(false);
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null);

  // Inline review editing inside View modal
  const [reviewStatus,   setReviewStatus]   = useState<FileStatus>("Pending Review");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewDirty,    setReviewDirty]    = useState(false);

  // More-vert menu in table rows
  const [openRowMenu, setOpenRowMenu]       = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  const filterRef   = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create / revoke blob URL whenever the view modal opens or closes
  useEffect(() => {
    if (viewFile?.fileObj) {
      const url = URL.createObjectURL(viewFile.fileObj);
      setPreviewUrl(url);
      return () => { URL.revokeObjectURL(url); setPreviewUrl(null); };
    }
    setPreviewUrl(null);
  }, [viewFile]);

  // Seed review state whenever a file is opened for viewing
  useEffect(() => {
    if (viewFile) {
      setReviewStatus(viewFile.status);
      setReviewFeedback(viewFile.feedback ?? "");
      setReviewDirty(false);
    }
  }, [viewFile]);

  useEffect(() => {
    setMounted(true);
    function onMouseDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setOpenRowMenu(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Filtered + paginated
  const filtered = filterStatus === "All" ? files : files.filter(f => f.status === filterStatus);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageFiles  = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Reset to page 0 when filter changes
  function applyFilter(s: string) {
    setFilterStatus(s);
    setPage(0);
    setShowFilter(false);
  }

  function approveFile(id: string) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "Approved", feedback: "" } : f));
  }

  function deleteFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
    setOpenRowMenu(null);
  }

  function saveReview() {
    if (!viewFile) return;
    setFiles(prev => prev.map(f =>
      f.id === viewFile.id ? { ...f, status: reviewStatus, feedback: reviewFeedback } : f
    ));
    // Keep the modal open but reflect the saved state
    setViewFile(prev => prev ? { ...prev, status: reviewStatus, feedback: reviewFeedback } : prev);
    setReviewDirty(false);
  }

  function handleFileInput(newFiles: FileList | null) {
    if (!newFiles) return;
    setUploadedFiles(prev => [...prev, ...Array.from(newFiles)]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    handleFileInput(e.dataTransfer.files);
  }

  function submitUpload() {
    if (!uploadedFiles.length) return;
    uploadedFiles.forEach((uf, idx) => {
      const ext = uf.name.split(".").pop()?.toUpperCase() ?? "FILE";
      setFiles(prev => [{
        id: `new_${Date.now()}_${idx}`,
        icon: ext === "PDF" ? "description" : ext === "RVT" ? "texture" : uf.type.startsWith("image/") ? "imagesmode" : "architecture",
        name: uf.name,
        meta: `${ext} • ${(uf.size / (1024 * 1024)).toFixed(1)} MB`,
        by: "You",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "Pending Review",
        feedback: "",
        fileObj: uf,
      }, ...prev]);
    });
    setUploadedFiles([]);
    setUploadOpen(false);
  }

  // Stats
  const approvedCount  = files.filter(f => f.status === "Approved").length;
  const pendingCount   = files.filter(f => f.status === "Pending Review").length;
  const changesCount   = files.filter(f => f.status === "Changes Needed").length;

  // ── No project selected ──────────────────────────────────────
  if (!selectedProject) {
    return (
      <div>
        <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-wider">
          <span>Dashboard</span>
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
          <span className="text-[#e30613]">Design Management</span>
        </nav>
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">Design Management</h2>
        <p style={{ fontSize: "16px", color: "#666666", marginBottom: "40px" }}>
          Review, approve, and organise architectural blueprints and material specs.
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "96px 24px", textAlign: "center" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#f8f8f8", border: "1px solid #e4e2e1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "#e4e2e1" }}>folder_open</span>
          </div>
          <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "#333333", marginBottom: "8px" }}>No Project Selected</h3>
          <p style={{ fontSize: "16px", color: "#666666", maxWidth: "420px", lineHeight: 1.6 }}>
            Use the <span style={{ fontWeight: "bold", color: "#e30613" }}>Project Selector</span> in the top bar to choose a project and view its design files.
          </p>
        </div>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-wider">
        <span>Dashboard</span>
        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
        <span className="text-[#e30613]">Design Management</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333]">Design Management</h2>
          <p style={{ fontSize: "16px", color: "#666666", marginTop: "4px" }}>
            Design files for <strong style={{ color: "#333333" }}>{selectedProject.name}</strong>
            <span style={{ color: "#e4e2e1", margin: "0 8px" }}>•</span>
            <span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#e30613" }}>{selectedProject.status}</span>
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="bg-[#e30613] text-white px-6 py-3 rounded-lg text-[14px] font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>upload</span>
          Upload New Design
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#e4e2e1] flex justify-between items-center bg-[#f8f8f8]">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-[#e30613]" />
            <h3 className="text-[20px] font-medium text-[#333333]">Recent Designs</h3>
            {filterStatus !== "All" && (
              <span style={{ fontSize: "10px", fontWeight: "bold", padding: "2px 8px", borderRadius: "999px", background: "rgba(227,6,19,0.08)", color: "#e30613", border: "1px solid rgba(227,6,19,0.2)" }}>
                {filterStatus}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {/* Filter dropdown */}
            <div ref={filterRef} className="relative">
              <button
                onClick={() => setShowFilter(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-[12px] font-bold transition-colors ${showFilter ? "border-[#e30613] text-[#e30613] bg-[#e30613]/5" : "border-[#e4e2e1] text-[#666666] hover:bg-[#f0eded]"}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>filter_list</span>
                Filter
              </button>
              {showFilter && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#e4e2e1] rounded-lg shadow-xl z-[60] w-44 overflow-hidden">
                  {["All", "Approved", "Pending Review", "Changes Needed"].map(opt => (
                    <button key={opt} onClick={() => applyFilter(opt)}
                      className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center justify-between ${filterStatus === opt ? "bg-[#e30613]/5 text-[#e30613] font-bold" : "text-[#333333] hover:bg-[#f8f8f8]"}`}>
                      <span style={{ whiteSpace: "nowrap" }}>{opt}</span>
                      {filterStatus === opt && <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* View mode toggle */}
            <button
              onClick={() => setViewMode(v => v === "table" ? "grid" : "table")}
              className={`p-2 border rounded transition-colors ${viewMode === "grid" ? "border-[#e30613] text-[#e30613] bg-[#e30613]/5" : "border-[#e4e2e1] text-[#666666] hover:bg-[#f0eded]"}`}
              title={viewMode === "table" ? "Switch to grid view" : "Switch to table view"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{viewMode === "table" ? "grid_view" : "table_rows"}</span>
            </button>
          </div>
        </div>

        {/* Empty state */}
        {pageFiles.length === 0 && (
          <div className="py-16 flex flex-col items-center gap-3 text-[#999999]">
            <span className="material-symbols-outlined" style={{ fontSize: "40px" }}>search_off</span>
            <p style={{ fontSize: "14px" }}>No files with status &ldquo;{filterStatus}&rdquo;</p>
          </div>
        )}

        {/* Table view */}
        {viewMode === "table" && pageFiles.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
                {["File Name", "Uploaded By", "Date", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "16px 24px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666", textAlign: h === "Actions" ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e2e1]">
              {pageFiles.map((f, rowIdx) => (
                <tr key={f.id} className="hover:bg-[#f8f8f8] transition-colors">
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", background: "#f0eded", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ color: "#e30613" }}>{f.icon}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: "14px", color: "#333333", fontWeight: "500" }}>{f.name}</p>
                        <p style={{ fontSize: "10px", color: "#666666" }}>{f.meta}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: "14px", color: "#333333" }}>{f.by}</td>
                  <td style={{ padding: "16px 24px", fontSize: "14px", color: "#666666" }}>{f.date}</td>
                  <td style={{ padding: "16px 24px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", border: "1px solid", whiteSpace: "nowrap", ...STATUS_INLINE[f.status] }}>{f.status}</span>
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                      <button onClick={() => setViewFile(f)}
                        style={{ padding: "5px 12px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "10px", fontWeight: "bold", color: "#333333", background: "white", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#f0eded"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "white"; }}>
                        View
                      </button>
                      {/* More-vert context menu */}
                      <div ref={openRowMenu === f.id ? rowMenuRef : undefined} style={{ position: "relative" }}>
                        <button onClick={() => setOpenRowMenu(openRowMenu === f.id ? null : f.id)}
                          style={{ padding: "5px 6px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", cursor: "pointer", display: "flex", color: "#666666" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#f0eded"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "white"; }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>more_vert</span>
                        </button>
                        {openRowMenu === f.id && (
                          <div style={{ position: "absolute", right: 0, ...(rowIdx >= pageFiles.length - 2 ? { bottom: "100%", marginBottom: "4px" } : { top: "100%", marginTop: "4px" }), background: "white", border: "1px solid #e4e2e1", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 70, minWidth: "170px", overflow: "hidden" }}>
                            <button onClick={() => { approveFile(f.id); setOpenRowMenu(null); }}
                              style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: "13px", color: "#16a34a", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#f0fdf4"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check_circle</span> Approve
                            </button>
                            <button onClick={() => { setViewFile(f); setOpenRowMenu(null); }}
                              style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: "13px", color: "#e30613", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#fff5f5"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit_note</span> Review / Reject
                            </button>
                            <div style={{ height: "1px", background: "#f0eded", margin: "2px 0" }} />
                            <button onClick={() => deleteFile(f.id)}
                              style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: "13px", color: "#ba1a1a", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#fff0f0"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span> Delete
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

        {/* Grid view */}
        {viewMode === "grid" && pageFiles.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px", padding: "24px" }}>
            {pageFiles.map(f => (
              <div key={f.id} style={{ border: "1px solid #e4e2e1", borderRadius: "8px", padding: "16px", background: "white", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ width: "40px", height: "40px", background: "#f0eded", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ color: "#e30613" }}>{f.icon}</span>
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "#333333", wordBreak: "break-word" }}>{f.name}</p>
                  <p style={{ fontSize: "10px", color: "#999999", marginTop: "2px" }}>{f.meta}</p>
                </div>
                <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", border: "1px solid", whiteSpace: "nowrap", alignSelf: "flex-start", ...STATUS_INLINE[f.status] }}>{f.status}</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => setViewFile(f)}
                    style={{ flex: 1, padding: "6px", border: "1px solid #e4e2e1", borderRadius: "6px", fontSize: "10px", fontWeight: "bold", color: "#333333", background: "white", cursor: "pointer" }}>View</button>
                  {f.status === "Pending Review" && (
                    <button onClick={() => approveFile(f.id)}
                      style={{ flex: 1, padding: "6px", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "6px", fontSize: "10px", fontWeight: "bold", color: "#16a34a", background: "rgba(34,197,94,0.05)", cursor: "pointer" }}>Approve</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div style={{ padding: "12px 24px", background: "#f8f8f8", borderTop: "1px solid #e4e2e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#666666" }}>
            Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} files
          </p>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: "6px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.35 : 1, display: "flex" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_left</span>
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: "6px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", opacity: page >= totalPages - 1 ? 0.35 : 1, display: "flex" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Cards */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Project Evolution */}
        <div style={{ gridColumn: "span 2", border: "1px solid #e4e2e1", borderRadius: "12px", padding: "24px", background: "#f8f8f8", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <h4 style={{ fontSize: "20px", fontWeight: "500", color: "#333333", marginBottom: "8px" }}>Project Evolution</h4>
          <p style={{ fontSize: "14px", color: "#666666", maxWidth: "480px", lineHeight: 1.7 }}>
            Your team has approved <strong style={{ color: "#333333" }}>85% of design milestones</strong> for <strong style={{ color: "#333333" }}>{selectedProject.name}</strong>. The next deadline for material selection is in 48 hours.
          </p>
          <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex" }}>
              {["JT", "ER", "+5"].map((init, i) => (
                <div key={i} style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid white", background: "#eae8e7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold", color: "#e30613", marginLeft: i === 0 ? 0 : "-10px" }}>{init}</div>
              ))}
            </div>
            <span style={{ fontSize: "10px", fontWeight: "bold", color: "#e30613", textTransform: "uppercase", letterSpacing: "0.08em" }}>Active collaborators</span>
          </div>
          <div style={{ position: "absolute", right: "-20px", bottom: "-20px", opacity: 0.05, pointerEvents: "none" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "160px", color: "#e30613" }}>architecture</span>
          </div>
        </div>

        {/* Design Summary — replaces System Status */}
        <div style={{ border: "1px solid #e4e2e1", borderRadius: "12px", padding: "24px", background: "#f8f8f8", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: "24px", width: "3px", height: "24px", background: "#e30613", borderRadius: "0 2px 2px 0" }} />
          <h4 style={{ fontSize: "20px", fontWeight: "500", color: "#333333", marginBottom: "20px", paddingLeft: "8px" }}>Design Summary</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { label: "Total Files",       value: files.length,  color: "#333333" },
              { label: "Approved",          value: approvedCount, color: "#16a34a" },
              { label: "Pending Review",    value: pendingCount,  color: "#e30613" },
              { label: "Changes Needed",    value: changesCount,  color: "#ba1a1a" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "#333333" }}>{s.label}</span>
                <span style={{ fontSize: "20px", fontWeight: "bold", color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden re-upload input */}
      <input ref={fileInputRef} type="file" multiple accept=".pdf,.rvt,.dwg,.zip,.jpg,.png" style={{ display: "none" }} onChange={e => handleFileInput(e.target.files)} />

      {/* ── Upload Modal ────────────────────────────────────────── */}
      {mounted && uploadOpen && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "white", border: "1px solid #e4e2e1", width: "100%", maxWidth: "580px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "22px", fontWeight: "bold", color: "#333333" }}>Upload New Design</h3>
              <button onClick={() => { setUploadOpen(false); setUploadedFiles([]); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Drag zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.accept = ".pdf,.rvt,.dwg,.zip,.jpg,.png"; i.onchange = (e) => handleFileInput((e.target as HTMLInputElement).files); i.click(); }}
                style={{ border: `2px dashed ${dragActive ? "#e30613" : "#e4e2e1"}`, borderRadius: "8px", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", cursor: "pointer", background: dragActive ? "rgba(227,6,19,0.03)" : "#f8f8f8", transition: "all 0.15s" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "40px", color: dragActive ? "#e30613" : "#999999" }}>cloud_upload</span>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "15px", fontWeight: "600", color: "#333333" }}>
                    Drag &amp; drop files or <span style={{ color: "#e30613" }}>Browse</span>
                  </p>
                  <p style={{ fontSize: "11px", color: "#999999", marginTop: "4px" }}>Supports PDF, CAD, RVT, DWG, ZIP, JPG, PNG</p>
                </div>
              </div>
              {/* File list */}
              {uploadedFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {uploadedFiles.map((f, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f8f8f8", border: "1px solid #e4e2e1", borderRadius: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#e30613", flexShrink: 0 }}>description</span>
                        <span style={{ fontSize: "13px", color: "#333333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ fontSize: "12px", color: "#999999", flexShrink: 0 }}>({(f.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button onClick={() => setUploadedFiles(p => p.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "#999999", display: "flex", flexShrink: 0, marginLeft: "8px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => { setUploadOpen(false); setUploadedFiles([]); }} style={{ padding: "8px 24px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>Cancel</button>
              <button onClick={submitUpload} disabled={uploadedFiles.length === 0} style={{ padding: "8px 28px", border: "none", borderRadius: "6px", background: uploadedFiles.length > 0 ? "#e30613" : "#e4e2e1", color: uploadedFiles.length > 0 ? "white" : "#999999", fontWeight: "bold", cursor: uploadedFiles.length > 0 ? "pointer" : "not-allowed", fontSize: "14px" }}>
                Upload {uploadedFiles.length > 0 ? `(${uploadedFiles.length})` : ""}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── View / Document Preview Modal ──────────────────────── */}
      {mounted && viewFile && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setViewFile(null)}>
          <div style={{ background: "white", border: "1px solid #e4e2e1", width: "100%", maxWidth: previewUrl ? "900px" : "500px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
              <div style={{ width: "36px", height: "36px", background: "#f0eded", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color: "#e30613", fontSize: "20px" }}>{viewFile.icon}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#333333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewFile.name}</p>
                <p style={{ fontSize: "11px", color: "#666666" }}>{viewFile.meta} · {viewFile.by} · {viewFile.date}</p>
              </div>
              <span style={{ padding: "2px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", border: "1px solid", whiteSpace: "nowrap", flexShrink: 0, ...STATUS_INLINE[viewFile.status] }}>{viewFile.status}</span>
              <button onClick={() => setViewFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex", flexShrink: 0, marginLeft: "4px" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Document preview area */}
            <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
              {previewUrl && viewFile.fileObj?.type.startsWith("image/") && (
                <div style={{ width: "100%", height: "100%", minHeight: "500px", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
                  <img src={previewUrl} alt={viewFile.name} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} />
                </div>
              )}
              {previewUrl && viewFile.fileObj?.type === "application/pdf" && (
                <iframe src={previewUrl} title={viewFile.name} style={{ width: "100%", height: "600px", border: "none", display: "block" }} />
              )}
              {previewUrl && !viewFile.fileObj?.type.startsWith("image/") && viewFile.fileObj?.type !== "application/pdf" && (
                <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", background: "#f8f8f8" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#cccccc" }}>description</span>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#333333" }}>Preview not available for this file type</p>
                  <p style={{ fontSize: "12px", color: "#999999" }}>{viewFile.fileObj?.name}</p>
                  <a href={previewUrl} download={viewFile.name} style={{ marginTop: "8px", padding: "8px 20px", background: "#e30613", color: "white", borderRadius: "6px", fontWeight: "bold", fontSize: "13px", textDecoration: "none" }}>
                    Download file
                  </a>
                </div>
              )}
              {!previewUrl && (
                <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    {[
                      { label: "Uploaded By", value: viewFile.by },
                      { label: "Date",        value: viewFile.date },
                      { label: "File Size",   value: viewFile.meta.split("•")[1]?.trim() ?? "—" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999999", marginBottom: "3px" }}>{label}</p>
                        <p style={{ fontSize: "14px", color: "#333333" }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Demo file notice */}
                  <div style={{ background: "#f8f8f8", border: "1px solid #e4e2e1", borderRadius: "8px", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#cccccc" }}>preview</span>
                    <p style={{ fontSize: "14px", fontWeight: "600", color: "#333333" }}>Document preview unavailable</p>
                    <p style={{ fontSize: "12px", color: "#999999", maxWidth: "300px", lineHeight: 1.5 }}>
                      This is a demo entry. Upload the actual file to enable preview.
                    </p>
                  </div>
                  {/* Review panel */}
                  <ReviewPanel
                    status={reviewStatus} feedback={reviewFeedback} dirty={reviewDirty}
                    onStatusChange={s => { setReviewStatus(s); setReviewDirty(true); }}
                    onFeedbackChange={fb => { setReviewFeedback(fb); setReviewDirty(true); }}
                    onSave={saveReview}
                  />
                </div>
              )}
            </div>

            {/* Review panel — always visible at bottom (scrollable if preview is open) */}
            {previewUrl && (
              <div style={{ padding: "16px 20px", borderTop: "1px solid #e4e2e1", background: "white", flexShrink: 0 }}>
                <ReviewPanel
                  status={reviewStatus} feedback={reviewFeedback} dirty={reviewDirty}
                  onStatusChange={s => { setReviewStatus(s); setReviewDirty(true); }}
                  onFeedbackChange={fb => { setReviewFeedback(fb); setReviewDirty(true); }}
                  onSave={saveReview}
                />
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "8px" }}>
                {previewUrl && (
                  <a href={previewUrl} download={viewFile.name}
                    style={{ padding: "8px 16px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>download</span>
                    Download
                  </a>
                )}
              </div>
              <button onClick={() => setViewFile(null)} style={{ padding: "8px 20px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Feedback Modal ──────────────────────────────────────── */}
      {mounted && feedbackFile && createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setFeedbackFile(null)}>
          <div style={{ background: "white", border: "1px solid #e4e2e1", width: "100%", maxWidth: "480px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#ba1a1a", marginBottom: "2px" }}>Changes Needed</p>
                <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "#333333" }}>{feedbackFile.name}</h3>
              </div>
              <button onClick={() => setFeedbackFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666666", display: "flex" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding: "24px" }}>
              <p style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", color: "#999999", marginBottom: "10px" }}>Reviewer Feedback</p>
              <p style={{ fontSize: "14px", color: "#333333", lineHeight: 1.7 }}>{feedbackFile.feedback || "No specific feedback provided. Please contact the reviewer."}</p>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e2e1", background: "#f8f8f8", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => { setFeedbackFile(null); fileInputRef.current?.click(); }}
                style={{ padding: "8px 20px", border: "none", borderRadius: "6px", background: "#e30613", color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>Re-upload</button>
              <button onClick={() => setFeedbackFile(null)} style={{ padding: "8px 24px", border: "1px solid #e4e2e1", borderRadius: "6px", background: "white", color: "#333333", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
