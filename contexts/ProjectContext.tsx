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
  updateProjectPct: (id: string, pct: number) => void;
}

export function getAutoStatus(pct: number, isDelayed = false): DemoProject["status"] {
  if (isDelayed) return "Delayed";
  if (pct >= 100) return "Completed";
  if (pct >= 75) return "On Track";
  if (pct > 10) return "In Progress";
  return "New Site";
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const STORAGE_KEY = "erp-selected-project";

const initialProjectData = [
  { id: "proj_1", name: "Indiranagar Residence", clientName: "Sharma Family", location: "Bengaluru", pct: 65, engineer: "Vikram R.", isDelayed: false },
  { id: "proj_2", name: "Whitefield Office", clientName: "TechPark Solutions", location: "Bengaluru", pct: 24, engineer: "Sneha P.", isDelayed: true },
  { id: "proj_3", name: "Koramangala Villa", clientName: "Reddy Associates", location: "Bengaluru", pct: 89, engineer: "Amit S.", isDelayed: false },
  { id: "proj_4", name: "HSR Layout G+3", clientName: "Prestige Builders", location: "Bengaluru", pct: 42, engineer: "Rahul K.", isDelayed: false },
  { id: "proj_5", name: "Jayanagar Apartment", clientName: "Mehta & Sons", location: "Bengaluru", pct: 10, engineer: "Priya M.", isDelayed: false },
];

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [rawProjects, setRawProjects] = useState(initialProjectData);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && initialProjectData.some((p) => p.id === stored)) {
      setSelectedId(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (selectedId) {
      localStorage.setItem(STORAGE_KEY, selectedId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedId, hydrated]);

  const projects: DemoProject[] = rawProjects.map(({ isDelayed, ...p }) => ({
    ...p,
    status: getAutoStatus(p.pct, isDelayed),
  }));

  const selectedProject = selectedId
    ? projects.find((p) => p.id === selectedId) ?? null
    : null;

  function updateProjectPct(id: string, pct: number) {
    setRawProjects(prev =>
      prev.map(p => p.id === id ? { ...p, pct: Math.max(0, Math.min(100, pct)) } : p)
    );
  }

  return (
    <ProjectContext.Provider
      value={{ projects, selectedProject, setSelectedProjectId: setSelectedId, updateProjectPct }}
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
