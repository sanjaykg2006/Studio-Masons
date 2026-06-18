"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAppearance } from "../../contexts/AppearanceContext";

// Lets browser shortcuts (open in new tab/window) keep working, otherwise
// routes through the navigation transition so the loading overlay appears.
function isModifiedClick(e: React.MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

const navItems = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/project-tracker", icon: "timeline", label: "Project Tracker" },
  { href: "/site-survey", icon: "architecture", label: "Site Survey" },
  { href: "/design", icon: "design_services", label: "Design Management" },
  { href: "/purchase-orders", icon: "request_quote", label: "Purchase Orders" },
  { href: "/orders", icon: "payments", label: "Orders & Expense" },
  { href: "/quality", icon: "fact_check", label: "Quality Checks" },
  { href: "/snags", icon: "report_problem", label: "Snags" },
  { href: "/site-progress", icon: "potted_plant", label: "Site Progress" },
  { href: "/audit", icon: "assignment_turned_in", label: "Audit" },
  { href: "/dlp", icon: "handyman", label: "DLP" },
  { href: "/erp-integration", icon: "integration_instructions", label: "ERP Integration" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { navigate } = useNavigation();
  const { sidebarWidthClass } = useAppearance();
  return (
    <aside className={`fixed left-0 top-0 h-full flex flex-col py-6 bg-[#f8f8f8] border-r border-[#e4e2e1] ${sidebarWidthClass} z-50 transition-all`}>
      <div className="px-6 mb-10">
        <Image src="/logo-full.jpg" alt="Studio Masons" width={180} height={90} className="w-full h-auto" priority />
      </div>
      <nav className="flex-1 overflow-y-auto hide-scrollbar px-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link href={item.href}
                  onClick={(e) => { if (!isModifiedClick(e)) { e.preventDefault(); navigate(item.href); } }}
                  className={`flex items-center gap-3 py-3 pl-4 transition-all duration-200 ${
                    isActive ? "bg-white text-[#e30613] font-bold border-r-4 border-[#e30613]" : "text-[#666666] hover:bg-white hover:text-[#e30613]"
                  }`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="text-[16px]">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto px-2">
        <Link href="/settings"
          onClick={(e) => { if (!isModifiedClick(e)) { e.preventDefault(); navigate("/settings"); } }}
          className="flex items-center gap-3 py-3 pl-4 text-[#666666] hover:bg-white hover:text-[#e30613] transition-colors">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[16px]">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
