"use client";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import NavLoadingOverlay from "../../components/layout/NavLoadingOverlay";
import { ProjectProvider } from "../../contexts/ProjectContext";
import { NavigationProvider } from "../../contexts/NavigationContext";
import { AppearanceProvider, useAppearance } from "../../contexts/AppearanceContext";
import { ToastProvider } from "@/lib/toast";

function ERPShell({ children }: { children: React.ReactNode }) {
  const { contentMarginClass } = useAppearance();
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className={`${contentMarginClass} flex flex-col flex-1 transition-all`}>
        <Topbar />
        <main className="relative flex-1 p-6 bg-white">
          <NavLoadingOverlay />
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppearanceProvider>
        <NavigationProvider>
          <ProjectProvider>
            <ERPShell>{children}</ERPShell>
          </ProjectProvider>
        </NavigationProvider>
      </AppearanceProvider>
    </ToastProvider>
  );
}
