import { createFileRoute } from "@tanstack/react-router";
import { Radar, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

import { ChartSkeleton, EmptyState, PageHeader, Panel, axisProps } from "@/components/smartlog/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnomalyClusters, useLabelCluster } from "@/hooks/use-smartlog";
import { CATEGORY_COLOR, KNOWN_CATEGORIES } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { AnomalyCluster, AnomalyPoint, Category } from "@/types";

export const Route = createFileRoute("/anomalies")({
  head: () => ({
    meta: [
      { title: "Anomaly Explorer — SmartLog AI" },
      { name: "description", content: "Explore DBSCAN clusters of log embeddings, inspect unknown anomalies and label new clusters to teach the model." },
      { property: "og:title", content: "Anomaly Explorer — SmartLog AI" },
      { property: "og:description", content: "Visualise log embedding clusters and label unknown anomalies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnomalyExplorer,
});

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: AnomalyPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="max-w-xs rounded-md border bg-popover p-2.5 text-xs shadow-lg">
      <p className="mb-1 font-semibold" style={{ color: p.is_noise ? "var(--sev-critical)" : CATEGORY_COLOR[p.category] }}>
        {p.is_noise ? "Noise · unknown anomaly" : p.category === "Unknown" ? `Unknown cluster ${p.cluster}` : p.category}
      </p>
      <p className="break-all font-mono text-[11px] text-muted-foreground">{p.message}</p>
    </div>
  );
}

function AnomalyExplorer() {
  const { data, isLoading } = useAnomalyClusters();
  const [labeling, setLabeling] = useState<AnomalyCluster | null>(null);
  const [choice, setChoice] = useState<Category | "">("");
  const label = useLabelCluster();

  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { key: string; name: string; color: string; points: AnomalyPoint[] }>();
    for (const p of data.points) {
      const key = p.is_noise ? "noise" : p.category === "Unknown" ? "unknown" : p.category;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: key === "noise" ? "Noise (unknown)" : key === "unknown" ? "Unlabelled clusters" : key,
          color: key === "noise" ? "var(--sev-critical)" : key === "unknown" ? "var(--sev-unknown)" : CATEGORY_COLOR[p.category],
          points: [],
        });
      }
      map.get(key)!.points.push(p);
    }
    return [...map.values()];
  }, [data]);

  const submit = () => {
    if (!labeling || !choice) return;
    label.mutate(
      { clusterId: labeling.id, category: choice },
      { onSuccess: () => { setLabeling(null); setChoice(""); } },
    );
  };

  return (
    <>
      <PageHeader
        title="Anomaly explorer"
        description="A 2D projection of log embeddings. DBSCAN groups similar logs; points far from every cluster are flagged as unknown anomalies."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Embedding space (t-SNE projection)" subtitle="Hover a point to see its log line" className="xl:col-span-2">
          {isLoading || !data ? (
            <ChartSkeleton className="h-[460px]" />
          ) : (
            <>
              <div className="h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" domain={[-100, 100]} {...axisProps} name="dim 1" />
                    <YAxis type="number" dataKey="y" domain={[-90, 90]} {...axisProps} name="dim 2" />
                    <ZAxis range={[36, 36]} />
                    <Tooltip content={<PointTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }} />
                    {groups.map((g) => (
                      <Scatter
                        key={g.key}
                        name={g.name}
                        data={g.points}
                        fill={g.color}
                        fillOpacity={g.key === "noise" ? 0.95 : 0.7}
                        shape={g.key === "noise" ? "cross" : "circle"}
                        isAnimationActive={false}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                {groups.map((g) => (
                  <span key={g.key} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: g.color }} />
                    {g.name} <span className="font-mono">({g.points.length})</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Unknown anomaly clusters" subtitle="Human feedback improves future classification">
          {isLoading || !data ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : data.clusters.length === 0 ? (
            <EmptyState icon={Radar} title="No unknown clusters" description="Every log maps to a known category right now." />
          ) : (
            <ul className="space-y-3">
              {data.clusters.map((c) => (
                <li key={c.id} className="rounded-lg border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] text-sev-unknown">{c.id}</p>
                      <p className="text-sm font-semibold">{c.label}</p>
                      <p className="text-[11px] text-muted-foreground">{c.count} logs · first seen {timeAgo(c.first_seen)}</p>
                    </div>
                    {c.labeled_as ? (
                      <span className="rounded-md border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] text-success">
                        {c.labeled_as}
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { setLabeling(c); setChoice(""); }}>
                        <Tag className="size-3.5" /> Label
                      </Button>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {c.samples.slice(0, 2).map((s) => (
                      <li key={s} className="truncate rounded bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground" title={s}>
                        {s}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={!!labeling} onOpenChange={(o) => !o && setLabeling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Label cluster {labeling?.id}</DialogTitle>
            <DialogDescription>
              Assign a category to these {labeling?.count} logs. They become training examples for the next model update.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 rounded-md border bg-surface p-3">
            {labeling?.samples.map((s) => (
              <p key={s} className="break-all font-mono text-[11px] text-muted-foreground">{s}</p>
            ))}
          </div>
          <Select value={choice} onValueChange={(v) => setChoice(v as Category)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLabeling(null)}>Cancel</Button>
            <Button onClick={submit} disabled={!choice || label.isPending}>
              {label.isPending ? "Saving…" : "Save label"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
