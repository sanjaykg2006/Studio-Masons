"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useProject } from "../../contexts/ProjectContext";
import { createClient } from "@/lib/supabase/client";

function initials(value: string) {
  const parts = value.replace(/@.*/, "").split(/[ .]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

const statusColor: Record<string, string> = {
  "In Progress": "bg-primary/10 text-primary border-primary/20",
  "Delayed":     "bg-error/10 text-error border-error/20",
  "On Track":    "bg-green-500/10 text-green-600 border-green-500/20",
  "New Site":    "bg-[#0059a8]/10 text-[#0059a8] border-[#0059a8]/20",
  "Completed":   "bg-green-500/10 text-green-600 border-green-500/20",
};

const demoNotifications = [
  { icon: "verified",               color: "#e30613", title: "Design approved",        sub: "Indiranagar Residence", time: "2h ago",    read: false, route: "/design" },
  { icon: "priority_high",          color: "#ba1a1a", title: "New snag raised",        sub: "Whitefield Office",     time: "4h ago",    read: false, route: "/snags" },
  { icon: "account_balance_wallet", color: "#e30613", title: "Invoice ₹1.2L pending",  sub: "Koramangala Villa",     time: "Yesterday", read: true,  route: "/orders" },
  { icon: "chat_bubble",            color: "#666666", title: "Architect comment added", sub: "HSR Layout G+3",        time: "Yesterday", read: true,  route: "/design" },
];

const accountItems = [
  { icon: "manage_accounts", label: "Profile & Settings", route: "/settings" },
  { icon: "help_outline",    label: "Help & Support",     route: "/settings" },
];

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, selectedProject, setSelectedProjectId } = useProject();

  const [open,          setOpen]          = useState(false);
  const [showNotif,     setShowNotif]     = useState(false);
  const [showAccount,   setShowAccount]   = useState(false);
  const [searchValue,   setSearchValue]   = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [readSet,       setReadSet]       = useState<Set<number>>(
    new Set(demoNotifications.flatMap((n, i) => (n.read ? [i] : [])))
  );
  const [userEmail,     setUserEmail]     = useState<string>("");
  const [userName,      setUserName]      = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setUserEmail(u.email ?? "");
      setUserName((u.user_metadata?.name as string) ?? u.email ?? "");
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setShowAccount(false);
    router.push("/login");
    router.refresh();
  }

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef    = useRef<HTMLDivElement>(null);
  const accountRef  = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current    && !notifRef.current.contains(e.target as Node))    setShowNotif(false);
      if (accountRef.current  && !accountRef.current.contains(e.target as Node))  setShowAccount(false);
      if (searchRef.current   && !searchRef.current.contains(e.target as Node))   setSearchFocused(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = demoNotifications.filter((_, i) => !readSet.has(i)).length;

  const searchResults = searchValue.trim().length > 0
    ? projects.filter(p =>
        p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        p.location.toLowerCase().includes(searchValue.toLowerCase()) ||
        p.clientName.toLowerCase().includes(searchValue.toLowerCase())
      )
    : [];

  const showSearchDrop = searchFocused && searchValue.trim().length > 0;

  function markAllRead() {
    setReadSet(new Set(demoNotifications.map((_, i) => i)));
  }

  function handleNotifClick(i: number, route: string) {
    setReadSet(prev => new Set([...prev, i]));
    setShowNotif(false);
    router.push(route);
  }

  function handleAccountNav(route: string) {
    setShowAccount(false);
    router.push(route);
  }

  function handleSearchSelect(projectId: string) {
    setSelectedProjectId(projectId);
    setSearchValue("");
    setSearchFocused(false);
    if (pathname === "/dashboard") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-6 h-16 bg-white border-b border-[#e4e2e1]">

      {/* Search */}
      <div ref={searchRef} className="relative w-64 lg:w-80 xl:w-96 shrink-0">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ fontSize: "18px", color: searchFocused ? "#e30613" : "#999999" }}
          >
            search
          </span>
          <input
            className="w-full bg-[#f8f8f8] border border-[#e4e2e1] rounded-lg pl-10 pr-10 py-2.5 text-[14px] placeholder:text-[#aaaaaa] focus:border-[#e30613] focus:outline-none focus:bg-white transition-all"
            placeholder="Search projects, clients, or locations..."
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onFocus={() => setSearchFocused(true)}
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(""); setSearchFocused(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#333333] flex"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
            </button>
          )}

          {/* Search results dropdown */}
          {showSearchDrop && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e4e2e1] rounded-lg shadow-xl z-[60] overflow-hidden">
              {searchResults.length > 0 ? (
                <>
                  <div className="px-4 py-2 bg-[#f8f8f8] border-b border-[#e4e2e1]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#999999]">
                      {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {searchResults.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleSearchSelect(project.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#f8f8f8] border-b border-[#f5f5f5] last:border-b-0 transition-colors"
                    >
                      <div className="w-8 h-8 rounded bg-[#e30613]/10 flex items-center justify-center shrink-0">
                        <span className="text-[12px] font-bold text-[#e30613]">
                          {project.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#333333] truncate">{project.name}</p>
                        <p className="text-[11px] text-[#999999]">{project.clientName} · {project.location}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${statusColor[project.status] || ""}`}>
                        {project.status}
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <div className="px-4 py-6 text-center">
                  <span className="material-symbols-outlined text-[#cccccc]" style={{ fontSize: "32px" }}>search_off</span>
                  <p className="text-[13px] text-[#999999] mt-2">No results for &ldquo;{searchValue}&rdquo;</p>
                </div>
              )}
            </div>
          )}
      </div>

      <div className="flex items-center gap-5 ml-6">

        {/* Project Selector Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => { setOpen(!open); setShowNotif(false); setShowAccount(false); }}
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
            <span className="material-symbols-outlined transition-transform duration-200" style={{ fontSize: "18px", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
              expand_more
            </span>
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-[#e4e2e1] rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 bg-[#f8f8f8] border-b border-[#e4e2e1]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">Switch Project</p>
              </div>
              <button
                onClick={() => { setSelectedProjectId(null); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f8f8f8] border-b border-[#e4e2e1] ${!selectedProject ? "bg-[#f8f8f8]" : ""}`}
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
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                {projects.map((project) => {
                  const isSelected = selectedProject?.id === project.id;
                  return (
                    <button
                      key={project.id}
                      onClick={() => { setSelectedProjectId(project.id); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-[#f8f8f8] border-b border-[#f0eded] last:border-b-0 ${isSelected ? "bg-[#f8f8f8] border-l-[3px] border-l-[#e30613]" : ""}`}
                    >
                      <div className="w-8 h-8 rounded bg-[#e30613]/10 flex items-center justify-center shrink-0">
                        <span className="text-[12px] font-bold text-[#e30613]">
                          {project.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] truncate ${isSelected ? "font-bold text-[#e30613]" : "font-medium text-[#333333]"}`}>
                          {project.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#666666]">{project.location}</span>
                          <span className="text-[10px] text-[#e4e2e1]">•</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border whitespace-nowrap ${statusColor[project.status] || ""}`}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-[12px] font-bold text-[#333333]">{project.pct}%</p>
                          <div className="w-12 h-1 bg-[#e4e2e1] rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-[#e30613] rounded-full" style={{ width: `${project.pct}%` }} />
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
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setShowNotif(!showNotif); setOpen(false); setShowAccount(false); }}
            className="text-[#666666] hover:text-[#e30613] transition-colors relative"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#e30613] rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold px-0.5">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-[340px] bg-white border border-[#e4e2e1] rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#f8f8f8] border-b border-[#e4e2e1]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-bold text-[#e30613] uppercase tracking-wider hover:opacity-70">
                    Mark all read
                  </button>
                )}
              </div>
              {demoNotifications.map((n, i) => (
                <button
                  key={i}
                  onClick={() => handleNotifClick(i, n.route)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-[#f0eded] last:border-b-0 hover:bg-[#f8f8f8] transition-colors ${readSet.has(i) ? "opacity-60" : ""}`}
                >
                  <div className="w-8 h-8 rounded-full bg-white border border-[#e4e2e1] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: n.color }}>{n.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[13px] text-[#333333] ${!readSet.has(i) ? "font-semibold" : ""}`}>{n.title}</p>
                      <span className="text-[10px] text-[#999999] shrink-0">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-[#666666] mt-0.5">{n.sub}</p>
                  </div>
                  {!readSet.has(i) && (
                    <span className="w-2 h-2 rounded-full bg-[#e30613] shrink-0 mt-1.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account */}
        <div ref={accountRef} className="relative">
          <button
            onClick={() => { setShowAccount(!showAccount); setOpen(false); setShowNotif(false); }}
            className="w-8 h-8 rounded-full bg-[#e4e2e1] flex items-center justify-center text-[12px] font-bold text-[#666666] hover:ring-2 hover:ring-[#e30613] transition-all uppercase"
          >
            {userEmail ? initials(userName || userEmail) : "SM"}
          </button>

          {showAccount && (
            <div className="absolute right-0 top-full mt-2 w-[220px] bg-white border border-[#e4e2e1] rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 bg-[#f8f8f8] border-b border-[#e4e2e1]">
                <p className="text-[13px] font-bold text-[#333333] truncate">{userName || "Studio Masons"}</p>
                <p className="text-[11px] text-[#666666] mt-0.5 truncate">{userEmail || "—"}</p>
              </div>
              {accountItems.map(item => (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#f8f8f8] border-b border-[#f0eded] transition-colors"
                  onClick={() => handleAccountNav(item.route)}
                >
                  <span className="material-symbols-outlined text-[#666666]" style={{ fontSize: "18px" }}>{item.icon}</span>
                  <span className="text-[14px] text-[#333333]">{item.label}</span>
                </button>
              ))}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors"
                onClick={handleSignOut}
              >
                <span className="material-symbols-outlined text-[#e30613]" style={{ fontSize: "18px" }}>logout</span>
                <span className="text-[14px] text-[#e30613] font-medium">Sign Out</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
