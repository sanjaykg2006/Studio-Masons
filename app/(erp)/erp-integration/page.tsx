"use client";
import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  category: string;
  desc: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  status: "connected" | "disconnected" | "error" | "syncing";
  lastSync: string | null;
  recordsSynced: number;
  enabled: boolean;
  apiKey: string;
  endpoint: string;
}

interface SyncLog {
  id: string;
  integration: string;
  event: string;
  status: "success" | "failed" | "warning";
  records: number;
  timestamp: string;
  duration: string;
}

interface FieldMap {
  erp_field: string;
  external_field: string;
  integration: string;
  type: string;
  direction: "push" | "pull" | "both";
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive" | "failing";
  lastTriggered: string;
  successRate: number;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const initialIntegrations: Integration[] = [
  {
    id: "tally", name: "Tally Prime", category: "Accounting",
    desc: "Sync purchase orders, vendor invoices, and ledger entries with Tally.",
    icon: "account_balance", iconBg: "#1b1c1c", iconColor: "#ffffff",
    status: "connected", lastSync: "Today, 09:14 AM", recordsSynced: 1284,
    enabled: true, apiKey: "TP-••••••••3f2a", endpoint: "https://tally.studiomasons.in/api",
  },
  {
    id: "zoho", name: "Zoho CRM", category: "Client Management",
    desc: "Push project milestones and pull client details from Zoho CRM.",
    icon: "contacts", iconBg: "#e30613", iconColor: "#ffffff",
    status: "connected", lastSync: "Today, 07:30 AM", recordsSynced: 342,
    enabled: true, apiKey: "ZC-••••••••9d7b", endpoint: "https://crm.zoho.in/api/v2",
  },
  {
    id: "razorpay", name: "Razorpay", category: "Payments",
    desc: "Reconcile payment receipts and vendor disbursements automatically.",
    icon: "payments", iconBg: "#0059a8", iconColor: "#ffffff",
    status: "error", lastSync: "Yesterday, 11:45 PM", recordsSynced: 89,
    enabled: true, apiKey: "RZP-••••••••a1c4", endpoint: "https://api.razorpay.com/v1",
  },
  {
    id: "gdrive", name: "Google Drive", category: "Documents",
    desc: "Auto-upload approved design files and site images to Drive folders.",
    icon: "folder_shared", iconBg: "#16a34a", iconColor: "#ffffff",
    status: "connected", lastSync: "Today, 10:02 AM", recordsSynced: 2031,
    enabled: true, apiKey: "GD-••••••••b8f1", endpoint: "https://www.googleapis.com/drive/v3",
  },
  {
    id: "whatsapp", name: "WhatsApp Business", category: "Communication",
    desc: "Send snag alerts, approval requests, and DPR summaries via WhatsApp.",
    icon: "chat", iconBg: "#25D366", iconColor: "#ffffff",
    status: "disconnected", lastSync: null, recordsSynced: 0,
    enabled: false, apiKey: "", endpoint: "",
  },
  {
    id: "bim360", name: "Autodesk BIM 360", category: "Design",
    desc: "Sync RVT models and CAD drawings bi-directionally with BIM 360.",
    icon: "architecture", iconBg: "#e87722", iconColor: "#ffffff",
    status: "disconnected", lastSync: null, recordsSynced: 0,
    enabled: false, apiKey: "", endpoint: "",
  },
];

const syncLogs: SyncLog[] = [
  { id: "L001", integration: "Tally Prime",        event: "Invoice batch pushed (12 records)",       status: "success", records: 12,  timestamp: "Today, 09:14 AM",       duration: "1.2s" },
  { id: "L002", integration: "Google Drive",       event: "Design files uploaded (7 files)",         status: "success", records: 7,   timestamp: "Today, 10:02 AM",       duration: "4.8s" },
  { id: "L003", integration: "Razorpay",           event: "Payment reconciliation failed",           status: "failed",  records: 0,   timestamp: "Yesterday, 11:45 PM",   duration: "—" },
  { id: "L004", integration: "Zoho CRM",           event: "Client records pulled (5 updates)",       status: "success", records: 5,   timestamp: "Today, 07:30 AM",       duration: "0.9s" },
  { id: "L005", integration: "Tally Prime",        event: "PO sync — 2 items skipped (duplicate)",  status: "warning", records: 18,  timestamp: "Yesterday, 06:00 PM",   duration: "2.1s" },
  { id: "L006", integration: "Google Drive",       event: "Site images synced",                      status: "success", records: 23,  timestamp: "Yesterday, 03:15 PM",   duration: "6.2s" },
  { id: "L007", integration: "Zoho CRM",           event: "Milestone update pushed",                 status: "success", records: 3,   timestamp: "Yesterday, 12:00 PM",   duration: "0.5s" },
  { id: "L008", integration: "Razorpay",           event: "Webhook signature mismatch — retry 1/3", status: "failed",  records: 0,   timestamp: "Yesterday, 11:44 PM",   duration: "—" },
];

const fieldMappings: FieldMap[] = [
  { erp_field: "Invoice ID",       external_field: "invoice_number",     integration: "Tally Prime",  type: "String",  direction: "push" },
  { erp_field: "Vendor Name",      external_field: "party_name",         integration: "Tally Prime",  type: "String",  direction: "push" },
  { erp_field: "Invoice Amount",   external_field: "amount",             integration: "Tally Prime",  type: "Number",  direction: "push" },
  { erp_field: "Due Date",         external_field: "due_date",           integration: "Tally Prime",  type: "Date",    direction: "push" },
  { erp_field: "Client Name",      external_field: "Account_Name",       integration: "Zoho CRM",     type: "String",  direction: "both" },
  { erp_field: "Project Status",   external_field: "Deal_Stage",         integration: "Zoho CRM",     type: "Enum",    direction: "push" },
  { erp_field: "Project Budget",   external_field: "Amount",             integration: "Zoho CRM",     type: "Number",  direction: "pull" },
  { erp_field: "Payment Receipt",  external_field: "payment_id",         integration: "Razorpay",     type: "String",  direction: "pull" },
  { erp_field: "Payment Amount",   external_field: "amount",             integration: "Razorpay",     type: "Number",  direction: "pull" },
  { erp_field: "Design File URL",  external_field: "webViewLink",        integration: "Google Drive",  type: "URL",     direction: "pull" },
];

const webhooks: Webhook[] = [
  { id: "WH001", name: "Invoice Approved",    url: "https://hooks.studiomasons.in/invoice-approved",  events: ["invoice.approved", "invoice.paid"],          status: "active",   lastTriggered: "Today, 09:14 AM",     successRate: 100 },
  { id: "WH002", name: "Snag Raised",         url: "https://hooks.studiomasons.in/snag-created",      events: ["snag.created", "snag.updated"],               status: "active",   lastTriggered: "Yesterday, 04:30 PM", successRate: 97  },
  { id: "WH003", name: "Design Approved",     url: "https://hooks.studiomasons.in/design-approval",   events: ["design.approved"],                            status: "active",   lastTriggered: "2 days ago",          successRate: 100 },
  { id: "WH004", name: "Payment Received",    url: "https://hooks.razorpay.com/studiomasons",         events: ["payment.captured", "payment.failed"],         status: "failing",  lastTriggered: "Yesterday, 11:44 PM", successRate: 43  },
  { id: "WH005", name: "BOQ Milestone",       url: "https://hooks.studiomasons.in/boq-milestone",     events: ["boq.milestone_reached"],                      status: "inactive", lastTriggered: "Never",               successRate: 0   },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const statusStyle: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  connected:    { bg: "rgba(22,163,74,0.08)",  text: "#16a34a", border: "rgba(22,163,74,0.2)",  dot: "#16a34a",  label: "Connected"    },
  disconnected: { bg: "rgba(102,102,102,0.08)", text: "#666666", border: "rgba(102,102,102,0.2)", dot: "#e4e2e1", label: "Disconnected"  },
  error:        { bg: "rgba(186,26,26,0.08)",  text: "#ba1a1a", border: "rgba(186,26,26,0.2)",  dot: "#ba1a1a",  label: "Error"         },
  syncing:      { bg: "rgba(0,89,168,0.08)",   text: "#0059a8", border: "rgba(0,89,168,0.2)",   dot: "#0059a8",  label: "Syncing…"      },
};

const logStyle: Record<string, { bg: string; text: string; icon: string }> = {
  success: { bg: "rgba(22,163,74,0.1)",  text: "#16a34a", icon: "check_circle" },
  failed:  { bg: "rgba(186,26,26,0.1)",  text: "#ba1a1a", icon: "cancel"       },
  warning: { bg: "rgba(234,179,8,0.1)",  text: "#ca8a04", icon: "warning"      },
};

const webhookStatusStyle: Record<string, { bg: string; text: string; border: string }> = {
  active:   { bg: "rgba(22,163,74,0.1)",  text: "#16a34a", border: "rgba(22,163,74,0.25)"  },
  inactive: { bg: "rgba(102,102,102,0.1)", text: "#666666", border: "rgba(102,102,102,0.25)" },
  failing:  { bg: "rgba(186,26,26,0.1)",  text: "#ba1a1a", border: "rgba(186,26,26,0.25)"  },
};

const directionLabel: Record<string, { icon: string; text: string }> = {
  push: { icon: "upload",   text: "Push → ERP"   },
  pull: { icon: "download", text: "Pull ← ERP"   },
  both: { icon: "sync",     text: "Bi-directional" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ERPIntegrationPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<{ apiKey: string; endpoint: string }>({ apiKey: "", endpoint: "" });
  const [logs, setLogs] = useState<SyncLog[]>(syncLogs);
  const [webhookList, setWebhookList] = useState<Webhook[]>(webhooks);
  const [newWebhookOpen, setNewWebhookOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookName, setNewWebhookName] = useState("");
  const [filterIntegration, setFilterIntegration] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterMapping, setFilterMapping] = useState("All");

  const tabs = ["Integrations", "Sync Logs", "Field Mapping", "Webhooks"];

  const connected    = integrations.filter(i => i.status === "connected").length;
  const errors       = integrations.filter(i => i.status === "error").length;
  const totalSynced  = integrations.reduce((a, b) => a + b.recordsSynced, 0);
  const lastSyncTime = "Today, 10:02 AM";

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleToggle = (id: string) => {
    setIntegrations(prev => prev.map(i => {
      if (i.id !== id) return i;
      const nowEnabled = !i.enabled;
      return { ...i, enabled: nowEnabled, status: nowEnabled ? "disconnected" : "disconnected" };
    }));
  };

  const handleSyncNow = (id: string) => {
    setSyncingId(id);
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: "syncing" } : i));
    setTimeout(() => {
      setSyncingId(null);
      setIntegrations(prev => prev.map(i => {
        if (i.id !== id) return i;
        const now = "Just now";
        const newLog: SyncLog = {
          id: `L${Date.now()}`,
          integration: i.name,
          event: "Manual sync triggered",
          status: "success",
          records: Math.floor(Math.random() * 20) + 1,
          timestamp: now,
          duration: `${(Math.random() * 3 + 0.5).toFixed(1)}s`,
        };
        setLogs(prev => [newLog, ...prev]);
        return { ...i, status: "connected", lastSync: now, recordsSynced: i.recordsSynced + newLog.records };
      }));
    }, 2400);
  };

  const handleOpenConfig = (integration: Integration) => {
    setConfigDraft({ apiKey: integration.apiKey, endpoint: integration.endpoint });
    setConfigOpen(integration.id);
  };

  const handleSaveConfig = () => {
    setIntegrations(prev => prev.map(i => {
      if (i.id !== configOpen) return i;
      const hasConfig = configDraft.apiKey.trim() && configDraft.endpoint.trim();
      return { ...i, apiKey: configDraft.apiKey, endpoint: configDraft.endpoint, status: hasConfig ? "connected" : "disconnected", enabled: !!hasConfig };
    }));
    setConfigOpen(null);
  };

  const handleToggleWebhook = (id: string) => {
    setWebhookList(prev => prev.map(w => {
      if (w.id !== id) return w;
      return { ...w, status: w.status === "active" ? "inactive" : "active" };
    }));
  };

  const handleAddWebhook = () => {
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) return;
    const newWh: Webhook = {
      id: `WH${Date.now()}`,
      name: newWebhookName,
      url: newWebhookUrl,
      events: ["custom.event"],
      status: "active",
      lastTriggered: "Never",
      successRate: 0,
    };
    setWebhookList(prev => [newWh, ...prev]);
    setNewWebhookName("");
    setNewWebhookUrl("");
    setNewWebhookOpen(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredLogs = logs.filter(l => {
    const matchInt = filterIntegration === "All" || l.integration === filterIntegration;
    const matchSt  = filterStatus      === "All" || l.status       === filterStatus;
    return matchInt && matchSt;
  });

  const filteredMappings = fieldMappings.filter(m =>
    filterMapping === "All" || m.integration === filterMapping
  );

  const configTarget = integrations.find(i => i.id === configOpen);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <span>Dashboard</span>
        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
        <span className="text-[#e30613]">ERP Integration</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">ERP Integration</h2>
          <p className="text-[#666666]">Connect Studio Masons ERP to your external tools, accounting systems, and communication platforms.</p>
        </div>
        <button
          onClick={() => { setActiveTab(0); }}
          className="bg-[#e30613] text-white px-6 py-2.5 rounded font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all text-[14px]">
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_circle</span>
          ADD INTEGRATION
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Connected",     value: String(connected),                  icon: "link",           color: "#16a34a", sub: `of ${integrations.length} total` },
          { label: "Last Sync",     value: lastSyncTime,                       icon: "sync",           color: "#e30613", sub: "Google Drive" },
          { label: "Records Synced",value: totalSynced.toLocaleString(),       icon: "database",       color: "#0059a8", sub: "all time" },
          { label: "Active Errors", value: String(errors),                     icon: "error",          color: errors > 0 ? "#ba1a1a" : "#16a34a", sub: errors > 0 ? "needs attention" : "all clear" },
        ].map((k, i) => (
          <div key={i} className="bg-[#f8f8f8] border border-[#e4e2e1] p-6 shadow-sm relative overflow-hidden" style={{ borderLeft: `3px solid ${k.color}` }}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">{k.label}</span>
              <span className="material-symbols-outlined" style={{ color: k.color, fontSize: "22px" }}>{k.icon}</span>
            </div>
            <div className="text-[28px] font-bold text-[#333333] leading-none mb-1">{k.value}</div>
            <div className="text-[11px] text-[#666666]">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-[#e4e2e1] mb-8">
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`pb-4 border-b-2 text-[14px] font-bold transition-all ${activeTab === i ? "border-[#e30613] text-[#e30613]" : "border-transparent text-[#666666] hover:text-[#333333]"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Integrations ─────────────────────────────────────────────── */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {integrations.map((intg) => {
            const st = statusStyle[intg.status];
            const isSyncing = syncingId === intg.id;
            return (
              <div key={intg.id}
                className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm flex flex-col"
                style={{ borderTop: `3px solid ${intg.status === "connected" ? "#16a34a" : intg.status === "error" ? "#ba1a1a" : "#e4e2e1"}` }}>
                {/* Card Header */}
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: intg.iconBg }}>
                      <span className="material-symbols-outlined" style={{ color: intg.iconColor, fontSize: "22px" }}>{intg.icon}</span>
                    </div>
                    <div>
                      <p className="font-bold text-[#333333] text-[15px] leading-tight">{intg.name}</p>
                      <p className="text-[10px] font-bold uppercase text-[#666666] mt-0.5">{intg.category}</p>
                    </div>
                  </div>
                  {/* Toggle */}
                  <button onClick={() => handleToggle(intg.id)}
                    style={{ width: "44px", height: "24px", borderRadius: "12px", background: intg.enabled ? "#e30613" : "#e4e2e1", position: "relative", border: "none", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
                    <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", left: intg.enabled ? "23px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
                  </button>
                </div>

                {/* Description */}
                <p className="px-5 text-[13px] text-[#666666] leading-relaxed flex-1">{intg.desc}</p>

                {/* Status Row */}
                <div className="px-5 py-4 flex items-center justify-between">
                  <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", background: st.bg, color: st.text, border: `1px solid ${st.border}`, display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isSyncing ? "#0059a8" : st.dot, display: "inline-block", animation: isSyncing ? "pulse 1s infinite" : "none" }} />
                    {isSyncing ? "Syncing…" : st.label}
                  </span>
                  {intg.lastSync && (
                    <span className="text-[10px] text-[#666666]">Last: {intg.lastSync}</span>
                  )}
                </div>

                {/* Stats */}
                {intg.recordsSynced > 0 && (
                  <div className="px-5 pb-4">
                    <div className="bg-[#f8f8f8] rounded-lg p-3 flex items-center justify-between">
                      <span className="text-[10px] text-[#666666] font-bold uppercase">Records Synced</span>
                      <span className="text-[14px] font-bold text-[#333333]">{intg.recordsSynced.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {intg.status === "error" && (
                  <div className="mx-5 mb-4 px-4 py-3 bg-[#ba1a1a]/5 border border-[#ba1a1a]/20 rounded-lg flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#ba1a1a]" style={{ fontSize: "18px" }}>error</span>
                    <div>
                      <p className="text-[12px] font-bold text-[#ba1a1a]">Webhook signature mismatch</p>
                      <p className="text-[11px] text-[#666666] mt-0.5">Check API key or contact support</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-[#e4e2e1] px-5 py-3 flex gap-3 bg-[#f8f8f8]">
                  {intg.status === "connected" || intg.status === "error" ? (
                    <button onClick={() => handleSyncNow(intg.id)} disabled={isSyncing}
                      className="flex-1 py-2 rounded text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all"
                      style={{ background: isSyncing ? "#e4e2e1" : "#e30613", color: isSyncing ? "#666666" : "white", cursor: isSyncing ? "not-allowed" : "pointer" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", animation: isSyncing ? "spin 1s linear infinite" : "none" }}>sync</span>
                      {isSyncing ? "SYNCING…" : "SYNC NOW"}
                    </button>
                  ) : (
                    <button onClick={() => handleOpenConfig(intg)}
                      className="flex-1 py-2 rounded text-[12px] font-bold flex items-center justify-center gap-1.5 bg-[#e30613] text-white hover:opacity-90 transition-all">
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>link</span>
                      CONNECT
                    </button>
                  )}
                  <button onClick={() => handleOpenConfig(intg)}
                    className="px-4 py-2 rounded border border-[#e4e2e1] text-[12px] font-bold text-[#333333] hover:bg-white transition-all flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>settings</span>
                    CONFIG
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 1: Sync Logs ────────────────────────────────────────────────── */}
      {activeTab === 1 && (
        <div>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-[#666666]">Integration</label>
              <select value={filterIntegration} onChange={e => setFilterIntegration(e.target.value)}
                className="bg-white border border-[#e4e2e1] rounded px-3 py-2 text-[13px] focus:outline-none focus:border-[#e30613]">
                <option>All</option>
                {[...new Set(logs.map(l => l.integration))].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-[#666666]">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="bg-white border border-[#e4e2e1] rounded px-3 py-2 text-[13px] focus:outline-none focus:border-[#e30613]">
                <option>All</option>
                <option>success</option>
                <option>failed</option>
                <option>warning</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => { setFilterIntegration("All"); setFilterStatus("All"); }}
                className="px-4 py-2 border border-[#e4e2e1] rounded text-[12px] font-bold text-[#666666] hover:bg-[#f8f8f8] transition-all">
                CLEAR FILTERS
              </button>
            </div>
            <div className="flex items-end ml-auto">
              <span className="text-[12px] text-[#666666]">{filteredLogs.length} events</span>
            </div>
          </div>

          <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
                  {["Status", "Integration", "Event", "Records", "Duration", "Timestamp"].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e2e1]">
                {filteredLogs.map((log) => {
                  const ls = logStyle[log.status];
                  return (
                    <tr key={log.id} className="hover:bg-[#f8f8f8] transition-colors">
                      <td className="px-6 py-4">
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", background: ls.bg, color: ls.text, width: "fit-content" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>{ls.icon}</span>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[14px] font-medium text-[#333333]">{log.integration}</td>
                      <td className="px-6 py-4 text-[13px] text-[#666666]">{log.event}</td>
                      <td className="px-6 py-4 text-[14px] text-[#333333] font-bold">{log.records > 0 ? log.records : "—"}</td>
                      <td className="px-6 py-4 text-[13px] text-[#666666]">{log.duration}</td>
                      <td className="px-6 py-4 text-[12px] text-[#666666]">{log.timestamp}</td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-[#666666] text-[14px]">No logs match the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Field Mapping ─────────────────────────────────────────────── */}
      {activeTab === 2 && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-[#666666]">Filter by Integration</label>
              <select value={filterMapping} onChange={e => setFilterMapping(e.target.value)}
                className="bg-white border border-[#e4e2e1] rounded px-3 py-2 text-[13px] focus:outline-none focus:border-[#e30613]">
                <option>All</option>
                {[...new Set(fieldMappings.map(m => m.integration))].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-end ml-auto">
              <span className="text-[12px] text-[#666666]">{filteredMappings.length} mappings</span>
            </div>
          </div>

          <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex items-center gap-3">
              <div className="w-1 h-5 bg-[#e30613]" />
              <h3 className="text-[16px] font-medium text-[#333333]">Field Mapping Configuration</h3>
              <span className="text-[11px] text-[#666666] ml-2">Studio Masons ERP ↔ External Systems</span>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
                  {["ERP Field", "Direction", "External Field", "Integration", "Data Type"].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e2e1]">
                {filteredMappings.map((m, i) => {
                  const dir = directionLabel[m.direction];
                  return (
                    <tr key={i} className="hover:bg-[#f8f8f8] transition-colors">
                      <td className="px-6 py-4">
                        <code className="text-[13px] font-bold text-[#333333] bg-[#f8f8f8] px-2 py-0.5 rounded border border-[#e4e2e1]">{m.erp_field}</code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#e30613]">
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{dir.icon}</span>
                          {dir.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-[13px] text-[#0059a8] bg-[#0059a8]/5 px-2 py-0.5 rounded border border-[#0059a8]/15">{m.external_field}</code>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#333333]">{m.integration}</td>
                      <td className="px-6 py-4">
                        <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", background: "#f8f8f8", border: "1px solid #e4e2e1", color: "#666666" }}>{m.type}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Webhooks ──────────────────────────────────────────────────── */}
      {activeTab === 3 && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <p className="text-[#666666] text-[14px]">{webhookList.length} webhooks configured</p>
            <button onClick={() => setNewWebhookOpen(true)}
              className="bg-[#e30613] text-white px-5 py-2 rounded font-bold text-[13px] flex items-center gap-2 hover:opacity-90 shadow-sm transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
              NEW WEBHOOK
            </button>
          </div>

          <div className="space-y-4">
            {webhookList.map((wh) => {
              const ws = webhookStatusStyle[wh.status];
              return (
                <div key={wh.id} className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-bold text-[#333333] text-[15px]">{wh.name}</p>
                        <span style={{ padding: "2px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "bold", background: ws.bg, color: ws.text, border: `1px solid ${ws.border}` }}>
                          {wh.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#0059a8] font-mono truncate mb-3">{wh.url}</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {wh.events.map(ev => (
                          <span key={ev} className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f8f8f8] border border-[#e4e2e1] text-[#666666]">{ev}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-6">
                        <span className="text-[11px] text-[#666666]">Last triggered: <strong>{wh.lastTriggered}</strong></span>
                        <span className="text-[11px] text-[#666666]">
                          Success rate:&nbsp;
                          <strong style={{ color: wh.successRate >= 90 ? "#16a34a" : wh.successRate >= 60 ? "#ca8a04" : "#ba1a1a" }}>
                            {wh.successRate}%
                          </strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <button onClick={() => handleToggleWebhook(wh.id)}
                        style={{ width: "44px", height: "24px", borderRadius: "12px", background: wh.status === "active" ? "#e30613" : "#e4e2e1", position: "relative", border: "none", cursor: "pointer", transition: "background 0.2s" }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", left: wh.status === "active" ? "23px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </button>
                      {wh.status === "failing" && (
                        <span className="text-[10px] font-bold text-[#ba1a1a] flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>error</span>
                          Check endpoint
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar for success rate */}
                  {wh.successRate > 0 && (
                    <div className="px-5 pb-4">
                      <div className="h-1.5 w-full bg-[#e4e2e1] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${wh.successRate}%`, background: wh.successRate >= 90 ? "#16a34a" : wh.successRate >= 60 ? "#ca8a04" : "#ba1a1a" }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Config Modal ─────────────────────────────────────────────────────── */}
      {configOpen && configTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-[#e4e2e1] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: configTarget.iconBg }}>
                  <span className="material-symbols-outlined" style={{ color: configTarget.iconColor, fontSize: "18px" }}>{configTarget.icon}</span>
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-[#333333]">{configTarget.name}</h3>
                  <p className="text-[10px] text-[#666666] uppercase">{configTarget.category}</p>
                </div>
              </div>
              <button onClick={() => setConfigOpen(null)} className="text-[#666666] hover:text-[#e30613] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">API Endpoint</label>
                <input value={configDraft.endpoint} onChange={e => setConfigDraft(d => ({ ...d, endpoint: e.target.value }))}
                  placeholder="https://api.example.com/v1" className="bg-white border border-[#e4e2e1] rounded p-3 text-[14px] focus:outline-none focus:border-[#e30613] transition-all font-mono" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">API Key / Secret</label>
                <input value={configDraft.apiKey} onChange={e => setConfigDraft(d => ({ ...d, apiKey: e.target.value }))}
                  type="password" placeholder="Paste your API key here" className="bg-white border border-[#e4e2e1] rounded p-3 text-[14px] focus:outline-none focus:border-[#e30613] transition-all font-mono" />
              </div>
              <div className="bg-[#f8f8f8] border border-[#e4e2e1] rounded-lg p-4">
                <p className="text-[11px] font-bold text-[#666666] uppercase mb-2">Sync Direction</p>
                <div className="flex gap-3">
                  {["Push only", "Pull only", "Bi-directional"].map((d, i) => (
                    <button key={i} className={`flex-1 py-2 rounded text-[11px] font-bold border transition-all ${i === 2 ? "border-[#e30613] text-[#e30613] bg-[#e30613]/5" : "border-[#e4e2e1] text-[#666666] hover:border-[#e30613]/40"}`}>{d}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex gap-3 justify-end">
              <button onClick={() => setConfigOpen(null)} className="px-5 py-2 border border-[#e4e2e1] rounded text-[13px] font-bold text-[#333333] hover:bg-white transition-all">CANCEL</button>
              <button onClick={handleSaveConfig} className="px-6 py-2 bg-[#e30613] text-white rounded text-[13px] font-bold hover:opacity-90 shadow-sm transition-all">SAVE & CONNECT</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Webhook Modal ─────────────────────────────────────────────────── */}
      {newWebhookOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-[#e4e2e1] w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex justify-between items-center">
              <h3 className="text-[18px] font-bold text-[#333333]">New Webhook</h3>
              <button onClick={() => setNewWebhookOpen(false)} className="text-[#666666] hover:text-[#e30613] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Webhook Name</label>
                <input value={newWebhookName} onChange={e => setNewWebhookName(e.target.value)}
                  placeholder="e.g. Invoice Approved" className="bg-white border border-[#e4e2e1] rounded p-3 text-[14px] focus:outline-none focus:border-[#e30613] transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Target URL</label>
                <input value={newWebhookUrl} onChange={e => setNewWebhookUrl(e.target.value)}
                  placeholder="https://your-endpoint.com/hook" className="bg-white border border-[#e4e2e1] rounded p-3 text-[14px] focus:outline-none focus:border-[#e30613] transition-all font-mono" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex gap-3 justify-end">
              <button onClick={() => setNewWebhookOpen(false)} className="px-5 py-2 border border-[#e4e2e1] rounded text-[13px] font-bold text-[#333333] hover:bg-white transition-all">CANCEL</button>
              <button onClick={handleAddWebhook}
                className="px-6 py-2 bg-[#e30613] text-white rounded text-[13px] font-bold hover:opacity-90 shadow-sm transition-all"
                style={{ opacity: !newWebhookName.trim() || !newWebhookUrl.trim() ? 0.5 : 1 }}>
                CREATE WEBHOOK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
