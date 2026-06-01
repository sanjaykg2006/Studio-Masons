"use client";
import { useState, useRef, useEffect } from "react";
import { useProject } from "../../contexts/ProjectContext";

const statusColor: Record<string, string> = {
  "In Progress": "bg-primary/10 text-primary border-primary/20",
  "Delayed": "bg-error/10 text-error border-error/20",
  "On Track": "bg-green-500/10 text-green-600 border-green-500/20",
  "New Site": "bg-[#0059a8]/10 text-[#0059a8] border-[#0059a8]/20",
  "Completed": "bg-green-500/10 text-green-600 border-green-500/20",
};

export default function Topbar() {
  const { projects, selectedProject, setSelectedProjectId } = useProject();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center w-full px-6 h-16 bg-white border-b border-[#e4e2e1]">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" style={{ fontSize: "18px" }}>search</span>
          <input
            className="w-full bg-[#f8f8f8] border border-[#e4e2e1] rounded-lg pl-10 pr-4 py-2 text-[16px] focus:border-[#e30613] focus:outline-none transition-all"
            placeholder="Search projects, documents, or sites..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        {/* Project Selector Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className={`flex items-center gap-2 px-4 py-2 rounded font-bold text-[14px] transition-all ${
              selectedProject
                ? "bg-[#e30613] text-white hover:opacity-90"
                : "bg-[#f8f8f8] border border-[#e4e2e1] text-[#333333] hover:border-[#e30613] hover:text-[#e30613]"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              {selectedProject ? "apartment" : "folder_open"}
            </span>
            <span className="max-w-[160px] truncate">
              {selectedProject ? selectedProject.name : "All Projects"}
            </span>
            <span
              className="material-symbols-outlined transition-transform duration-200"
              style={{ fontSize: "18px", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              expand_more
            </span>
          </button>

          {/* Dropdown Panel */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-[#e4e2e1] rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="px-4 py-3 bg-[#f8f8f8] border-b border-[#e4e2e1]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">Switch Project</p>
              </div>

              {/* All Projects Option */}
              <button
                onClick={() => { setSelectedProjectId(null); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f8f8f8] border-b border-[#e4e2e1] ${
                  !selectedProject ? "bg-[#f8f8f8]" : ""
                }`}
              >
                <div className="w-8 h-8 rounded bg-[#e4e2e1] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#666666]" style={{ fontSize: "18px" }}>grid_view</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#333333]">All Projects</p>
                  <p className="text-[10px] text-[#666666]">Global overview across all sites</p>
                </div>
                {!selectedProject && (
                  <span className="material-symbols-outlined text-[#e30613]" style={{ fontSize: "18px" }}>check_circle</span>
                )}
              </button>

              {/* Project List */}
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                {projects.map((project) => {
                  const isSelected = selectedProject?.id === project.id;
                  return (
                    <button
                      key={project.id}
                      onClick={() => { setSelectedProjectId(project.id); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-[#f8f8f8] border-b border-[#f0eded] last:border-b-0 ${
                        isSelected ? "bg-[#f8f8f8] border-l-[3px] border-l-[#e30613]" : ""
                      }`}
                    >
                      <div className="w-8 h-8 rounded bg-[#e30613]/10 flex items-center justify-center shrink-0">
                        <span className="text-[12px] font-bold text-[#e30613]">
                          {project.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] truncate ${isSelected ? "font-bold text-[#e30613]" : "font-medium text-[#333333]"}`}>
                          {project.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#666666]">{project.location}</span>
                          <span className="text-[10px] text-[#e4e2e1]">•</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusColor[project.status] || ""}`}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-[12px] font-bold text-[#333333]">{project.pct}%</p>
                          <div className="w-12 h-1 bg-[#e4e2e1] rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-[#e30613] rounded-full"
                              style={{ width: `${project.pct}%` }}
                            />
                          </div>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-[#e30613]" style={{ fontSize: "18px" }}>check_circle</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button className="text-[#666666] hover:text-[#e30613] transition-colors relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-0 right-0 w-2 h-2 bg-[#e30613] rounded-full border-2 border-white"></span>
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#e4e2e1] flex items-center justify-center text-[12px] font-bold text-[#666666]">SM</div>
      </div>
    </header>
  );
}
