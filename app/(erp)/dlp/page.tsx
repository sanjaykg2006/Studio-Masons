"use client";
import { useState, useEffect } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { loadDlpTickets, loadAmcSchedule, type DlpTicketDTO, type AmcScheduleDTO } from "../data";

export default function DLPPage() {
  const { selectedProject, team, projects } = useProject();
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState<DlpTicketDTO[]>([]);
  const [amcSchedule, setAmcSchedule] = useState<AmcScheduleDTO[]>([]);

  useEffect(() => {
    loadDlpTickets().then(setTickets).catch((err) => console.warn("[DLP] tickets load failed:", err));
    loadAmcSchedule().then(setAmcSchedule).catch((err) => console.warn("[DLP] amc load failed:", err));
  }, []);

  const visibleTickets = selectedProject
    ? tickets.filter(t => t.project === selectedProject.name)
    : tickets;

  if (!selectedProject) {
    return (
      <div>
        <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
          <span>Dashboard</span>
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
          <span className="text-[#e30613]">DLP / Maintenance</span>
        </nav>
        <h2 className="text-[32px] font-bold text-[#333333] mb-2">DLP / Maintenance</h2>
        <p className="text-[#666666] mb-10">Defect Liability Period tracking and Annual Maintenance Contract management.</p>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[#f8f8f8] border border-[#e4e2e1] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-[#e4e2e1]">handyman</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#333333] mb-2">No Project Selected</h3>
          <p className="text-[16px] text-[#666666] w-full max-w-[28rem]">Use the <span className="font-bold text-[#e30613]">Project Selector</span> in the top bar to choose a project and view its DLP tickets.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <span>Dashboard</span>
        <span className="material-symbols-outlined" style={{fontSize:"12px"}}>chevron_right</span>
        <span className="text-[#e30613]">DLP / Maintenance</span>
      </nav>

      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">DLP / Maintenance</h2>
          <p className="text-[#666666]">Defect Liability Period tracking and Annual Maintenance Contract management.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-[#e30613] text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all">
          <span className="material-symbols-outlined" style={{fontSize:"20px"}}>add_circle</span>
          RAISE TICKET
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        {[
          { label: "Open Tickets", value: "8", icon: "confirmation_number", color: "#e30613" },
          { label: "In Progress", value: "5", icon: "engineering", color: "#ca8a04" },
          { label: "AMC Due Soon", value: "3", icon: "event_busy", color: "#7c3aed" },
          { label: "Resolved (30d)", value: "12", icon: "task_alt", color: "#16a34a" },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets Table */}
        <div className="lg:col-span-2 bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex items-center gap-2">
            <div className="w-1 h-5 bg-[#e30613]" />
            <h3 className="text-[20px] font-medium text-[#333333]">DLP Tickets</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
                {["Ticket", "Issue", "Project", "Assignee", "Due", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e2e1]">
              {visibleTickets.map((t, i) => (
                <tr key={i} className="hover:bg-[#f8f8f8] transition-colors">
                  <td className="px-4 py-4 font-bold text-[#e30613] text-[13px]">{t.id}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#333333] text-[14px]">{t.title}</div>
                    <div className="text-[#666666] text-[11px]">{t.category}</div>
                  </td>
                  <td className="px-4 py-4 text-[#333333] text-[13px]">{t.project.split(" ").slice(0,2).join(" ")}</td>
                  <td className="px-4 py-4 text-[#666666] text-[13px]">{t.assignee}</td>
                  <td className="px-4 py-4 text-[#666666] text-[13px]">{t.dueDate}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${t.statusStyle}`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AMC Schedule */}
        <div className="border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8]">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#e30613]" />
              <h3 className="text-[18px] font-medium text-[#333333]">AMC Schedule</h3>
            </div>
          </div>
          <div className="divide-y divide-[#e4e2e1]">
            {amcSchedule.map((a, i) => (
              <div key={i} className={`p-4 ${a.overdue ? "bg-[#ba1a1a]/5" : ""}`}>
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-[#333333] text-[14px]">{a.service}</p>
                  {a.overdue && (
                    <span style={{fontSize:"10px",fontWeight:"bold",color:"#ba1a1a",background:"rgba(186,26,26,0.1)",padding:"2px 8px",borderRadius:"999px",border:"1px solid rgba(186,26,26,0.2)"}}>OVERDUE</span>
                  )}
                </div>
                <p className="text-[#666666] text-[12px] mb-3">{a.project} · {a.frequency}</p>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{fontSize:"14px",color:a.overdue?"#ba1a1a":"#666666"}}>calendar_today</span>
                  <span style={{fontSize:"12px",fontWeight:"bold",color:a.overdue?"#ba1a1a":"#333333"}}>{a.nextDue}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-[#e4e2e1] bg-[#f8f8f8]">
            <button className="w-full py-2 border border-[#e4e2e1] rounded text-[13px] font-bold text-[#333333] hover:bg-[#eae8e7] transition-all">VIEW FULL SCHEDULE</button>
          </div>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-[#e4e2e1] w-full max-w-[32rem] rounded-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#e4e2e1] flex justify-between items-center bg-[#f8f8f8]">
              <h3 className="text-[24px] font-bold text-[#333333]">Raise DLP Ticket</h3>
              <button onClick={() => setShowModal(false)} className="text-[#666666] hover:text-[#e30613] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[#e30613] uppercase">Project</label>
                  <select className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]">
                    {projects.map(p => <option key={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[#e30613] uppercase">Category</label>
                  <select className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]">
                    <option>Civil</option><option>Electrical</option><option>Plumbing</option><option>Finishing</option><option>Joinery</option><option>AMC</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Issue Title</label>
                <input className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]" placeholder="Brief description of the defect..." />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Description</label>
                <textarea className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]" rows={3} placeholder="Detailed description, location, impact..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[#e30613] uppercase">Assign To</label>
                  <select className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]">
                    {team.map(m => <option key={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[#e30613] uppercase">AMC Due Date</label>
                  <input type="date" className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-5 py-2 rounded border border-[#e4e2e1] text-[#333333] hover:bg-[#eae8e7] font-bold text-[13px] transition-all">CANCEL</button>
              <button className="bg-[#e30613] text-white px-7 py-2 rounded font-bold text-[13px] hover:opacity-90 shadow-sm transition-all">CREATE TICKET</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
