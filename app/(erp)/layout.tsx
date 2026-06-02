"use client";
import Sidebar from "../../components/layout/Sidebar";
import Topbar from "../../components/layout/Topbar";
import { ProjectProvider } from "../../contexts/ProjectContext";
import { ToastProvider } from "@/lib/toast";

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ProjectProvider>
        <div className="flex min-h-screen bg-white">
          <Sidebar />
          <div className="ml-64 flex flex-col flex-1">
            <Topbar />
            <main className="flex-1 p-6 bg-white">
              {children}
            </main>
          </div>
        </div>
      </ProjectProvider>
    </ToastProvider>
  );
}
