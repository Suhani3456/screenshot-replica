import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, AlertOctagon, ArrowRight, Database, Radar, Timer, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LiveIndicator, SeverityBadge, SeverityDot } from "@/components/smartlog/badges";
import { axisProps, ChartSkeleton, chartTooltipProps, KpiCard, PageHeader, Panel } from "@/components/smartlog/common";
import { IncidentDrawer } from "@/components/smartlog/incident-drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useIncidentsTimeSeries, useLogStream, useRecentLogs } from "@/hooks/use-smartlog";
import { CATEGORY_COLOR, SEVERITY_COLOR, SOURCE_COLOR } from "@/lib/constants";
import { fmtCompact, fmtHour, fmtNumber, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SmartLog AI" },
      { name: "description", content: "Real-time overview of logs processed, incidents detected and anomalies across CRM, HRMS, Billing, Cloud and Server systems." },
      { property: "og:title", content: "Dashboard — SmartLog AI" },
      { property: "og:description", content: "Real-time incident and anomaly overview across enterprise systems." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const stats = useDashboardStats();
  const series = useIncidentsTimeSeries();
  const recent = useRecentLogs(60);
  const initial = useMemo(() => (recent.data ?? []).filter((l) => l.level !== "INFO"), [recent.data]);
  const stream = useLogStream({ initial, max: 40 });
  const feed = stream.logs.filter((l) => l.level !== "INFO" || l.category === "Unknown").slice(0, 10);
  const [openId, setOpenId] = useState<string | null>(null);
  const s = stats.data;

  const sevTotal = s?.by_severity.reduce((a, b) => a + b.count, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Operations overview"
        description="Hybrid AI classification across all connected enterprise systems in the last 24 hours."
        actions={<LiveIndicator />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard loading={!s} label="Total Logs Processed" icon={Database} value={s && fmtCompact(s.total_logs)} hint={s && `${fmtNumber(s.total_logs)} lines`} />
        <KpiCard loading={!s} label="Incidents Detected" icon={Activity} accent="medium" value={s && fmtNumber(s.incidents)} hint="last 24h" />
        <KpiCard loading={!s} label="Critical Incidents" icon={AlertOctagon} accent="critical" value={s && fmtNumber(s.critical)} hint="needs immediate action" />
        <KpiCard loading={!s} label="Unknown Anomalies" icon={Radar} accent="unknown" value={s && fmtNumber(s.unknown_anomalies)} hint="DBSCAN noise points" />
        <KpiCard loading={!s} label="Avg Detection Time" icon={Timer} accent="success" value={s && `${s.avg_detection_ms} ms`} hint="ingest → classified" />
        <KpiCard loading={!s} label="False Alert Rate" icon={TrendingDown} accent="success" value={s && `${s.false_alert_rate}%`} hint="−10.4 pts vs rules only" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Incidents over time" subtitle="Hourly, last 24h" className="xl:col-span-2">
          {series.data ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series.data} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCrit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--sev-critical)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--sev-critical)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tickFormatter={fmtHour} {...axisProps} interval={3} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...chartTooltipProps} labelFormatter={(v) => fmtHour(String(v))} />
                  <Area type="monotone" dataKey="incidents" name="Incidents" stroke="var(--primary)" strokeWidth={2} fill="url(#gInc)" />
                  <Area type="monotone" dataKey="critical" name="Critical" stroke="var(--sev-critical)" strokeWidth={2} fill="url(#gCrit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartSkeleton />
          )}
        </Panel>

        <Panel title="By category" subtitle="Share of incidents">
          {s ? (
            <div className="flex flex-col items-center gap-3 sm:flex-row xl:flex-col 2xl:flex-row">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={s.by_category.filter((c) => c.count)} dataKey="count" nameKey="category" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="var(--card)">
                      {s.by_category.filter((c) => c.count).map((c) => (
                        <Cell key={c.category} fill={CATEGORY_COLOR[c.category]} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltipProps} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-1">
                {s.by_category.map((c) => (
                  <li key={c.category} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-sm" style={{ background: CATEGORY_COLOR[c.category] }} />
                      <span className="truncate text-muted-foreground">{c.category}</span>
                    </span>
                    <span className="font-mono tabular-nums">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ChartSkeleton className="h-48" />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Panel title="By source system">
            {s ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.by_source} margin={{ left: -18, right: 8, top: 4 }}>
                    <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="source" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip {...chartTooltipProps} />
                    <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]}>
                      {s.by_source.map((x) => (
                        <Cell key={x.source} fill={SOURCE_COLOR[x.source]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartSkeleton className="h-48" />
            )}
          </Panel>

          <Panel title="Severity distribution">
            {s ? (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {s.by_severity.map((x) =>
                    x.count ? (
                      <div
                        key={x.severity}
                        className="h-full transition-all duration-500"
                        style={{ width: `${(x.count / sevTotal) * 100}%`, background: SEVERITY_COLOR[x.severity] }}
                        title={`${x.severity}: ${x.count}`}
                      />
                    ) : null,
                  )}
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                  {s.by_severity.map((x) => (
                    <div key={x.severity}>
                      <p className="font-mono text-sm font-semibold tabular-nums">{x.count}</p>
                      <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                        <SeverityDot severity={x.severity} className="size-1.5" />
                        {x.severity}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Skeleton className="h-12 w-full" />
            )}
          </Panel>
        </div>

        <Panel
          title="Live incident feed"
          subtitle="Latest 10 incidents, streaming"
          className="xl:col-span-2"
          bodyClassName="p-0"
          actions={
            <>
              <LiveIndicator />
              <Link to="/live" className="hidden items-center gap-1 text-xs text-primary hover:underline sm:inline-flex">
                Open monitor <ArrowRight className="size-3" />
              </Link>
            </>
          }
        >
          {feed.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {feed.map((l, i) => (
                <li key={l.id} className={cn(i === 0 && "animate-slide-in")}>
                  <button
                    onClick={() => setOpenId(l.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="hidden w-16 shrink-0 font-mono text-[11px] text-muted-foreground sm:block">{fmtTime(l.timestamp)}</span>
                    <SeverityBadge severity={l.severity} className="w-[86px] justify-center" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs">{l.message}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {l.source} · {l.category} · {l.classified_by}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <IncidentDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
