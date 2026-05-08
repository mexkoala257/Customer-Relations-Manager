import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getToken } from "@/lib/api";

export interface FlagDef {
  key: string;
  label: string;
  description: string;
  affectsRoles: "all" | "non-admin";
  defaultRoles: string[];
}

export const ALL_ROLES = ["admin", "sales", "data-entry"] as const;
export type AppRole = typeof ALL_ROLES[number];

export const FLAG_DEFINITIONS: FlagDef[] = [
  {
    key: "price_lookup",
    label: "Price Lookup Tool",
    description: "Shows the Price Lookup page in the sidebar and enables the /parts route.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "parts_import",
    label: "Parts Import",
    description: "Enables the Parts Import page (/parts/import) for uploading CSV and PDF price sheets.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "parts_catalog_admin",
    label: "Parts Catalog Admin",
    description: "Shows the Parts Catalog and Categories management pages in the admin section.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "reports",
    label: "Reports & Analytics",
    description: "Shows the Reports and Report Builder pages in the admin section.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "following",
    label: "Following / Watch List",
    description: "Shows the Following page where users track watched leads and customers.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "team_portal",
    label: "Team Portal & Messages",
    description: "Shows the Messages tab and gives access to team messages, updates, photos, and documents.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "direct_messages",
    label: "Direct Messages",
    description: "Enables the Direct Messages feature including the inbox, sent box, and unread badge.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "quick_entry",
    label: "Quick Entry",
    description: "Shows the Quick Entry shortcut button at the top of the sidebar for fast lead creation.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "reminders",
    label: "Personal Reminders",
    description: "Shows the Reminders page where users manage their own reminder schedule.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
  },
  {
    key: "user_guide",
    label: "User Guide",
    description: "Shows the User Guide link in the sidebar.",
    affectsRoles: "all",
    defaultRoles: ["admin", "sales", "data-entry"],
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
