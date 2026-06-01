"use client";
import { useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";

const allInvoices = [
  { id: "SM-INV-4902", vendor: "Blackwood Stonemasons Ltd.", project: "Indiranagar Residence", amount: "₹14,250.00", due: "Oct 24, 2023", status: "Pending", statusStyle: "bg-primary/10 text-primary border-primary/20", amountStyle: "text-primary font-medium" },
  { id: "SM-INV-4899", vendor: "Imperial Steel Works", project: "Whitefield Office", amount: "₹8,900.00", due: "Oct 22, 2023", status: "Paid", statusStyle: "bg-secondary-container/50 text-secondary border-surface-container-highest", amountStyle: "" },
  { id: "SM-INV-4885", vendor: "Glass & Light Studios", project: "Koramangala Villa", amount: "₹11,420.00", due: "Oct 15, 2023", status: "Overdue", statusStyle: "bg-error/10 text-error border-error/20", amountStyle: "text-error" },
  { id: "SM-INV-4872", vendor: "Oak & Grain Joinery", project: "Indiranagar Residence", amount: "₹6,750.00", due: "Oct 12, 2023", status: "Paid", statusStyle: "bg-secondary-container/50 text-secondary border-surface-container-highest", amountStyle: "" },
  { id: "SM-INV-4850", vendor: "Elite Electrical Solutions", project: "HSR Layout G+3", amount: "₹4,300.00", due: "Oct 08, 2023", status: "Paid", statusStyle: "bg-secondary-container/50 text-secondary border-surface-container-highest", amountStyle: "" },
];

const tabs = ["Vendor Invoices", "Vendor Payment Requests", "Site Expense Tracking", "Vendor Scope & Progress"];

export default function OrdersPage() {
  const { selectedProject } = useProject();
  const [activeTab, setActiveTab] = useState(0);
  const [slideOpen, setSlideOpen] = useState(false);

  // Filter invoices by selected project
  const invoices = selectedProject
    ? allInvoices.filter(inv => inv.project === selectedProject.name)
    : allInvoices;

  return (
    <div className="relative">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-8 text-[#666666] text-[14px] font-bold uppercase tracking-wider">
        <span>Dashboard</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-primary">Orders & Expense</span>
      </nav>
      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Financial Oversight</h2>
          <p className="text-[18px] text-[#666666] max-w-xl">
            {selectedProject ? (
              <>Procurement and expenses for <span className="font-bold text-[#333333]">{selectedProject.name}</span></>
            ) : (
              "Centralized management of procurement, vendor obligations, and real-time site expenditure tracking."
            )}
          </p>
        </div>
        <div className="flex gap-4">
          <button className="border border-surface-container-highest px-6 py-2 rounded-lg text-[#333333] text-[14px] font-bold hover:bg-surface-container-high transition-all">Export Report</button>
          <button className="bg-primary text-white px-6 py-2 rounded-lg text-[14px] font-bold hover:opacity-90 shadow-md transition-all">+ New Request</button>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-8 border-b border-surface-container-highest mb-8">
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`pb-4 border-b-2 text-[14px] font-bold transition-all ${activeTab === i ? "border-primary text-primary" : "border-transparent text-[#666666] hover:text-[#333333]"}`}>
            {t}
          </button>
        ))}
      </div>
      {/* Filters */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Date Range", value: "Last 30 Days", icon: "calendar_today" },
          { label: "Vendor", value: "All Vendors", icon: "filter_list" },
          { label: "Project", value: selectedProject ? selectedProject.name : "All Projects", icon: "apartment" },
          { label: "Search ID", value: "SM-INV-...", icon: null },
        ].map((f, i) => (
          <div key={i} className={`bg-white border p-3 rounded-lg flex items-center justify-between shadow-sm ${i === 2 && selectedProject ? "border-primary/30 bg-primary/5" : "border-surface-container-high"}`}>
            <span className="text-[10px] font-bold uppercase text-[#666666]">{f.label}</span>
            <span className={`text-[16px] font-medium truncate max-w-[120px] ${i === 2 && selectedProject ? "text-primary" : "text-[#333333]"}`}>{f.value}</span>
            {f.icon && <span className="material-symbols-outlined text-[18px] text-primary">{f.icon}</span>}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-[#f8f8f8] border border-[#e4e2e1] rounded-xl">
          <div className="w-20 h-20 rounded-full bg-white border border-[#e4e2e1] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-[#e4e2e1]">receipt_long</span>
          </div>
          <h3 className="text-[20px] font-bold text-[#333333] mb-2">No Invoices Found</h3>
          <p className="text-[16px] text-[#666666] w-full max-w-md">No invoices match the selected project <span className="font-bold text-[#e30613]">{selectedProject?.name}</span>.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white border border-surface-container-high rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f8f8] border-b border-surface-container-highest">
                  {["Invoice ID", "Vendor", "Project", "Amount", "Due Date", "Status", "Actions"].map((h, i) => (
                    <th key={h} className={`px-6 py-4 text-[12px] font-bold uppercase tracking-widest text-[#666666] ${i === 3 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={i}
                    onClick={() => setSlideOpen(true)}
                    className={`border-b border-surface-container-highest/30 hover:bg-[#f8f8f8] transition-colors cursor-pointer ${i === 0 ? "bg-[#f8f8f8] border-l-4 border-l-primary" : "bg-white"}`}>
                    <td className={`px-6 py-4 ${i === 0 ? "font-bold" : ""}`}>{inv.id}</td>
                    <td className="px-6 py-4">{inv.vendor}</td>
                    <td className="px-6 py-4">{inv.project}</td>
                    <td className={`px-6 py-4 text-right ${inv.amountStyle}`}>{inv.amount}</td>
                    <td className={`px-6 py-4 ${inv.status === "Overdue" ? "text-error" : ""}`}>{inv.due}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${inv.statusStyle}`}>{inv.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-[#666666]">
                      <span className="material-symbols-outlined">more_vert</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-6 bg-[#f8f8f8] flex justify-between items-center text-[14px]">
              <span className="text-[#666666]">Showing {invoices.length} of {allInvoices.length} invoices</span>
              <div className="flex gap-2">
                <button className="p-2 border border-surface-container-highest rounded bg-white hover:bg-surface-container-high"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                <button className="w-8 h-8 flex items-center justify-center rounded font-bold bg-primary text-white shadow-sm">1</button>
                <button className="p-2 border border-surface-container-highest rounded bg-white hover:bg-surface-container-high"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Slide-over */}
      <div className={`fixed right-0 top-0 h-full w-[450px] bg-white border-l border-surface-container-highest z-[60] transition-transform duration-500 ease-in-out shadow-2xl ${slideOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="h-full flex flex-col p-8">
          <div className="absolute left-0 top-12 w-1.5 h-16 bg-primary" />
          <div className="flex justify-between items-start mb-10">
            <div>
              <span className="text-[14px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">Invoice Details</span>
              <h3 className="text-[24px] font-bold text-[#333333]">SM-INV-4902</h3>
            </div>
            <button onClick={() => setSlideOpen(false)} className="text-[#666666] hover:text-primary transition-all">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2">
            <section>
              <h4 className="text-[10px] font-bold text-[#666666] uppercase mb-4 tracking-wider">Vendor Information</h4>
              <div className="bg-[#f8f8f8] p-4 rounded-lg border border-surface-container-highest">
                <p className="font-bold text-[#333333]">Blackwood Stonemasons Ltd.</p>
                <p className="text-[16px] text-[#666666] mt-1">VAT: GB123456789</p>
                <p className="text-[16px] text-[#666666]">12 Industrial Pkwy, London</p>
              </div>
            </section>
            <section>
              <h4 className="text-[10px] font-bold text-[#666666] uppercase mb-4 tracking-wider">Financial Breakdown</h4>
              <div className="space-y-3">
                {[["Base Material Cost", "₹11,200.00"], ["Logistics & Handling", "₹650.00"], ["VAT (20%)", "₹2,400.00"]].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-[16px]">
                    <span className="text-[#666666]">{l}</span><span>{v}</span>
                  </div>
                ))}
                <div className="border-t border-surface-container-highest pt-3 flex justify-between text-[20px] font-bold">
                  <span className="text-[#333333]">Total Amount</span>
                  <span className="text-primary">₹14,250.00</span>
                </div>
              </div>
            </section>
          </div>
          <div className="pt-8 border-t border-surface-container-highest flex gap-4">
            <button className="flex-1 border border-surface-container-highest py-3 rounded-lg text-[#333333] text-[14px] font-bold hover:bg-surface-container-high transition-all">Flag Invoice</button>
            <button className="flex-[2] bg-primary text-white py-3 rounded-lg text-[14px] font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">verified_user</span> Approve Payment
            </button>
          </div>
        </div>
      </div>
      {slideOpen && <div onClick={() => setSlideOpen(false)} className="fixed inset-0 bg-black/20 z-[55]" />}
    </div>
  );
}
