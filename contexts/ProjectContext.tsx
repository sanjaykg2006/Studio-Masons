"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface DemoProject {
  id: string;
  name: string;
  clientName: string;
  location: string;
  status: "In Progress" | "Delayed" | "On Track" | "New Site" | "Completed";
  pct: number;
  engineer: string;
}

interface ProjectContextValue {
  projects: DemoProject[];
  selectedProject: DemoProject | null;
  setSelectedProjectId: (id: string | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const STORAGE_KEY = "erp-selected-project";

const demoProjects: DemoProject[] = [
  { id: "proj_1", name: "Indiranagar Residence", clientName: "Sharma Family", location: "Bengaluru", status: "In Progress", pct: 65, engineer: "Vikram R." },
  { id: "proj_2", name: "Whitefield Office", clientName: "TechPark Solutions", location: "Bengaluru", status: "Delayed", pct: 24, engineer: "Sneha P." },
  { id: "proj_3", name: "Koramangala Villa", clientName: "Reddy Associates", location: "Bengaluru", status: "On Track", pct: 89, engineer: "Amit S." },
  { id: "proj_4", name: "HSR Layout G+3", clientName: "Prestige Builders", location: "Bengaluru", status: "In Progress", pct: 42, engineer: "Rahul K." },
  { id: "proj_5", name: "Jayanagar Apartment", clientName: "Mehta & Sons", location: "Bengaluru", status: "New Site", pct: 10, engineer: "Priya M." },
];

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && demoProjects.some((p) => p.id === stored)) {
      setSelectedId(stored);
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    if (selectedId) {
      localStorage.setItem(STORAGE_KEY, selectedId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedId, hydrated]);

  const selectedProject = selectedId
    ? demoProjects.find((p) => p.id === selectedId) ?? null
    : null;

  return (
    <ProjectContext.Provider
      value={{
        projects: demoProjects,
        selectedProject,
        setSelectedProjectId: setSelectedId,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside <ProjectProvider>");
  return ctx;
}
