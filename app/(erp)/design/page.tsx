"use client";
import { useProject } from "../../../contexts/ProjectContext";

export default function DesignPage() {
  const { selectedProject } = useProject();

  const files = [
    { icon: "architecture", name: "Master_Plan_V3.pdf", meta: "Architectural Set • 24.5 MB", by: "Marcus Sterling", date: "Oct 24, 2023", status: "Pending Review", statusStyle: "bg-primary/10 text-primary border-primary/20", actions: ["View", "Approve"] },
    { icon: "texture", name: "Material_Specs_Final.rvt", meta: "Revit Model • 142.1 MB", by: "Elena Rossi", date: "Oct 22, 2023", status: "Approved", statusStyle: "bg-green-500/10 text-green-600 border-green-500/20", actions: ["View"] },
    { icon: "imagesmode", name: "Kitchen_Lighting_Mockups.zip", meta: "Asset Bundle • 89.4 MB", by: "Marcus Sterling", date: "Oct 20, 2023", status: "Changes Needed", statusStyle: "bg-error/10 text-error border-error/20", actions: ["View Feedback", "Re-upload"] },
    { icon: "description", name: "Structural_Analysis_B.pdf", meta: "Engineering Report • 5.1 MB", by: "Dr. Sarah Laine", date: "Oct 19, 2023", status: "Approved", statusStyle: "bg-green-500/10 text-green-600 border-green-500/20", actions: ["View"] },
  ];

  // No project selected — show prompt
  if (!selectedProject) {
    return (
      <div>
        <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-wider">
          <span>Dashboard</span>
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          <span className="text-primary">Design Management</span>
        </nav>
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">Design Management</h2>
        <p className="text-[16px] text-[#666666] mb-10">Review, approve, and organize architectural blueprints and material specs.</p>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[#f8f8f8] border border-[#e4e2e1] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-[#e4e2e1]">folder_open</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#333333] mb-2">No Project Selected</h3>
          <p className="text-[16px] text-[#666666] max-w-md">Use the <span className="font-bold text-[#e30613]">Project Selector</span> in the top bar to choose a project and view its design files.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-wider">
        <span>Dashboard</span>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="text-primary">Design Management</span>
      </nav>
      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333]">Design Management</h2>
          <p className="text-[16px] text-[#666666] mt-1">
            Design files for <span className="font-bold text-[#333333]">{selectedProject.name}</span>
            <span className="text-[#e4e2e1] mx-2">•</span>
            <span className="text-[10px] font-bold uppercase text-[#e30613]">{selectedProject.status}</span>
          </p>
        </div>
        <button className="bg-primary text-white px-6 py-3 rounded-lg text-[14px] font-bold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-sm">
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Upload New Design
        </button>
      </div>
      {/* Upload Zone */}
      <div className="drag-zone w-full h-48 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-surface-container-low transition-all mb-10">
        <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">cloud_upload</span>
        </div>
        <div className="text-center">
          <p className="text-[18px] text-[#333333]">Drag and drop design files or <span className="text-primary font-bold">Browse</span></p>
          <p className="text-[10px] text-[#666666] mt-1 uppercase tracking-widest">Supports PDF, CAD, RVT, and High-Res Imagery</p>
        </div>
      </div>
      {/* Table */}
      <div className="bg-white border border-surface-container-highest rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-surface-container-highest flex justify-between items-center bg-[#f8f8f8]">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-primary" />
            <h3 className="text-[20px] font-medium text-[#333333]">Recent Designs</h3>
          </div>
          <div className="flex gap-2">
            {["filter_list", "grid_view"].map(icon => (
              <button key={icon} className="p-2 border border-surface-container-highest rounded hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[18px] text-[#666666]">{icon}</span>
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#f8f8f8] border-b border-surface-container-highest">
              {["File Name", "Uploaded By", "Date", "Status", "Actions"].map(h => (
                <th key={h} className={`px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#666666] ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-highest">
            {files.map((f, i) => (
              <tr key={i} className="hover:bg-[#f8f8f8] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-surface-container-high flex items-center justify-center rounded">
                      <span className="material-symbols-outlined text-primary">{f.icon}</span>
                    </div>
                    <div>
                      <p className="text-[16px] text-[#333333]">{f.name}</p>
                      <p className="text-[10px] text-[#666666]">{f.meta}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-[16px] text-[#333333]">{f.by}</td>
                <td className="px-6 py-4 text-[16px] text-[#333333]">{f.date}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${f.statusStyle}`}>{f.status}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {f.actions.map(a => (
                      <button key={a} className="px-3 py-1.5 border border-surface-container-highest rounded text-[10px] font-bold text-[#333333] hover:bg-surface-container-high transition-colors">{a}</button>
                    ))}
                    <button className="p-1.5 text-[#666666] hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 bg-[#f8f8f8] border-t border-surface-container-highest flex justify-between items-center">
          <p className="text-[10px] font-bold uppercase text-[#666666]">Showing 1-4 of 18 files</p>
          <div className="flex gap-2">
            <button disabled className="p-2 border border-surface-container-highest rounded opacity-30"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
            <button className="p-2 border border-surface-container-highest rounded hover:bg-surface-container transition-colors"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
          </div>
        </div>
      </div>
      {/* Bottom Cards */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 border border-surface-container-highest rounded-xl p-6 bg-surface-container shadow-sm relative overflow-hidden">
          <h4 className="text-[20px] font-medium text-[#333333] mb-2">Project Evolution</h4>
          <p className="text-[16px] text-[#666666] max-w-md">Your team has approved 85% of design milestones for <strong>{selectedProject.name}</strong>. The next deadline for material selection is in 48 hours.</p>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex -space-x-3">
              {["JT", "ER", "+5"].map((init, i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-primary">{init}</div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Active collaborators</span>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-5">
            <span className="material-symbols-outlined text-[160px] text-primary">architecture</span>
          </div>
        </div>
        <div className="border border-surface-container-highest rounded-xl p-6 bg-[#f8f8f8] shadow-sm relative">
          <div className="absolute left-0 top-6 w-1 h-6 bg-primary" />
          <h4 className="text-[20px] font-medium text-[#333333] mb-6 pl-2">System Status</h4>
          <div className="space-y-6">
            {[
              { label: "Cloud Sync", status: "Active", color: "bg-green-500", textColor: "text-green-600" },
              { label: "CAD Render Engine", status: "Stable", color: "bg-green-500", textColor: "text-green-600" },
              { label: "ERP Linkage", status: "Syncing...", color: "bg-primary animate-pulse", textColor: "text-primary" },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[16px] text-[#333333]">{s.label}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className={`text-[14px] font-bold ${s.textColor}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
