import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FlaskConical, Lightbulb, ListChecks, Loader2, Radar, Sparkles, Zap } from "lucide-react";
import { useState } from "react";

import { ClassifierBadge, ConfidenceBar, SeverityBadge } from "@/components/smartlog/badges";
import { EmptyState, PageHeader, Panel } from "@/components/smartlog/common";
import { PipelineStepper } from "@/components/smartlog/pipeline-stepper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useClassifyLog } from "@/hooks/use-smartlog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/classify")({
  head: () => ({
    meta: [
      { title: "Classify a Log — SmartLog AI" },
      { name: "description", content: "Paste any raw log line and watch the hybrid Regex → BERT → DBSCAN → LLM pipeline classify it with an explanation." },
      { property: "og:title", content: "Classify a Log — SmartLog AI" },
      { property: "og:description", content: "Try the hybrid AI log classification pipeline live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassifyPage,
});

const EXAMPLES = [
  { label: "DB timeout", hint: "Regex", text: "ERROR Connection to DB timed out after 30s" },
  { label: "Brute-force login", hint: "Regex", text: "Failed login attempt from 192.168.4.22 x5" },
  {
    label: "Hadoop RM error",
    hint: "BERT",
    text: "2015-10-18 18:07:56,238 ERROR [RMCommunicator Allocator] org.apache.hadoop.mapreduce.v2.app.rm.RMContainerAllocator: ERROR IN CONTACTING RM.",
  },
  { label: "Payment gateway", hint: "BERT", text: "CRITICAL Payment gateway returned 502 for invoice INV-20931, retrying" },
  {
    label: "CRM escalation",
    hint: "LLM",
    text: "Escalation rule execution failed for ticket ID 9807 - undefined escalation level.",
  },
  {
    label: "Unknown anomaly",
    hint: "DBSCAN",
    text: "WARN Checksum drift on shard ζ-7: entropy pool exhausted, quorum vote inconclusive",
  },
];

function ClassifyPage() {
  const [text, setText] = useState("");
  const classify = useClassifyLog();
  const r = classify.data;

  const run = (value = text) => {
    if (!value.trim()) return;
    classify.mutate(value);
  };

  return (
    <>
      <PageHeader
        title="Classify a log line"
        description="Paste any raw log. SmartLog AI tries cheap, precise rules first and only escalates to heavier models when needed."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Raw log input" className="lg:col-span-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            placeholder="e.g. 2026-10-29 18:07:56,238 ERROR [main] Connection refused to billing-db:5432"
            className="min-h-40 resize-y bg-surface font-mono text-xs leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] text-muted-foreground">{text.length} chars · Ctrl/⌘ + Enter to run</p>
            <div className="flex gap-2">
              {text && (
                <Button variant="ghost" size="sm" onClick={() => { setText(""); classify.reset(); }}>
                  Clear
                </Button>
              )}
              <Button onClick={() => run()} disabled={!text.trim() || classify.isPending} className="min-w-32">
                {classify.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {classify.isPending ? "Classifying…" : "Classify"}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Try an example" subtitle="Each one exercises a different stage" className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => {
                  setText(ex.text);
                  run(ex.text);
                }}
                disabled={classify.isPending}
                className={cn(
                  "group rounded-md border bg-surface p-2.5 text-left transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50",
                  text === ex.text && "border-primary/60",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{ex.label}</span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground group-hover:text-primary">{ex.hint}</span>
                </span>
                <span className="mt-1 line-clamp-2 block font-mono text-[10px] text-muted-foreground">{ex.text}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Classification pipeline" className="mt-4" subtitle={r ? `Decided in ${r.latency_ms} ms` : undefined}>
        {classify.isPending ? (
          <div className="grid gap-2 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : r ? (
          <PipelineStepper result={r} />
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="Run a classification"
            description="Preprocessing → Regex → BERT + Logistic Regression → DBSCAN → LLM fallback. The stage that makes the decision lights up."
          />
        )}
      </Panel>

      {r && !classify.isPending && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel title="Result">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Predicted category</p>
                <p className="mt-1 font-display text-2xl font-semibold">{r.category}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <SeverityBadge severity={r.severity} />
                <ClassifierBadge classifier={r.classified_by} />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Confidence</p>
                <ConfidenceBar value={r.confidence} />
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border p-2.5 text-sm",
                  r.is_known ? "border-success/40 bg-success/10 text-success" : "border-sev-unknown/40 bg-sev-unknown/10 text-sev-unknown",
                )}
              >
                {r.is_known ? <CheckCircle2 className="size-4" /> : <Radar className="size-4" />}
                {r.is_known ? "Known incident pattern" : "Unknown anomaly — flagged for review"}
              </div>
            </div>
          </Panel>

          <Panel title="Cleaned / normalized text">
            <pre className="whitespace-pre-wrap break-all rounded-md border border-dashed bg-surface p-3 font-mono text-xs leading-relaxed">
              {r.cleaned_text}
            </pre>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Zap className="size-3" /> Timestamps stripped; IPs, IDs, emails and numbers masked before embedding.
            </p>
          </Panel>

          <Panel title="AI explanation">
            <p className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
              {r.explanation}
            </p>
            <p className="mb-2 mt-4 flex items-center gap-2 text-xs font-semibold">
              <ListChecks className="size-4 text-success" /> Suggested remediation
            </p>
            <ul className="space-y-1.5">
              {r.remediation.map((x) => (
                <li key={x} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                  {x}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
