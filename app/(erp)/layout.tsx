"use client";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import NavLoadingOverlay from "../../components/layout/NavLoadingOverlay";
import { ProjectProvider } from "../../contexts/ProjectContext";
import { NavigationProvider } from "../../contexts/NavigationContext";
import { ToastProvider } from "@/lib/toast";

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NavigationProvider>
        <ProjectProvider>
          <div className="flex min-h-screen bg-white">
            <Sidebar />
            <div className="ml-64 flex flex-col flex-1">
              <Topbar />
              <main className="relative flex-1 p-6 bg-white">
                <NavLoadingOverlay />
                {children}
              </main>
            </div>
          </div>
        </ProjectProvider>
      </NavigationProvider>
    </ToastProvider>
  );
}
