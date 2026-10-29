import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, FilterX, Loader2, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ClassifierBadge, ConfidenceBar, SeverityBadge, StatusBadge } from "@/components/smartlog/badges";
import { EmptyState, PageHeader } from "@/components/smartlog/common";
import { FilterSelect } from "@/components/smartlog/filter-select";
import { IncidentDrawer } from "@/components/smartlog/incident-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIncidents } from "@/hooks/use-smartlog";
import { listIncidents } from "@/lib/api";
import { CATEGORIES, SEVERITIES, SOURCES, STATUSES } from "@/lib/constants";
import { downloadText, fmtDateTime, incidentsToCsv } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IncidentFilters } from "@/types";

export const Route = createFileRoute("/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents — SmartLog AI" },
      { name: "description", content: "Search, filter, sort and triage classified incidents through Open, Acknowledged and Resolved states, with CSV export." },
      { property: "og:title", content: "Incidents — SmartLog AI" },
      { property: "og:description", content: "Triage AI-classified incidents across enterprise systems." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IncidentsPage,
});

type SortKey = NonNullable<IncidentFilters["sortBy"]>;
const DEFAULT: IncidentFilters = { severity: "all", category: "all", source: "all", status: "all", search: "", from: "", to: "", sortBy: "timestamp", sortDir: "desc" };

function IncidentsPage() {
  const [filters, setFilters] = useState<IncidentFilters>(DEFAULT);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { data, isLoading, isFetching, isError, error, refetch } = useIncidents(filters, page);

  const set = <K extends keyof IncidentFilters>(k: K, v: IncidentFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const sort = (key: SortKey) =>
    setFilters((f) => ({
      ...f,
      sortBy: key,
      sortDir: f.sortBy === key && f.sortDir === "desc" ? "asc" : "desc",
    }));

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await listIncidents({ ...filters, pageSize: 100_000 }, 1);
      downloadText(`smartlog-incidents-${new Date().toISOString().slice(0, 10)}.csv`, incidentsToCsv(all.items));
      toast.success(`Exported ${all.items.length} incidents`);
    } catch (e) {
      toast.error("Export failed", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2.5 font-medium", className)}>
      <button onClick={() => sort(k)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground">
        {children}
        {filters.sortBy === k ? (
          filters.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Incidents"
        description="All classified incidents. Move them through Open → Acknowledged → Resolved from the detail drawer."
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export CSV
          </Button>
        }
      />

      <div className="mb-3 space-y-2 rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Search by message, ID or category…" className="h-9 pl-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <FilterSelect label="Severities" value={filters.severity ?? "all"} options={SEVERITIES} onChange={(v) => set("severity", v)} className="sm:w-[130px]" />
            <FilterSelect label="Categories" value={filters.category ?? "all"} options={CATEGORIES} onChange={(v) => set("category", v)} />
            <FilterSelect label="Sources" value={filters.source ?? "all"} options={SOURCES} onChange={(v) => set("source", v)} className="sm:w-[120px]" />
            <FilterSelect label="Statuses" value={filters.status ?? "all"} options={STATUSES} onChange={(v) => set("status", v)} className="sm:w-[140px]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>From</span>
          <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className="h-8 w-[150px] text-xs" />
          <span>to</span>
          <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className="h-8 w-[150px] text-xs" />
          <Button variant="ghost" size="sm" onClick={() => { setFilters(DEFAULT); setPage(1); }} className="ml-auto">
            <FilterX className="size-4" /> Reset filters
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-xs">
            <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">ID</th>
                <SortHead k="timestamp">Time</SortHead>
                <SortHead k="source">Source</SortHead>
                <th className="px-3 py-2.5 font-medium">Message</th>
                <SortHead k="category">Category</SortHead>
                <SortHead k="severity">Severity</SortHead>
                <SortHead k="confidence">Confidence</SortHead>
                <th className="px-3 py-2.5 font-medium">Classifier</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y transition-opacity", isFetching && !isLoading && "opacity-60")}>
              {isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-2">
                      <Skeleton className="h-7 w-full" />
                    </td>
                  </tr>
                ))}
              {data?.items.map((i) => (
                <tr key={i.id} onClick={() => setOpenId(i.id)} className="cursor-pointer transition-colors hover:bg-muted/50">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-primary">{i.id}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-muted-foreground">{fmtDateTime(i.timestamp)}</td>
                  <td className="px-3 py-2.5 font-medium">{i.source}</td>
                  <td className="max-w-[340px] px-3 py-2.5">
                    <p className="truncate font-mono" title={i.message}>{i.message}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{i.category}</td>
                  <td className="px-3 py-2.5"><SeverityBadge severity={i.severity} /></td>
                  <td className="w-32 px-3 py-2.5"><ConfidenceBar value={i.confidence} /></td>
                  <td className="px-3 py-2.5"><ClassifierBadge classifier={i.classified_by} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isError && (
          <EmptyState title="Could not load incidents" description={(error as Error).message} action={<Button size="sm" onClick={() => refetch()}>Retry</Button>} />
        )}
        {data && data.items.length === 0 && (
          <EmptyState icon={ShieldCheck} title="No incidents match" description="Nothing fits these filters. Try widening the date range or resetting filters." />
        )}
        {data && data.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground sm:flex-row">
            <span>
              {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total} incidents
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <span className="px-2 font-mono">{page} / {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <IncidentDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
