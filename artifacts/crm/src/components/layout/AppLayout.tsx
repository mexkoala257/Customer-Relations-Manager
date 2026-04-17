import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";
import { useAppSettings } from "@/contexts/app-settings";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { settings } = useAppSettings();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0 print:hidden">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden print:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden print:hidden transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setMobileOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden print:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-bold text-sm">{settings.companyName}</div>
          <div className="w-9" />
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
          <div className="px-6 py-3 text-center text-[11px] text-muted-foreground/50 select-none print:hidden">
            Developed and Implemented by: DoodleWorks LLC
          </div>
        </main>
      </div>
    </div>
  );
}
