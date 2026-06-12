"use client";
import { useState, useEffect } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { loadSnags, type SnagDTO } from "../data";

export default function SnagsPage() {
  const { selectedProject, team } = useProject();
  const [showModal, setShowModal] = useState(false);
  const [priority, setPriority] = useState("MEDIUM");
  const [allSnags, setAllSnags] = useState<SnagDTO[]>([]);

  useEffect(() => {
    loadSnags().then(setAllSnags).catch((err) => console.warn("[Snags] load failed:", err));
  }, []);

  const snags = selectedProject
    ? allSnags.filter(s => s.project === selectedProject.name)
    : allSnags;

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
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Site Snags</h2>
          <p className="text-[#666666] opacity-70">
            Snags for <span className="font-bold text-[#333333] opacity-100">{selectedProject.name}</span>
            <span className="text-[#e4e2e1] mx-2">•</span>
            <span className="text-[10px] font-bold uppercase text-[#e30613]">{snags.filter(s => !s.closed).length} open</span>
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm">
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          RAISE NEW SNAG
        </button>
      </div>

      {/* Cards */}
      {snags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-[#f8f8f8] border border-[#e4e2e1] rounded-xl">
          <div className="w-20 h-20 rounded-full bg-white border border-[#e4e2e1] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-[#e4e2e1]">check_circle</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#333333] mb-2">No Snags Found</h3>
          <p className="text-[16px] text-[#666666] w-full max-w-[28rem]">No snags have been raised for <span className="font-bold text-[#e30613]">{selectedProject.name}</span> yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {snags.map((s, i) => (
            <div key={i} className={`bg-[#f8f8f8] border border-surface-container-highest rounded p-5 relative group hover:border-primary/40 transition-all shadow-sm ${s.closed ? "opacity-80" : ""}`}>
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
                <div className="text-[#666666] text-center">
                  <span className="material-symbols-outlined text-[40px] text-surface-container-highest">image</span>
                  <p className="text-[10px] mt-1">Site photo</p>
                </div>
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
              <button onClick={() => setShowModal(false)} className="text-[#666666] hover:text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-primary uppercase">Location / Area</label>
                  <input className="bg-white border border-surface-container-highest rounded p-3 text-[16px] focus:outline-none focus:border-primary transition-all" placeholder="e.g. Living Room, Balcony" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-primary uppercase">Category</label>
                  <select className="bg-white border border-surface-container-highest rounded p-3 text-[16px] focus:outline-none focus:border-primary transition-all">
                    <option>Civil & Structure</option>
                    <option>Electrical</option>
                    <option>Plumbing</option>
                    <option>Finishes & Painting</option>
                    <option>Joinery</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-bold text-primary uppercase">Description of Issue</label>
                <textarea className="bg-white border border-surface-container-highest rounded p-3 text-[16px] focus:outline-none focus:border-primary transition-all" rows={3} placeholder="Provide clear details on the defect..." />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-primary uppercase">Priority Level</label>
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
                  <label className="text-[14px] font-bold text-primary uppercase">Assign To</label>
                  <select className="bg-white border border-surface-container-highest rounded p-3 text-[16px] focus:outline-none focus:border-primary transition-all">
                    {team.map(m => <option key={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-bold text-primary uppercase">Upload Evidence</label>
                <div className="border-2 border-dashed border-surface-container-highest rounded-lg p-10 flex flex-col items-center justify-center gap-3 text-[#666666] hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#f8f8f8]">
                  <span className="material-symbols-outlined text-[40px]">cloud_upload</span>
                  <div className="text-center">
                    <p className="font-bold text-[#333333]">Click to upload or drag and drop</p>
                    <p className="text-[10px]">High-resolution JPG or PNG (Max 10MB)</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-surface-container-highest bg-[#f8f8f8] flex justify-end gap-4">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 rounded border border-surface-container-highest text-[#333333] hover:bg-surface-container-high font-bold transition-all">CANCEL</button>
              <button className="bg-primary text-white px-8 py-2 rounded font-bold hover:opacity-90 active:scale-95 shadow-sm transition-all">RAISE SNAG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
