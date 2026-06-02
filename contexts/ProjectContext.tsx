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

// A vendor procured for a project, along with the purchase order issued to them.
export interface VendorPO {
  id: string;
  projectId: string;
  vendorName: string;
  poNumber: string;
  poValue: number;
  // Name of the uploaded purchase-order document. Required for every vendor —
  // the File bytes can't survive localStorage, so we persist the filename only.
  poFileName: string;
  createdAt: string;
}

interface ProjectContextValue {
  projects: DemoProject[];
  selectedProject: DemoProject | null;
  setSelectedProjectId: (id: string | null) => void;
  updateProjectPct: (id: string, pct: number) => void;
  // Vendor / purchase-order store
  vendorPOs: VendorPO[];
  addVendorPO: (input: { projectId: string; vendorName: string; poNumber: string; poValue: number; poFileName: string }) => void;
  getProjectVendorPOs: (projectId: string) => VendorPO[];
  getVendorPO: (projectId: string, vendorName: string) => VendorPO | undefined;
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
const VENDOR_PO_KEY = "erp-vendor-pos";

// Seeded purchase orders so the demo projects already have vendors procured.
// PO values are set above the existing demo invoice totals so new uploads still fit.
const initialVendorPOs: VendorPO[] = [
  { id: "po_1", projectId: "proj_1", vendorName: "Blackwood Stonemasons Ltd.", poNumber: "PO-2841", poValue: 50000, poFileName: "PO-2841.pdf", createdAt: "2024-10-01" },
  { id: "po_2", projectId: "proj_1", vendorName: "Oak & Grain Joinery",        poNumber: "PO-2842", poValue: 30000, poFileName: "PO-2842.pdf", createdAt: "2024-10-02" },
  { id: "po_3", projectId: "proj_2", vendorName: "Imperial Steel Works",       poNumber: "PO-2843", poValue: 40000, poFileName: "PO-2843.pdf", createdAt: "2024-10-03" },
  { id: "po_4", projectId: "proj_3", vendorName: "Glass & Light Studios",      poNumber: "PO-2844", poValue: 25000, poFileName: "PO-2844.pdf", createdAt: "2024-10-04" },
  { id: "po_5", projectId: "proj_3", vendorName: "Premier Tiling Co.",         poNumber: "PO-2845", poValue: 20000, poFileName: "PO-2845.pdf", createdAt: "2024-10-05" },
  { id: "po_6", projectId: "proj_4", vendorName: "Elite Electrical Solutions", poNumber: "PO-2846", poValue: 15000, poFileName: "PO-2846.pdf", createdAt: "2024-10-06" },
  { id: "po_7", projectId: "proj_4", vendorName: "Blackwood Stonemasons Ltd.", poNumber: "PO-2847", poValue: 20000, poFileName: "PO-2847.pdf", createdAt: "2024-10-07" },
];

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
  const [vendorPOs, setVendorPOs] = useState<VendorPO[]>(initialVendorPOs);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && initialProjectData.some((p) => p.id === stored)) {
      setSelectedId(stored);
    }
    const storedPOs = localStorage.getItem(VENDOR_PO_KEY);
    if (storedPOs) {
      try {
        const parsed = JSON.parse(storedPOs) as VendorPO[];
        if (Array.isArray(parsed)) setVendorPOs(parsed);
      } catch {
        /* ignore malformed storage */
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Persistence is best-effort: storage can be full, disabled, or blocked in
    // private mode. If it fails, the app keeps working from in-memory state.
    try {
      if (selectedId) {
        localStorage.setItem(STORAGE_KEY, selectedId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn("[ProjectContext] Couldn't persist selected project:", err);
    }
  }, [selectedId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(VENDOR_PO_KEY, JSON.stringify(vendorPOs));
    } catch (err) {
      console.warn("[ProjectContext] Couldn't persist vendor purchase orders:", err);
    }
  }, [vendorPOs, hydrated]);

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

  function getProjectVendorPOs(projectId: string) {
    return vendorPOs.filter(po => po.projectId === projectId);
  }

  function getVendorPO(projectId: string, vendorName: string) {
    return vendorPOs.find(
      po => po.projectId === projectId && po.vendorName.toLowerCase() === vendorName.toLowerCase()
    );
  }

  function addVendorPO(input: { projectId: string; vendorName: string; poNumber: string; poValue: number; poFileName: string }) {
    setVendorPOs(prev => {
      const existing = prev.find(
        po => po.projectId === input.projectId &&
          po.vendorName.toLowerCase() === input.vendorName.trim().toLowerCase()
      );
      // A vendor on a project carries a single PO — update it rather than duplicating.
      if (existing) {
        return prev.map(po => po.id === existing.id
          ? { ...po, poNumber: input.poNumber.trim(), poValue: input.poValue, poFileName: input.poFileName }
          : po);
      }
      const po: VendorPO = {
        id: `po_${Date.now()}`,
        projectId: input.projectId,
        vendorName: input.vendorName.trim(),
        poNumber: input.poNumber.trim(),
        poValue: input.poValue,
        poFileName: input.poFileName,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      return [...prev, po];
    });
  }

  return (
    <ProjectContext.Provider
      value={{ projects, selectedProject, setSelectedProjectId: setSelectedId, updateProjectPct, vendorPOs, addVendorPO, getProjectVendorPOs, getVendorPO }}
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
