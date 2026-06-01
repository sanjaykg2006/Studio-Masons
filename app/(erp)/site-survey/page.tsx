"use client";
import { useState } from "react";

const surveys = [
  { id: "SS-001", project: "Indiranagar Residence", date: "Nov 12, 2024", conductor: "Vikram R.", status: "Completed", statusStyle: "bg-green-500/10 text-green-600 border-green-500/20", items: 24, photos: 18 },
  { id: "SS-002", project: "Whitefield Office", date: "Nov 10, 2024", conductor: "Sneha P.", status: "In Review", statusStyle: "bg-[#e30613]/10 text-[#e30613] border-[#e30613]/20", items: 31, photos: 22 },
  { id: "SS-003", project: "Koramangala Villa", date: "Nov 08, 2024", conductor: "Amit S.", status: "Completed", statusStyle: "bg-green-500/10 text-green-600 border-green-500/20", items: 19, photos: 14 },
  { id: "SS-004", project: "HSR Layout G+3", date: "Nov 05, 2024", conductor: "Rahul K.", status: "Pending", statusStyle: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", items: 0, photos: 0 },
];

const checklistItems = [
  { category: "Physical Measurements", items: ["Floor dimensions verified", "Ceiling height measured", "Door/window openings noted", "Structural beam locations marked"] },
  { category: "Site Conditions", items: ["Existing plumbing mapped", "Electrical panel location", "Natural light assessment", "Ventilation points identified"] },
  { category: "Media Documentation", items: ["360° photos captured", "Video walkthrough recorded", "Defect close-ups documented", "Site access points photographed"] },
];

export default function SiteSurveyPage() {
  const [showModal, setShowModal] = useState(false);
  const [activeChecks, setActiveChecks] = useState<string[]>([]);

  const toggleCheck = (item: string) => {
    setActiveChecks(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <span>Dashboard</span>
        <span className="material-symbols-outlined" style={{fontSize:"12px"}}>chevron_right</span>
        <span className="text-[#e30613]">Site Survey</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Site Survey / Recce</h2>
          <p className="text-[#666666]">Capture site information including physical measurements, videos, and site conditions.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-[#e30613] text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all">
          <span className="material-symbols-outlined" style={{fontSize:"20px"}}>add_circle</span>
          NEW SURVEY
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[
          { label: "Total Surveys", value: "24", icon: "assignment", color: "#e30613" },
          { label: "Completed", value: "18", icon: "task_alt", color: "#16a34a" },
          { label: "In Review", value: "4", icon: "pending_actions", color: "#e30613" },
          { label: "Pending", value: "2", icon: "schedule", color: "#ca8a04" },
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

      {/* Survey Table */}
      <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm mb-10">
        <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-[#e30613]" />
            <h3 className="text-[20px] font-medium text-[#333333]">Recent Surveys</h3>
          </div>
          <button className="p-2 border border-[#e4e2e1] rounded hover:bg-[#f0eded] transition-colors">
            <span className="material-symbols-outlined text-[#666666]" style={{fontSize:"18px"}}>filter_list</span>
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
              {["Survey ID", "Project", "Date", "Conducted By", "Checklist Items", "Photos", "Status", "Actions"].map(h => (
                <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4e2e1]">
            {surveys.map((s, i) => (
              <tr key={i} className="hover:bg-[#f8f8f8] transition-colors">
                <td className="px-6 py-4 font-bold text-[#e30613] text-[14px]">{s.id}</td>
                <td className="px-6 py-4 font-medium text-[#333333]">{s.project}</td>
                <td className="px-6 py-4 text-[#666666] text-[14px]">{s.date}</td>
                <td className="px-6 py-4 text-[#333333]">{s.conductor}</td>
                <td className="px-6 py-4 text-[#333333]">{s.items > 0 ? `${s.items} items` : "—"}</td>
                <td className="px-6 py-4 text-[#333333]">{s.photos > 0 ? `${s.photos} files` : "—"}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${s.statusStyle}`}>{s.status}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 border border-[#e4e2e1] rounded text-[10px] font-bold text-[#333333] hover:bg-[#f0eded] transition-colors">View</button>
                    <button className="px-3 py-1.5 border border-[#e4e2e1] rounded text-[10px] font-bold text-[#666666] hover:bg-[#f0eded] transition-colors">
                      <span className="material-symbols-outlined" style={{fontSize:"14px"}}>more_vert</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Checklist Template */}
      <div className="border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8]">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-[#e30613]" />
            <h3 className="text-[20px] font-medium text-[#333333]">Standard Checklist Template</h3>
          </div>
          <p className="text-[#666666] text-[14px] mt-1 ml-3">BQain mobile app captures these data points on site</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {checklistItems.map((section, i) => (
            <div key={i}>
              <h4 className="text-[12px] font-bold uppercase tracking-widest text-[#e30613] mb-4">{section.category}</h4>
              <div className="space-y-3">
                {section.items.map((item, j) => (
                  <div key={j} onClick={() => toggleCheck(item)}
                    className="flex items-center gap-3 p-3 border border-[#e4e2e1] rounded cursor-pointer hover:border-[#e30613]/40 hover:bg-[#f8f8f8] transition-all">
                    <div style={{width:"18px",height:"18px",borderRadius:"4px",border:`2px solid ${activeChecks.includes(item) ? "#e30613" : "#e4e2e1"}`,background:activeChecks.includes(item) ? "#e30613" : "white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {activeChecks.includes(item) && <span className="material-symbols-outlined text-white" style={{fontSize:"12px"}}>check</span>}
                    </div>
                    <span className="text-[14px] text-[#333333]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Survey Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-[#e4e2e1] w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#e4e2e1] flex justify-between items-center bg-[#f8f8f8]">
              <h3 className="text-[24px] font-bold text-[#333333]">New Site Survey</h3>
              <button onClick={() => setShowModal(false)} className="text-[#666666] hover:text-[#e30613] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-[#e30613] uppercase">Project</label>
                  <select className="bg-white border border-[#e4e2e1] rounded p-3 text-[16px] focus:outline-none focus:border-[#e30613]">
                    <option>Indiranagar Residence</option>
                    <option>Whitefield Office</option>
                    <option>Koramangala Villa</option>
                    <option>HSR Layout G+3</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-[#e30613] uppercase">Survey Date</label>
                  <input type="date" className="bg-white border border-[#e4e2e1] rounded p-3 text-[16px] focus:outline-none focus:border-[#e30613]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-[#e30613] uppercase">Conducted By</label>
                  <select className="bg-white border border-[#e4e2e1] rounded p-3 text-[16px] focus:outline-none focus:border-[#e30613]">
                    <option>Vikram R.</option><option>Sneha P.</option><option>Amit S.</option><option>Rahul K.</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-bold text-[#e30613] uppercase">Survey Type</label>
                  <select className="bg-white border border-[#e4e2e1] rounded p-3 text-[16px] focus:outline-none focus:border-[#e30613]">
                    <option>Initial Recce</option><option>Progress Check</option><option>Pre-Handover</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-bold text-[#e30613] uppercase">Notes</label>
                <textarea className="bg-white border border-[#e4e2e1] rounded p-3 text-[16px] focus:outline-none focus:border-[#e30613]" rows={3} placeholder="Site observations, access notes, special conditions..." />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-bold text-[#e30613] uppercase">Upload Site Media</label>
                <div className="border-2 border-dashed border-[#e4e2e1] rounded-lg p-10 flex flex-col items-center justify-center gap-3 text-[#666666] hover:border-[#e30613] hover:text-[#e30613] transition-all cursor-pointer bg-[#f8f8f8]">
                  <span className="material-symbols-outlined" style={{fontSize:"40px"}}>cloud_upload</span>
                  <div className="text-center">
                    <p className="font-bold text-[#333333]">Photos, Videos, Measurements</p>
                    <p className="text-[10px]">JPG, PNG, MP4, PDF (Max 50MB each)</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-end gap-4">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 rounded border border-[#e4e2e1] text-[#333333] hover:bg-[#eae8e7] font-bold transition-all">CANCEL</button>
              <button className="bg-[#e30613] text-white px-8 py-2 rounded font-bold hover:opacity-90 shadow-sm transition-all">CREATE SURVEY</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
