import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getToken } from "@/lib/api";

export interface FlagDef {
  key: string;
  label: string;
  description: string;
  affectsRoles: "all" | "non-admin";
}

export const FLAG_DEFINITIONS: FlagDef[] = [
  {
    key: "price_lookup",
    label: "Price Lookup Tool",
    description: "Shows the Price Lookup page in the sidebar and enables the /parts route for all users.",
    affectsRoles: "all",
  },
  {
    key: "parts_import",
    label: "Parts Import",
    description: "Enables the Parts Import page (/parts/import) for uploading CSV and PDF price sheets.",
    affectsRoles: "all",
  },
  {
    key: "parts_catalog_admin",
    label: "Parts Catalog Admin",
    description: "Shows the Parts Catalog and Categories management pages in the admin section.",
    affectsRoles: "all",
  },
  {
    key: "reports",
    label: "Reports & Analytics",
    description: "Shows the Reports and Report Builder pages in the admin section.",
    affectsRoles: "all",
  },
  {
    key: "following",
    label: "Following / Watch List",
    description: "Shows the Following page where users track watched leads and customers.",
    affectsRoles: "all",
  },
];

export type FeatureFlags = Record<string, boolean>;

interface FlagsCtx {
  flags: FeatureFlags;
  isEnabled: (key: string) => boolean;
  setFlag: (key: string, enabled: boolean) => Promise<void>;
  isLoading: boolean;
  reload: () => void;
}

const defaultFlags: FeatureFlags = Object.fromEntries(
  FLAG_DEFINITIONS.map((f) => [f.key, true])
);

const Ctx = createContext<FlagsCtx>({
  flags: defaultFlags,
  isEnabled: () => true,
  setFlag: async () => {},
  isLoading: true,
  reload: () => {},
});

export function useFeatureFlags() {
  return useContext(Ctx);
}

export function FeatureFlagsProvider({
  children,
  isAuthenticated = false,
}: {
  children: ReactNode;
  isAuthenticated?: boolean;
}) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token || !isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetch("/api/feature-flags", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: FeatureFlags) => {
        setFlags({ ...defaultFlags, ...data });
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, tick]);

  function isEnabled(key: string): boolean {
    return flags[key] !== false;
  }

  async function setFlag(key: string, enabled: boolean) {
    const token = getToken();
    const res = await fetch("/api/feature-flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [key]: enabled }),
    });
    if (!res.ok) throw new Error("Failed to update flag");
    const updated: FeatureFlags = await res.json();
    setFlags({ ...defaultFlags, ...updated });
  }

  function reload() {
    setTick((t) => t + 1);
  }

  return (
    <Ctx.Provider value={{ flags, isEnabled, setFlag, isLoading, reload }}>
      {children}
    </Ctx.Provider>
  );
}
