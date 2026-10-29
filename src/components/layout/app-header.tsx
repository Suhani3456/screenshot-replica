import { useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/use-theme";
import { USE_MOCK } from "@/lib/api";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/live": "Live Monitor",
  "/classify": "Classify Log",
  "/incidents": "Incidents",
  "/anomalies": "Anomaly Explorer",
  "/performance": "Model Performance",
  "/upload": "Upload Logs",
  "/about": "About",
};

export function AppHeader() {
  const { theme, toggle } = useTheme();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-md sm:px-5">
      <SidebarTrigger />
      <div className="h-5 w-px bg-border" />
      <nav className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <span className="hidden sm:inline">smartlog</span>
        <span className="hidden sm:inline">/</span>
        <span className="truncate text-foreground">{TITLES[path] ?? "Page"}</span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          <span className={USE_MOCK ? "size-1.5 rounded-full bg-sev-medium" : "size-1.5 rounded-full bg-success"} />
          {USE_MOCK ? "MOCK API" : "LIVE API"}
        </span>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle light and dark theme">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
