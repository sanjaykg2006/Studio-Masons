"use client";
import { useState, useEffect, useRef } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { loadSnags, createSnag, type SnagDTO } from "../data";

// Work packages snags are segregated under. These mirror the category dropdown
// in the raise-snag form so every snag lands in exactly one package section.
const PACKAGES = ["Civil & Structure", "Electrical", "Plumbing", "Finishes & Painting", "Joinery"] as const;

// Downscale an uploaded image to a JPEG data URL (max 1000px on the long edge) so
// the evidence photo can be persisted in the database and survive reloads without
// needing object storage.
function fileToThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1000;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas unavailable")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("invalid image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export default function SnagsPage() {
  const { selectedProject, team, logActivity } = useProject();
  const [showModal, setShowModal] = useState(false);
  const [allSnags, setAllSnags] = useState<SnagDTO[]>([]);

  // ── Raise-snag form state (every field is required) ──────────────
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<string>(PACKAGES[0]);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignee, setAssignee] = useState("");
  const [evidenceName, setEvidenceName] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSnags().then(setAllSnags).catch((err) => console.warn("[Snags] load failed:", err));
  }, []);

  const snags = selectedProject
    ? allSnags.filter(s => s.project === selectedProject.name)
    : allSnags;

  const openCount = snags.filter(s => !s.closed).length;
  const closedCount = snags.filter(s => s.closed).length;

  function resetForm() {
    setLocation("");
    setCategory(PACKAGES[0]);
    setDescription("");
    setPriority("MEDIUM");
    setAssignee("");
    setEvidenceName("");
    setEvidenceUrl("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeModal() {
    resetForm();
    setShowModal(false);
  }

  async function handleEvidence(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Evidence must be a JPG or PNG image."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Evidence image must be under 10MB."); return; }
    try {
      const url = await fileToThumbnail(file);
      setEvidenceUrl(url);
      setEvidenceName(file.name);
      setError("");
    } catch {
      setError("Couldn't read that image. Please try another file.");
    }
  }

  const isValid =
    location.trim() !== "" &&
    category !== "" &&
    description.trim() !== "" &&
    priority !== "" &&
    assignee !== "" &&
    evidenceUrl !== "";

  async function handleRaise() {
    if (!selectedProject) return;
    if (!isValid) { setError("Please complete every field and attach evidence before raising the snag."); return; }
    setSubmitting(true);
    setError("");
    try {
      const snag = await createSnag({
        project: selectedProject.name,
        title: location,
        category,
        priority,
        description,
        assignee,
        evidenceName,
        evidenceUrl,
      });
      setAllSnags(prev => [...prev, snag]);
      logActivity({ icon: "priority_high", color: "#e30613", route: "/snags", text: "New snag raised in", bold: selectedProject.name, detail: `${snag.title} (${category}) — ${description.trim()}` });
      closeModal();
    } catch (err) {
      console.warn("[Snags] create failed:", err);
      setError("Couldn't save the snag. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // No project selected — show prompt
  if (!selectedProject) {
    return (
      <div>
        <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
          <span>Dashboard</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#333333]">Snags</span>
        </nav>
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">Site Snags</h2>
        <p className="text-[#666666] opacity-70 mb-10">Monitor and resolve construction defects across all active site sectors.</p>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[#f8f8f8] border border-[#e4e2e1] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-[#e4e2e1]">report_problem</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#333333] mb-2">No Project Selected</h3>
          <p className="text-[16px] text-[#666666] w-full max-w-[28rem]">Use the <span className="font-bold text-[#e30613]">Project Selector</span> in the top bar to choose a project and view its snags.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <span>Dashboard</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[#333333]">Snags</span>
      </nav>
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Site Snags</h2>
          <p className="text-[#666666] opacity-70">
            Snags for <span className="font-bold text-[#333333] opacity-100">{selectedProject.name}</span>
            <span className="text-[#e4e2e1] mx-2">•</span>
            <span className="text-[10px] font-bold uppercase text-[#e30613]">{openCount} open</span>
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm">
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          RAISE NEW SNAG
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#f8f8f8] border border-surface-container-highest rounded p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-primary">report_problem</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">Active Snags</p>
            <p className="text-[32px] font-bold text-[#333333] leading-tight">{openCount}</p>
          </div>
        </div>
        <div className="bg-[#f8f8f8] border border-surface-container-highest rounded p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-green-600">check_circle</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">Closed Snags</p>
            <p className="text-[32px] font-bold text-[#333333] leading-tight">{closedCount}</p>
          </div>
        </div>
        <div className="bg-[#f8f8f8] border border-surface-container-highest rounded p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-[#666666]">format_list_bulleted</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">Total Snags</p>
            <p className="text-[32px] font-bold text-[#333333] leading-tight">{snags.length}</p>
          </div>
        </div>
      </div>

      {/* Cards grouped by work package */}
      {snags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-[#f8f8f8] border border-[#e4e2e1] rounded-xl">
          <div className="w-20 h-20 rounded-full bg-white border border-[#e4e2e1] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-[#e4e2e1]">check_circle</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#333333] mb-2">No Snags Found</h3>
          <p className="text-[16px] text-[#666666] w-full max-w-[28rem]">No snags have been raised for <span className="font-bold text-[#e30613]">{selectedProject.name}</span> yet.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {(() => {
            // Group by package, keeping known packages in their defined order and
            // appending any other categories found in the data at the end.
            const known = PACKAGES.filter(pkg => snags.some(s => s.category === pkg));
            const extras = [...new Set(snags.map(s => s.category).filter(c => !PACKAGES.includes(c as typeof PACKAGES[number])))];
            return [...known, ...extras];
          })().map(pkg => {
            const group = snags.filter(s => s.category === pkg);
            return (
              <section key={pkg}>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#333333]">{pkg}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container-highest text-[#666666]">{group.length}</span>
                  <span className="text-[10px] font-bold uppercase text-[#e30613]">{group.filter(s => !s.closed).length} open</span>
                  <div className="flex-1 h-px bg-surface-container-highest" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {group.map((s) => (
                    <div key={s.id} className={`bg-[#f8f8f8] border border-surface-container-highest rounded p-5 relative group hover:border-primary/40 transition-all shadow-sm ${s.closed ? "opacity-80" : ""}`}>
                      {s.accent && <div className="absolute top-0 left-0 w-[2px] h-12 bg-primary" />}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] font-bold text-primary tracking-tighter">{s.id}</span>
                          <h3 className="text-[20px] font-medium mt-1 text-[#333333]">{s.title}</h3>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.priorityStyle}`}>{s.priority}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.statusStyle}`}>{s.status}</span>
                        </div>
                      </div>
                      <p className="text-[#666666] text-[16px] mb-6 line-clamp-2">{s.desc}</p>
                      <div className={`aspect-video w-full rounded overflow-hidden mb-6 bg-surface-container-lowest border border-surface-container-highest flex items-center justify-center ${s.closed ? "grayscale opacity-50" : ""}`}>
                        {s.evidenceUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.evidenceUrl} alt={s.evidenceName ?? "Site photo"} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[#666666] text-center">
                            <span className="material-symbols-outlined text-[40px] text-surface-container-highest">image</span>
                            <p className="text-[10px] mt-1">Site photo</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between border-t border-surface-container-highest pt-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-primary">
                            {s.assignee.split(" ").map(w => w[0]).join("").slice(0, 2)}
                          </div>
                          <span className="text-[14px] text-[#333333]">{s.assignee}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#666666]">{s.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-surface-container-highest w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-surface-container-highest flex justify-between items-center bg-[#f8f8f8]">
              <div>
                <h3 className="text-[24px] font-bold text-[#333333]">Raise New Snag</h3>
                <p className="text-[10px] text-[#666666] mt-1">Project: <span className="font-bold text-[#e30613]">{selectedProject.name}</span></p>
              </div>
              <button onClick={closeModal} className="text-[#666666] hover:text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-primary uppercase">Location / Area <span className="text-error">*</span></label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} className="bg-white border border-surface-container-highest rounded p-3 text-[16px] focus:outline-none focus:border-primary transition-all" placeholder="e.g. Living Room, Balcony" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-primary uppercase">Package / Category <span className="text-error">*</span></label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white border border-surface-container-highest rounded p-3 text-[16px] focus:outline-none focus:border-primary transition-all">
                    {PACKAGES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-bold text-primary uppercase">Description of Issue <span className="text-error">*</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white border border-surface-container-highest rounded p-3 text-[16px] focus:outline-none focus:border-primary transition-all" rows={3} placeholder="Provide clear details on the defect..." />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-primary uppercase">Priority Level <span className="text-error">*</span></label>
                  <div className="flex gap-2">
                    {["LOW", "MEDIUM", "HIGH"].map(p => (
                      <button key={p} onClick={() => setPriority(p)} type="button"
                        className={`flex-1 py-2 rounded text-[10px] font-bold transition-all border ${
                          priority === p
                            ? p === "HIGH" ? "border-error/50 text-error bg-error/10"
                              : p === "MEDIUM" ? "border-yellow-600/50 text-yellow-600 bg-yellow-600/10"
                              : "border-surface-container-highest bg-surface-container-high text-[#333333]"
                            : "border-surface-container-highest text-[#666666] hover:bg-surface-container-high"
                        }`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-primary uppercase">Assign To <span className="text-error">*</span></label>
                  <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="bg-white border border-surface-container-highest rounded p-3 text-[16px] focus:outline-none focus:border-primary transition-all">
                    <option value="" disabled>Select a team member…</option>
                    {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-bold text-primary uppercase">Upload Evidence <span className="text-error">*</span></label>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleEvidence(e.target.files?.[0])} />
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-surface-container-highest rounded-lg p-6 flex flex-col items-center justify-center gap-3 text-[#666666] hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#f8f8f8]">
                  {evidenceUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={evidenceUrl} alt={evidenceName} className="max-h-40 rounded border border-surface-container-highest object-contain" />
                      <p className="text-[12px] font-bold text-[#333333]">{evidenceName}</p>
                      <p className="text-[10px]">Click to replace</p>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[40px]">cloud_upload</span>
                      <div className="text-center">
                        <p className="font-bold text-[#333333]">Click to upload</p>
                        <p className="text-[10px]">High-resolution JPG or PNG (Max 10MB)</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {error && <p className="text-[12px] font-bold text-error">{error}</p>}
            </div>
            <div className="p-6 border-t border-surface-container-highest bg-[#f8f8f8] flex justify-end gap-4">
              <button onClick={closeModal} className="px-6 py-2 rounded border border-surface-container-highest text-[#333333] hover:bg-surface-container-high font-bold transition-all">CANCEL</button>
              <button onClick={handleRaise} disabled={!isValid || submitting} className="bg-primary text-white px-8 py-2 rounded font-bold hover:opacity-90 active:scale-95 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
                {submitting ? "RAISING…" : "RAISE SNAG"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
