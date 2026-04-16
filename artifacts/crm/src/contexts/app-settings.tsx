import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getToken } from "@/lib/api";

export interface ColorTheme {
  key: string;
  label: string;
  accent: string;
  accentFg: string;
  preview: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  { key: "amber",  label: "Amber",  accent: "38 92% 55%",  accentFg: "222 47% 11%", preview: "#f59e0b" },
  { key: "blue",   label: "Blue",   accent: "217 91% 60%", accentFg: "0 0% 100%",   preview: "#3b82f6" },
  { key: "green",  label: "Green",  accent: "142 71% 45%", accentFg: "0 0% 100%",   preview: "#22c55e" },
  { key: "purple", label: "Purple", accent: "265 89% 65%", accentFg: "0 0% 100%",   preview: "#a855f7" },
  { key: "rose",   label: "Rose",   accent: "347 77% 50%", accentFg: "0 0% 100%",   preview: "#f43f5e" },
  { key: "teal",   label: "Teal",   accent: "178 60% 45%", accentFg: "0 0% 100%",   preview: "#14b8a6" },
];

export interface AppSettings {
  companyName: string;
  accentColor: string;
}

interface SettingsCtx {
  settings: AppSettings;
  updateSettings: (next: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
}

const Ctx = createContext<SettingsCtx>({
  settings: { companyName: "SalesCRM", accentColor: "amber" },
  updateSettings: async () => {},
  isLoading: true,
});

export function useAppSettings() {
  return useContext(Ctx);
}

function applyColorTheme(key: string) {
  const theme = COLOR_THEMES.find((t) => t.key === key) ?? COLOR_THEMES[0];
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-foreground", theme.accentFg);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>({ companyName: "SalesCRM", accentColor: "amber" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: AppSettings) => {
        setSettings(data);
        applyColorTheme(data.accentColor);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function updateSettings(next: Partial<AppSettings>) {
    const token = getToken();
    const r = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(next),
    });
    if (!r.ok) throw new Error("Failed to save settings");
    const updated: AppSettings = await r.json();
    setSettings(updated);
    applyColorTheme(updated.accentColor);
  }

  return <Ctx.Provider value={{ settings, updateSettings, isLoading }}>{children}</Ctx.Provider>;
}
