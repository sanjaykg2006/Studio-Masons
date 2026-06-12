"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type SidebarStyle = "Compact" | "Default" | "Wide";
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export type AppearanceSettings = {
  themeColor: string;
  sidebarStyle: SidebarStyle;
  dateFormat: DateFormat;
};

const DEFAULTS: AppearanceSettings = {
  themeColor: "#e30613",
  sidebarStyle: "Default",
  dateFormat: "DD/MM/YYYY",
};

const STORAGE_KEY = "sm.appearance";

// Tailwind needs the full class strings present in source to generate them, so
// these are written out literally rather than composed at runtime.
const SIDEBAR_WIDTH: Record<SidebarStyle, string> = {
  Compact: "w-56",
  Default: "w-64",
  Wide: "w-72",
};
const CONTENT_MARGIN: Record<SidebarStyle, string> = {
  Compact: "ml-56",
  Default: "ml-64",
  Wide: "ml-72",
};

type AppearanceContextValue = AppearanceSettings & {
  loaded: boolean;
  sidebarWidthClass: string;
  contentMarginClass: string;
  save: (settings: AppearanceSettings) => void;
  formatDate: (date: Date | string | number) => string;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

// Pushes the accent colour into CSS custom properties on <html>. Both the
// `--accent` override (used by globals.css to remap the literal #e30613 classes)
// and Tailwind's `--color-primary` token are updated, so the whole app follows.
function applyTheme(themeColor: string) {
  const root = document.documentElement;
  root.style.setProperty("--accent", themeColor);
  root.style.setProperty("--color-primary", themeColor);
  root.style.setProperty("--color-primary-container", themeColor);
}

function formatWith(fmt: DateFormat, value: Date | string | number) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  switch (fmt) {
    case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
    default: return `${dd}/${mm}/${yyyy}`;
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Load persisted settings once on mount and apply them.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = { ...DEFAULTS, ...JSON.parse(raw) } as AppearanceSettings;
        setSettings(parsed);
        applyTheme(parsed.themeColor);
      } else {
        applyTheme(DEFAULTS.themeColor);
      }
    } catch {
      applyTheme(DEFAULTS.themeColor);
    }
    setLoaded(true);
  }, []);

  const save = useCallback((next: AppearanceSettings) => {
    setSettings(next);
    applyTheme(next.themeColor);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode / quota) — settings still apply for
      // this session.
    }
  }, []);

  const formatDate = useCallback(
    (date: Date | string | number) => formatWith(settings.dateFormat, date),
    [settings.dateFormat]
  );

  return (
    <AppearanceContext.Provider
      value={{
        ...settings,
        loaded,
        sidebarWidthClass: SIDEBAR_WIDTH[settings.sidebarStyle],
        contentMarginClass: CONTENT_MARGIN[settings.sidebarStyle],
        save,
        formatDate,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
