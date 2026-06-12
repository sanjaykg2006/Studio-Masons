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

// Relative "time ago" label for notification timestamps (mirrors the dashboard feed).
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// localStorage key for which notification (activity) ids the user has read.
const NOTIF_READ_KEY = "erp-notif-read";

const accountItems = [
  { icon: "manage_accounts", label: "Profile & Settings", route: "/settings" },
  { icon: "help_outline",    label: "Help & Support",     route: "/settings" },
];

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, selectedProject, setSelectedProjectId, activities } = useProject();

  const [open,          setOpen]          = useState(false);
  const [showNotif,     setShowNotif]     = useState(false);
  const [showAccount,   setShowAccount]   = useState(false);
  const [searchValue,   setSearchValue]   = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // Ids of activity entries the user has read. Loaded from localStorage after
  // mount (empty on the server) so it persists across reloads without a hydration
  // mismatch. Any activity not in the set counts as unread.
  const [readSet,       setReadSet]       = useState<Set<string>>(new Set());
  const [userEmail,     setUserEmail]     = useState<string>("");
  const [userName,      setUserName]      = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_READ_KEY);
      if (raw) setReadSet(new Set(JSON.parse(raw) as string[]));
    } catch (err) {
      console.warn("[Topbar] Couldn't load read notifications:", err);
    }
  }, []);

  function persistRead(next: Set<string>) {
    try {
      localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...next]));
    } catch (err) {
      console.warn("[Topbar] Couldn't persist read notifications:", err);
    }
  }

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

  const unreadCount = activities.filter((a) => !readSet.has(a.id)).length;

  const searchResults = searchValue.trim().length > 0
    ? projects.filter(p =>
        p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        p.location.toLowerCase().includes(searchValue.toLowerCase()) ||
        p.clientName.toLowerCase().includes(searchValue.toLowerCase())
      )
    : [];

  const showSearchDrop = searchFocused && searchValue.trim().length > 0;

  function markAllRead() {
    const next = new Set(activities.map((a) => a.id));
    setReadSet(next);
    persistRead(next);
  }

  function handleNotifClick(id: string, route: string) {
    setReadSet(prev => {
      const next = new Set([...prev, id]);
      persistRead(next);
      return next;
    });
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
              {activities.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="material-symbols-outlined text-[#cccccc]" style={{ fontSize: "32px" }}>notifications_off</span>
                  <p className="text-[13px] text-[#999999] mt-2">No notifications yet</p>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                  {activities.map((a) => {
                    const isRead = readSet.has(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => handleNotifClick(a.id, a.route)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-[#f0eded] last:border-b-0 hover:bg-[#f8f8f8] transition-colors ${isRead ? "opacity-60" : ""}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-white border border-[#e4e2e1] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined" style={{ fontSize: "16px", color: a.color }}>{a.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[13px] text-[#333333] ${!isRead ? "font-semibold" : ""}`}>
                              {a.text} <span className="font-bold">{a.bold}</span>
                            </p>
                            <span className="text-[10px] text-[#999999] shrink-0">{timeAgo(a.at)}</span>
                          </div>
                          <p className="text-[11px] text-[#666666] mt-0.5 line-clamp-2">{a.detail}</p>
                        </div>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#e30613] shrink-0 mt-1.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
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
