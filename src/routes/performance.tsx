import { createFileRoute } from "@tanstack/react-router";
import { Crosshair, Gauge, Scale, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ClassifierBadge } from "@/components/smartlog/badges";
import { axisProps, ChartSkeleton, chartTooltipProps, KpiCard, PageHeader, Panel } from "@/components/smartlog/common";
import { Skeleton } from "@/components/ui/skeleton";
import { useModelMetrics } from "@/hooks/use-smartlog";
import { fmtCompact, fmtPct } from "@/lib/format";
import type { Classifier } from "@/types";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "Model Performance — SmartLog AI" },
      { name: "description", content: "Accuracy, precision, recall, F1, confusion matrix and hybrid vs rule-based comparison for the SmartLog AI classifier." },
      { property: "og:title", content: "Model Performance — SmartLog AI" },
      { property: "og:description", content: "How the hybrid AI classifier performs per category." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformancePage,
});

const CLASSIFIER_COLOR: Record<Classifier, string> = {
  Regex: "var(--chart-2)",
  "BERT+LogReg": "var(--chart-1)",
  DBSCAN: "var(--sev-unknown)",
  LLM: "var(--chart-4)",
};

const SHORT: Record<string, string> = {
  "Database Error": "DB",
  "API Failure": "API",
  "Login Failure": "Login",
  "Payment Issue": "Pay",
  "Security Alert": "Sec",
  "Resource Usage": "Res",
  "Workflow Error": "Flow",
  "User Action": "User",
  Unknown: "Unk",
};

function PerformancePage() {
  const { data: m } = useModelMetrics();

  const comparison = m?.comparison.map((c) => ({ ...c, f1: c.f1 * 100, false_alert_rate: c.false_alert_rate * 100 }));
  const usageTotal = m?.classifier_usage.reduce((a, b) => a + b.count, 0) ?? 0;

  return (
    <>
      <PageHeader title="Model performance" description="Evaluated on a held-out set of 3,050 labelled enterprise logs." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard loading={!m} label="Accuracy" icon={Target} value={m && fmtPct(m.accuracy)} accent="success" />
        <KpiCard loading={!m} label="Precision" icon={Crosshair} value={m && fmtPct(m.precision)} />
        <KpiCard loading={!m} label="Recall" icon={Gauge} value={m && fmtPct(m.recall)} />
        <KpiCard loading={!m} label="F1-score" icon={Scale} value={m && fmtPct(m.f1)} accent="success" hint="weighted average" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Panel title="Confusion matrix" subtitle="Rows = actual, columns = predicted" className="xl:col-span-3" bodyClassName="overflow-x-auto">
          {!m ? (
            <ChartSkeleton className="h-80" />
          ) : (
            <table className="mx-auto border-separate border-spacing-0.5 font-mono text-[10px]">
              <thead>
                <tr>
                  <th />
                  {m.confusion_matrix.labels.map((l) => (
                    <th key={l} className="px-1 pb-1 font-medium text-muted-foreground" title={l}>
                      {SHORT[l]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.confusion_matrix.matrix.map((row, i) => {
                  const total = row.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={i}>
                      <th className="whitespace-nowrap pr-2 text-right font-medium text-muted-foreground">
                        {m.confusion_matrix.labels[i]}
                      </th>
                      {row.map((v, j) => {
                        const intensity = total ? v / total : 0;
                        const diag = i === j;
                        return (
                          <td
                            key={j}
                            className="size-10 min-w-10 rounded text-center tabular-nums transition-transform hover:scale-110 sm:size-11"
                            style={{
                              background: diag
                                ? `color-mix(in oklab, var(--primary) ${Math.round(15 + intensity * 85)}%, var(--muted))`
                                : v
                                  ? `color-mix(in oklab, var(--sev-critical) ${Math.round(20 + intensity * 400)}%, var(--muted))`
                                  : "var(--muted)",
                              color: diag && intensity > 0.5 ? "var(--primary-foreground)" : "var(--foreground)",
                            }}
                            title={`Actual ${m.confusion_matrix.labels[i]} → predicted ${m.confusion_matrix.labels[j]}: ${v}`}
                          >
                            {v || ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Per-class metrics" className="xl:col-span-2" bodyClassName="p-0 overflow-x-auto">
          {!m ? (
            <div className="space-y-2 p-4">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-7" />)}</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Category</th>
                  <th className="px-2 py-2 text-right font-medium">Prec</th>
                  <th className="px-2 py-2 text-right font-medium">Recall</th>
                  <th className="px-2 py-2 text-right font-medium">F1</th>
                  <th className="px-4 py-2 text-right font-medium">Support</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {m.per_class.map((c) => (
                  <tr key={c.category} className="hover:bg-muted/40">
                    <td className="px-4 py-2 font-sans">{c.category}</td>
                    <td className="px-2 py-2 text-right">{c.precision.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{c.recall.toFixed(2)}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${c.f1 >= 0.9 ? "text-success" : c.f1 >= 0.85 ? "text-sev-medium" : "text-sev-high"}`}>
                      {c.f1.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{c.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Approach comparison" subtitle="F1-score vs false-alert rate (%)">
          {!comparison ? (
            <ChartSkeleton />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison} margin={{ left: -18, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="approach" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip {...chartTooltipProps} formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="f1" name="F1-score" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="false_alert_rate" name="False-alert rate" fill="var(--sev-critical)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Classifier usage" subtitle="Which stage resolved each log">
          {!m ? (
            <ChartSkeleton />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={m.classifier_usage} dataKey="count" nameKey="classifier" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="var(--card)">
                      {m.classifier_usage.map((u) => <Cell key={u.classifier} fill={CLASSIFIER_COLOR[u.classifier]} />)}
                    </Pie>
                    <Tooltip {...chartTooltipProps} formatter={(v: number) => fmtCompact(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-3">
                {m.classifier_usage.map((u) => {
                  const pct = usageTotal ? u.count / usageTotal : 0;
                  return (
                    <li key={u.classifier}>
                      <div className="flex items-center justify-between text-xs">
                        <ClassifierBadge classifier={u.classifier} />
                        <span className="font-mono text-muted-foreground">
                          {fmtCompact(u.count)} · {fmtPct(pct)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: CLASSIFIER_COLOR[u.classifier] }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
