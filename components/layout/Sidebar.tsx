"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/site-survey", icon: "architecture", label: "Site Survey" },
  { href: "/design", icon: "design_services", label: "Design Management" },
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
  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col py-6 bg-[#f8f8f8] border-r border-[#e4e2e1] w-64 z-50">
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
        <Link href="/settings" className="flex items-center gap-3 py-3 pl-4 text-[#666666] hover:bg-white hover:text-[#e30613] transition-colors">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[16px]">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
