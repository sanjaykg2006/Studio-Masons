"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import { inviteUser, getMyProfile, listTeam, createInviteLink, updateRole, removeMember, uploadAvatar, removeAvatar, type Profile, type TeamMember } from "./actions";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/app/generated/prisma";

const tabs = ["Profile", "Team & Roles", "Notifications", "ERP Connection", "Appearance"];

// Maps the UI role labels to the Prisma Role enum values.
const roleEnum: Record<string, string> = {
  "Admin": "ADMIN",
  "Project Manager": "PROJECT_MANAGER",
  "Designer": "DESIGNER",
  "Site Engineer": "SITE_ENGINEER",
  "Finance": "FINANCE",
  "Client": "CLIENT",
};

// Reverse of roleEnum: Prisma Role enum value -> display label.
const roleLabel: Record<string, string> = Object.fromEntries(
  Object.entries(roleEnum).map(([label, value]) => [value, label])
);

function initials(value: string) {
  const parts = value.replace(/@.*/, "").split(/[ .]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const roles = ["Admin", "Project Manager", "Designer", "Site Engineer", "Finance", "Client"];

const notifications = [
  { label: "New snag raised", desc: "Get notified when a snag is raised on your project", email: true, inApp: true },
  { label: "Design approval required", desc: "When a design file needs your review", email: true, inApp: true },
  { label: "Invoice pending approval", desc: "Vendor invoices awaiting sign-off", email: false, inApp: true },
  { label: "ERP sync completed", desc: "When scope data is successfully synced to ERP", email: false, inApp: true },
  { label: "AMC due reminder", desc: "7 days before an AMC service is due", email: true, inApp: false },
  { label: "Project milestone reached", desc: "When BOQ completion crosses a threshold", email: true, inApp: true },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [notifs, setNotifs] = useState(notifications);
  const [erpConnected, setErpConnected] = useState(false);
  const [erpUrl, setErpUrl] = useState("");
  const [erpKey, setErpKey] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviting, startInvite] = useTransition();

  const [me, setMe] = useState<Profile | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [meError, setMeError] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then(setMe)
      .catch(() => setMeError(true))
      .finally(() => setMeLoaded(true));
    listTeam().then(setTeam).catch(() => setTeam([]));
  }, []);

  function handleInvite(formData: FormData) {
    setInviteMsg(null);
    startInvite(async () => {
      const res = await inviteUser(formData);
      if (res.ok) {
        setInviteMsg({ ok: true, text: "Invitation email sent." });
        setShowInvite(false);
        listTeam().then(setTeam);
      } else {
        setInviteMsg({ ok: false, text: res.error });
      }
    });
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard blocked — nothing else to do.
    }
  }

  function handleRoleChange(id: string, label: string) {
    const role = roleEnum[label];
    if (!role) return;
    setRowBusy(id);
    updateRole(id, role as Role).then((r) => {
      if (r.ok) setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
      else setInviteMsg({ ok: false, text: r.error });
    }).finally(() => setRowBusy(null));
  }

  function handleCopyMemberLink(id: string) {
    setMenuFor(null);
    setRowBusy(id);
    createInviteLink(id).then((r) => {
      if (r.ok) {
        copyLink(r.link);
        setInviteMsg({ ok: true, text: "Registration link copied to clipboard." });
      } else {
        setInviteMsg({ ok: false, text: r.error });
      }
    }).finally(() => setRowBusy(null));
  }

  function handleRemove(id: string) {
    setMenuFor(null);
    if (!confirm("Remove this member from the workspace? They will lose access.")) return;
    setRowBusy(id);
    removeMember(id).then((r) => {
      if (r.ok) setTeam((prev) => prev.filter((m) => m.id !== id));
      else setInviteMsg({ ok: false, text: r.error });
    }).finally(() => setRowBusy(null));
  }

  const toggleNotif = (i: number, type: "email" | "inApp") => {
    setNotifs(prev => prev.map((n, idx) => idx !== i ? n : { ...n, [type === "email" ? "email" : "inApp"]: !n[type === "email" ? "email" : "inApp"] }));
  };

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setAvatarBusy(true);
    uploadAvatar(fd).then((r) => {
      if (r.ok) setMe((prev) => (prev ? { ...prev, avatarUrl: r.url } : prev));
      else alert(r.error);
    }).finally(() => setAvatarBusy(false));
  }

  function onRemovePhoto() {
    if (!me?.avatarUrl) return;
    setAvatarBusy(true);
    removeAvatar().then((r) => {
      if (r.ok) setMe((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
    }).finally(() => setAvatarBusy(false));
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwOk(false);
    if (!me) return;
    if (newPw.length < 8) { setPwErr("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwErr("New passwords do not match."); return; }

    setPwBusy(true);
    const supabase = createClient();
    // Re-authenticate to confirm the current password before changing it.
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: me.email, password: curPw });
    if (authErr) { setPwErr("Current password is incorrect."); setPwBusy(false); return; }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) { setPwErr(error.message); return; }

    setPwOk(true);
    setCurPw(""); setNewPw(""); setConfirmPw("");
  }

  return (
    <div>
      <nav className="flex items-center gap-2 mb-4 text-[#666666] text-[10px] font-bold uppercase tracking-widest">
        <span>Dashboard</span>
        <span className="material-symbols-outlined" style={{fontSize:"12px"}}>chevron_right</span>
        <span className="text-[#e30613]">Settings</span>
      </nav>

      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[32px] font-bold text-[#333333] mb-2">Settings</h2>
          <p className="text-[#666666]">Manage your account, team, integrations, and preferences.</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-8 border-b border-[#e4e2e1] mb-8">
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`pb-4 border-b-2 text-[14px] font-bold transition-all ${activeTab === i ? "border-[#e30613] text-[#e30613]" : "border-transparent text-[#666666] hover:text-[#333333]"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 0 && (
        <div className="max-w-2xl">
          <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex items-center gap-2">
              <div className="w-1 h-5 bg-[#e30613]" />
              <h3 className="text-[18px] font-medium text-[#333333]">Personal Information</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-6 mb-6">
                <div style={{width:"72px",height:"72px",borderRadius:"50%",background:"#e30613",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",fontWeight:"bold",color:"white",flexShrink:0,overflow:"hidden"}}>
                  {me?.avatarUrl
                    ? <img src={me.avatarUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                    : (me ? initials(me.name || me.email) : "—")}
                </div>
                <div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                  <button onClick={() => fileRef.current?.click()} disabled={avatarBusy || !me} className="px-4 py-2 border border-[#e4e2e1] rounded text-[13px] font-bold text-[#333333] hover:bg-[#f8f8f8] transition-all mr-3 disabled:opacity-50">{avatarBusy ? "Uploading…" : "Change Photo"}</button>
                  <button onClick={onRemovePhoto} disabled={avatarBusy || !me?.avatarUrl} className="px-4 py-2 text-[13px] font-bold text-[#ba1a1a] hover:underline disabled:opacity-40 disabled:no-underline">Remove</button>
                </div>
              </div>
              {me ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-[#e30613] uppercase">Full Name</label>
                    <input defaultValue={me.name} type="text" className="bg-white border border-[#e4e2e1] rounded p-3 text-[15px] focus:outline-none focus:border-[#e30613] transition-all" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-[#e30613] uppercase">Email</label>
                    <input value={me.email} type="email" readOnly className="bg-[#f8f8f8] border border-[#e4e2e1] rounded p-3 text-[15px] text-[#666666] focus:outline-none cursor-not-allowed" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-[#e30613] uppercase">Role</label>
                    <input value={roleLabel[me.role] ?? me.role} type="text" readOnly className="bg-[#f8f8f8] border border-[#e4e2e1] rounded p-3 text-[15px] text-[#666666] focus:outline-none cursor-not-allowed" />
                  </div>
                </>
              ) : !meLoaded ? (
                <p className="text-[#666666] text-[14px]">Loading your profile…</p>
              ) : meError ? (
                <p className="text-[#ba1a1a] text-[14px]">
                  Couldn’t load your profile — the server hit an error (often a stale or missing DATABASE_URL). Restart the dev server and check its logs.
                </p>
              ) : (
                <p className="text-[#ba1a1a] text-[14px]">
                  No profile is linked to your account. Ask an admin to invite your email, or ensure a User row exists for it.
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-end">
              <button className="bg-[#e30613] text-white px-6 py-2 rounded font-bold text-[14px] hover:opacity-90 shadow-sm transition-all">SAVE CHANGES</button>
            </div>
          </div>
          <div className="bg-white border border-[#ba1a1a]/20 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#ba1a1a]/20 bg-[#ba1a1a]/5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
              <h3 className="text-[18px] font-medium text-[#ba1a1a]">Danger Zone</h3>
            </div>
            <div className="p-6 flex justify-between items-center">
              <div>
                <p className="font-bold text-[#333333]">Change Password</p>
                <p className="text-[#666666] text-[13px]">Update your account password</p>
              </div>
              <button onClick={() => { setPwErr(null); setPwOk(false); setCurPw(""); setNewPw(""); setConfirmPw(""); setShowPw(true); }} className="px-4 py-2 border border-[#ba1a1a]/40 rounded text-[#ba1a1a] text-[13px] font-bold hover:bg-[#ba1a1a]/10 transition-all">CHANGE</button>
            </div>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 1 && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <p className="text-[#666666]">{team.length} member{team.length !== 1 ? "s" : ""} in your workspace</p>
            <button onClick={() => { setInviteMsg(null); setShowInvite(true); }} className="bg-[#e30613] text-white px-5 py-2 rounded font-bold text-[13px] flex items-center gap-2 hover:opacity-90 shadow-sm">
              <span className="material-symbols-outlined" style={{fontSize:"18px"}}>person_add</span> INVITE MEMBER
            </button>
          </div>
          {inviteMsg && (
            <div className={`mb-6 text-[13px] rounded p-3 border ${inviteMsg.ok ? "bg-green-500/10 border-green-500/20 text-green-700" : "bg-[#e30613]/10 border-[#e30613]/20 text-[#ba1a1a]"}`}>
              {inviteMsg.text}
            </div>
          )}
          <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f8f8f8] border-b border-[#e4e2e1]">
                  {["Member", "Email", "Role", "Status", "Actions"].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#666666]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e2e1]">
                {team.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-[#666666] text-[14px]">No team members yet. Use “Invite Member” to add someone.</td></tr>
                )}
                {team.map((m) => (
                  <tr key={m.id} className="hover:bg-[#f8f8f8] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"#e30613",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"bold",color:"white",flexShrink:0}}>{initials(m.name || m.email)}</div>
                        <span className="font-medium text-[#333333]">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#666666] text-[14px]">{m.email}</td>
                    <td className="px-6 py-4">
                      <select value={roleLabel[m.role] ?? m.role} disabled={rowBusy === m.id} onChange={(e) => handleRoleChange(m.id, e.target.value)} className="bg-white border border-[#e4e2e1] rounded px-2 py-1 text-[13px] focus:outline-none focus:border-[#e30613] disabled:opacity-50">
                        {roles.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span style={{padding:"3px 10px",borderRadius:"999px",fontSize:"10px",fontWeight:"bold",background:m.status==="Active"?"rgba(22,163,74,0.1)":"rgba(227,6,19,0.1)",color:m.status==="Active"?"#16a34a":"#e30613",border:`1px solid ${m.status==="Active"?"rgba(22,163,74,0.2)":"rgba(227,6,19,0.2)"}`}}>{m.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button disabled={rowBusy === m.id} onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} className="text-[#666666] hover:text-[#ba1a1a] transition-colors disabled:opacity-50">
                          <span className="material-symbols-outlined" style={{fontSize:"18px"}}>more_vert</span>
                        </button>
                        {menuFor === m.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-0 mt-1 z-20 w-52 bg-white border border-[#e4e2e1] rounded-lg shadow-lg overflow-hidden">
                              <button onClick={() => handleCopyMemberLink(m.id)} className="w-full text-left px-4 py-2.5 text-[13px] text-[#333333] hover:bg-[#f8f8f8] flex items-center gap-2">
                                <span className="material-symbols-outlined" style={{fontSize:"16px"}}>link</span> Copy registration link
                              </button>
                              <button onClick={() => handleRemove(m.id)} className="w-full text-left px-4 py-2.5 text-[13px] text-[#ba1a1a] hover:bg-[#ba1a1a]/5 flex items-center gap-2 border-t border-[#e4e2e1]">
                                <span className="material-symbols-outlined" style={{fontSize:"16px"}}>delete</span> Remove member
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 2 && (
        <div className="max-w-2xl">
          <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8]">
              <div className="grid grid-cols-3 gap-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">Notification</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#666666] text-center">Email</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#666666] text-center">In-App</span>
              </div>
            </div>
            <div className="divide-y divide-[#e4e2e1]">
              {notifs.map((n, i) => (
                <div key={i} className="px-6 py-4 grid grid-cols-3 gap-4 items-center hover:bg-[#f8f8f8] transition-colors">
                  <div>
                    <p className="font-medium text-[#333333] text-[14px]">{n.label}</p>
                    <p className="text-[#666666] text-[12px] mt-0.5">{n.desc}</p>
                  </div>
                  {(["email", "inApp"] as const).map(type => (
                    <div key={type} className="flex justify-center">
                      <button onClick={() => toggleNotif(i, type)}
                        style={{width:"44px",height:"24px",borderRadius:"12px",background:n[type]?"#e30613":"#e4e2e1",position:"relative",transition:"background 0.2s",border:"none",cursor:"pointer"}}>
                        <div style={{width:"18px",height:"18px",borderRadius:"50%",background:"white",position:"absolute",top:"3px",transition:"left 0.2s",left:n[type]?"23px":"3px",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-end">
              <button className="bg-[#e30613] text-white px-6 py-2 rounded font-bold text-[14px] hover:opacity-90 shadow-sm transition-all">SAVE PREFERENCES</button>
            </div>
          </div>
        </div>
      )}

      {/* ERP Connection Tab */}
      {activeTab === 3 && (
        <div className="max-w-2xl">
          <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[#e30613]" />
                <h3 className="text-[18px] font-medium text-[#333333]">ERP System Connection</h3>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{width:"8px",height:"8px",borderRadius:"50%",background:erpConnected?"#16a34a":"#e4e2e1"}} />
                <span style={{fontSize:"12px",fontWeight:"bold",color:erpConnected?"#16a34a":"#666666"}}>{erpConnected?"Connected":"Disconnected"}</span>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">ERP Base URL</label>
                <input value={erpUrl} onChange={e => setErpUrl(e.target.value)} placeholder="https://your-erp-system.com" className="bg-white border border-[#e4e2e1] rounded p-3 text-[15px] focus:outline-none focus:border-[#e30613]" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">API Key</label>
                <input value={erpKey} onChange={e => setErpKey(e.target.value)} type="password" placeholder="••••••••••••••••" className="bg-white border border-[#e4e2e1] rounded p-3 text-[15px] focus:outline-none focus:border-[#e30613]" />
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={() => setErpConnected(true)} className="flex-1 bg-[#e30613] text-white py-3 rounded font-bold text-[14px] hover:opacity-90 shadow-sm transition-all">TEST & CONNECT</button>
                {erpConnected && <button onClick={() => setErpConnected(false)} className="px-5 py-3 border border-[#ba1a1a]/40 text-[#ba1a1a] rounded font-bold text-[14px] hover:bg-[#ba1a1a]/10 transition-all">DISCONNECT</button>}
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex items-center gap-2">
              <div className="w-1 h-5 bg-[#e30613]" />
              <h3 className="text-[18px] font-medium text-[#333333]">Sync Settings</h3>
            </div>
            <div className="divide-y divide-[#e4e2e1]">
              {[
                { label: "Auto-sync scope on approval", desc: "Automatically POST scope data when a project is approved" },
                { label: "Fetch POs on login", desc: "Pull latest Purchase Orders from ERP on each session start" },
                { label: "Retry failed syncs", desc: "Automatically retry failed ERP syncs up to 3 times" },
              ].map((s, i) => (
                <div key={i} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-[#333333] text-[14px]">{s.label}</p>
                    <p className="text-[#666666] text-[12px]">{s.desc}</p>
                  </div>
                  <div style={{width:"44px",height:"24px",borderRadius:"12px",background:"#e30613",position:"relative",cursor:"pointer"}}>
                    <div style={{width:"18px",height:"18px",borderRadius:"50%",background:"white",position:"absolute",top:"3px",left:"23px",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 4 && (
        <div className="max-w-2xl">
          <div className="bg-white border border-[#e4e2e1] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#e4e2e1] bg-[#f8f8f8] flex items-center gap-2">
              <div className="w-1 h-5 bg-[#e30613]" />
              <h3 className="text-[18px] font-medium text-[#333333]">Appearance & Theme</h3>
            </div>
            <div className="p-6 space-y-8">
              <div>
                <p className="text-[13px] font-bold text-[#e30613] uppercase mb-4">Colour Theme</p>
                <div className="flex gap-4">
                  {[
                    { name: "Studio Red", color: "#e30613", active: true },
                    { name: "Midnight", color: "#1b1c1c", active: false },
                    { name: "Forest", color: "#16a34a", active: false },
                    { name: "Ocean", color: "#0059a8", active: false },
                  ].map((t, i) => (
                    <div key={i} style={{textAlign:"center",cursor:"pointer"}}>
                      <div style={{width:"48px",height:"48px",borderRadius:"50%",background:t.color,margin:"0 auto 8px",border:t.active?"3px solid #e30613":"3px solid transparent",boxShadow:t.active?"0 0 0 2px rgba(227,6,19,0.3)":"none"}} />
                      <p style={{fontSize:"11px",fontWeight:t.active?"bold":"normal",color:t.active?"#e30613":"#666666"}}>{t.name}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#e30613] uppercase mb-4">Sidebar Style</p>
                <div className="flex gap-4">
                  {["Compact", "Default", "Wide"].map((s, i) => (
                    <button key={i} className={`px-5 py-2.5 rounded border text-[13px] font-bold transition-all ${i===1 ? "border-[#e30613] text-[#e30613] bg-[#e30613]/5" : "border-[#e4e2e1] text-[#666666] hover:border-[#e30613]/40"}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#e30613] uppercase mb-4">Date Format</p>
                <div className="flex gap-4">
                  {["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((f, i) => (
                    <button key={i} className={`px-5 py-2.5 rounded border text-[13px] font-bold transition-all ${i===0 ? "border-[#e30613] text-[#e30613] bg-[#e30613]/5" : "border-[#e4e2e1] text-[#666666] hover:border-[#e30613]/40"}`}>{f}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e4e2e1] bg-[#f8f8f8] flex justify-end">
              <button className="bg-[#e30613] text-white px-6 py-2 rounded font-bold text-[14px] hover:opacity-90 shadow-sm transition-all">SAVE APPEARANCE</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPw && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-[#e4e2e1] w-full max-w-[28rem] rounded-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e4e2e1] flex justify-between items-center bg-[#f8f8f8]">
              <h3 className="text-[22px] font-bold text-[#333333]">Change Password</h3>
              <button onClick={() => setShowPw(false)} className="text-[#666666] hover:text-[#e30613] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {pwErr && (
                <div className="bg-[#e30613]/10 border border-[#e30613]/20 text-[#ba1a1a] text-[13px] rounded p-3">{pwErr}</div>
              )}
              {pwOk && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-700 text-[13px] rounded p-3">Password updated successfully.</div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Current Password</label>
                <input type="password" required value={curPw} onChange={(e) => setCurPw(e.target.value)} className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">New Password</label>
                <input type="password" required value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Confirm New Password</label>
                <input type="password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPw(false)} className="px-5 py-2 rounded border border-[#e4e2e1] text-[#333333] hover:bg-[#eae8e7] font-bold text-[13px] transition-all">CLOSE</button>
                <button type="submit" disabled={pwBusy} className="bg-[#e30613] text-white px-6 py-2 rounded font-bold text-[13px] hover:opacity-90 shadow-sm transition-all disabled:opacity-50">
                  {pwBusy ? "SAVING…" : "UPDATE PASSWORD"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-[#e4e2e1] w-full max-w-[28rem] rounded-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e4e2e1] flex justify-between items-center bg-[#f8f8f8]">
              <h3 className="text-[22px] font-bold text-[#333333]">Invite Member</h3>
              <button onClick={() => setShowInvite(false)} className="text-[#666666] hover:text-[#e30613] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form action={handleInvite} className="p-6 space-y-4">
              {inviteMsg && !inviteMsg.ok && (
                <div className="bg-[#e30613]/10 border border-[#e30613]/20 text-[#ba1a1a] text-[13px] rounded p-3">{inviteMsg.text}</div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Full Name</label>
                <input name="name" required className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]" placeholder="Jane Doe" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Company Email</label>
                <input name="email" type="email" required className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]" placeholder="jane@studiomasons.in" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#e30613] uppercase">Role</label>
                <select name="role" required defaultValue="SITE_ENGINEER" className="bg-white border border-[#e4e2e1] rounded p-2.5 text-[15px] focus:outline-none focus:border-[#e30613]">
                  {roles.map(r => <option key={r} value={roleEnum[r]}>{r}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="px-5 py-2 rounded border border-[#e4e2e1] text-[#333333] hover:bg-[#eae8e7] font-bold text-[13px] transition-all">CANCEL</button>
                <button type="submit" disabled={inviting} className="bg-[#e30613] text-white px-6 py-2 rounded font-bold text-[13px] hover:opacity-90 shadow-sm transition-all disabled:opacity-50">
                  {inviting ? "SENDING…" : "SEND INVITE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
