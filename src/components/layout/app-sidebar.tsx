import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  FlaskConical,
  Gauge,
  Info,
  LayoutDashboard,
  ScatterChart,
  ShieldAlert,
  Upload,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { USE_MOCK } from "@/lib/api";

const monitor = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Live Monitor", url: "/live", icon: Activity },
  { title: "Incidents", url: "/incidents", icon: ShieldAlert },
  { title: "Anomaly Explorer", url: "/anomalies", icon: ScatterChart },
] as const;

const intelligence = [
  { title: "Classify Log", url: "/classify", icon: FlaskConical },
  { title: "Upload Logs", url: "/upload", icon: Upload },
  { title: "Model Performance", url: "/performance", icon: Gauge },
  { title: "About", url: "/about", icon: Info },
] as const;

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });

  const renderGroup = (label: string, items: readonly { title: string; url: string; icon: typeof Info }[]) => (
    <SidebarGroup>
      <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={path === item.url} tooltip={item.title}>
                <Link to={item.url} onClick={() => setOpenMobile(false)}>
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5 px-1 py-1.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-primary font-mono text-sm font-bold text-primary-foreground shadow-glow">
            SL
          </span>
          {!collapsed && (
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">SmartLog AI</p>
              <p className="font-mono text-[10px] text-muted-foreground">hybrid incident intel</p>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Monitor", monitor)}
        {renderGroup("Intelligence", intelligence)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/50 p-2.5 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-sidebar-foreground">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-success" />
              Pipeline healthy
            </p>
            <p className="mt-0.5 font-mono">{USE_MOCK ? "mock data mode" : "connected to API"}</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
