import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ClassifierBadge,
  ConfidenceBar,
  LevelBadge,
  LiveIndicator,
  SeverityBadge,
} from "@/components/smartlog/badges";
import { EmptyState, PageHeader } from "@/components/smartlog/common";
import { FilterSelect } from "@/components/smartlog/filter-select";
import { IncidentDrawer } from "@/components/smartlog/incident-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogStream, useRecentLogs } from "@/hooks/use-smartlog";
import { CATEGORIES, LEVELS, SEVERITIES, SOURCES } from "@/lib/constants";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, LogLevel, Severity, SourceSystem } from "@/types";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Monitor — SmartLog AI" },
      { name: "description", content: "Real-time scrolling log stream with level, source, category and severity filters and instant AI classification." },
      { property: "og:title", content: "Live Monitor — SmartLog AI" },
      { property: "og:description", content: "Watch enterprise logs get classified in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveMonitor,
});

function LiveMonitor() {
  const recent = useRecentLogs(120);
  const stream = useLogStream({ initial: recent.data ?? [], max: 300 });
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [source, setSource] = useState<SourceSystem | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return stream.logs.filter(
      (l) =>
        (level === "all" || l.level === level) &&
        (source === "all" || l.source === source) &&
        (category === "all" || l.category === category) &&
        (severity === "all" || l.severity === severity) &&
        (!q || l.message.toLowerCase().includes(q)),
    );
  }, [stream.logs, level, source, category, severity, search]);

  const filtersActive = level !== "all" || source !== "all" || category !== "all" || severity !== "all" || !!search;

  return (
    <>
      <PageHeader
        title="Live monitor"
        description="Every log line is classified the moment it arrives. Click any row for full incident details."
        actions={
          <>
            <LiveIndicator paused={stream.paused} />
            <Button variant={stream.paused ? "default" : "outline"} size="sm" onClick={stream.toggle}>
              {stream.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {stream.paused ? `Resume${stream.missed ? ` (+${stream.missed})` : ""}` : "Pause stream"}
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-card p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search raw log messages…"
            className="h-9 pl-8 font-mono text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <FilterSelect label="Levels" value={level} options={LEVELS} onChange={setLevel} className="sm:w-[120px]" />
          <FilterSelect label="Sources" value={source} options={SOURCES} onChange={setSource} className="sm:w-[120px]" />
          <FilterSelect label="Categories" value={category} options={CATEGORIES} onChange={setCategory} />
          <FilterSelect label="Severities" value={severity} options={SEVERITIES} onChange={setSeverity} className="sm:w-[130px]" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-2 font-mono text-[11px] text-muted-foreground">
          <span>
            showing {rows.length} of {stream.logs.length} buffered lines
          </span>
          <span className="hidden sm:inline">auto-classified · newest first</span>
        </div>
        <div className="max-h-[calc(100vh-300px)] min-h-[420px] overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Timestamp</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
                <th className="px-3 py-2.5 font-medium">Level</th>
                <th className="px-3 py-2.5 font-medium">Raw log message</th>
                <th className="px-3 py-2.5 font-medium">Category</th>
                <th className="px-3 py-2.5 font-medium">Severity</th>
                <th className="px-3 py-2.5 font-medium">Confidence</th>
                <th className="px-4 py-2.5 font-medium">Classified by</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-2">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))}
              {rows.map((l, i) => (
                <tr
                  key={l.id}
                  onClick={() => setOpenId(l.id)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    i === 0 && !stream.paused && "animate-slide-in",
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-muted-foreground">{fmtTime(l.timestamp)}</td>
                  <td className="px-3 py-2 font-medium">{l.source}</td>
                  <td className="px-3 py-2">
                    <LevelBadge level={l.level} />
                  </td>
                  <td className="max-w-[420px] px-3 py-2">
                    <p className="truncate font-mono" title={l.message}>
                      {l.message}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{l.category}</td>
                  <td className="px-3 py-2">
                    <SeverityBadge severity={l.severity} />
                  </td>
                  <td className="w-32 px-3 py-2">
                    <ConfidenceBar value={l.confidence} />
                  </td>
                  <td className="px-4 py-2">
                    <ClassifierBadge classifier={l.classified_by} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recent.isLoading && rows.length === 0 && (
            <EmptyState
              icon={SearchX}
              title={filtersActive ? "No logs match these filters" : "Waiting for logs…"}
              description={filtersActive ? "Try clearing a filter or widening your search." : "New lines will appear here as they stream in."}
            />
          )}
        </div>
      </div>

      <IncidentDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
