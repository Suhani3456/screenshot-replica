import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, Bot, Brain, Database, GraduationCap, Network, Regex, Scissors, ShieldAlert } from "lucide-react";

import { PageHeader, Panel } from "@/components/smartlog/common";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — SmartLog AI" },
      { name: "description", content: "SmartLog AI: Intelligent Incident Classification using Hybrid AI for Enterprise Log Monitoring — a project from RV College of Engineering." },
      { property: "og:title", content: "About SmartLog AI" },
      { property: "og:description", content: "Hybrid Regex, BERT, DBSCAN and LLM pipeline for enterprise log incident classification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const STAGES = [
  { icon: Database, title: "Log ingestion", desc: "CRM · HRMS · Billing · Cloud · Server", tone: "neutral" },
  { icon: Scissors, title: "Preprocessing", desc: "Strip timestamps, mask IPs / IDs / numbers", tone: "neutral" },
  { icon: Regex, title: "Regex rules", desc: "Fast, precise matching of known signatures", tone: "primary" },
  { icon: Brain, title: "BERT + LogReg", desc: "Sentence embeddings → logistic regression", tone: "primary" },
  { icon: Network, title: "DBSCAN", desc: "Density clustering flags unknown anomalies", tone: "unknown" },
  { icon: Bot, title: "LLM fallback", desc: "Reasons over rare, context-heavy logs", tone: "medium" },
] as const;

const STACK = [
  "React 19", "TypeScript", "TanStack Start", "TanStack Query", "Tailwind CSS", "shadcn/ui", "Recharts",
  "Python", "FastAPI", "Sentence-BERT", "scikit-learn", "DBSCAN", "LLM (Groq / Llama)", "WebSockets",
];

function AboutPage() {
  return (
    <>
      <PageHeader title="About the project" />

      <section className="relative overflow-hidden rounded-xl border bg-card bg-grid p-6 sm:p-10">
        <div className="relative max-w-3xl">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary">
            <GraduationCap className="size-4" /> RV College of Engineering · Bengaluru
          </p>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-4xl">
            <span className="text-gradient-primary">SmartLog AI:</span> Intelligent Incident Classification using Hybrid AI for Enterprise Log Monitoring
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Enterprise systems produce millions of log lines a day. Rule-based alerting is precise but brittle; pure ML is
            flexible but expensive and opaque. SmartLog AI layers both — cheap rules first, learned models next, density-based
            anomaly detection for the unseen, and an LLM only when nothing else can decide.
          </p>
        </div>
      </section>

      <Panel title="Hybrid pipeline architecture" className="mt-4">
        <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
          {STAGES.map((s, i) => (
            <div key={s.title} className="flex flex-col items-center gap-2 lg:flex-1 lg:flex-row">
              <div
                className={cn(
                  "w-full rounded-lg border p-3 text-center transition-colors",
                  s.tone === "primary" && "border-primary/40 bg-primary/5",
                  s.tone === "unknown" && "border-sev-unknown/40 bg-sev-unknown/5",
                  s.tone === "medium" && "border-sev-medium/40 bg-sev-medium/5",
                  s.tone === "neutral" && "bg-surface",
                )}
              >
                <s.icon
                  className={cn(
                    "mx-auto size-5",
                    s.tone === "primary" && "text-primary",
                    s.tone === "unknown" && "text-sev-unknown",
                    s.tone === "medium" && "text-sev-medium",
                    s.tone === "neutral" && "text-muted-foreground",
                  )}
                />
                <p className="mt-2 text-xs font-semibold">{s.title}</p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{s.desc}</p>
              </div>
              {i < STAGES.length - 1 && (
                <>
                  <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
                  <ArrowDown className="size-4 shrink-0 text-muted-foreground lg:hidden" />
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <ShieldAlert className="size-4 text-sev-critical" />
          Output: category · severity · confidence · explanation · remediation → dashboard, alerts & human feedback loop
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Tech stack">
          <div className="flex flex-wrap gap-2">
            {STACK.map((t) => (
              <span key={t} className="rounded-md border bg-surface px-2.5 py-1 font-mono text-[11px]">{t}</span>
            ))}
          </div>
        </Panel>
        <Panel title="Why hybrid?">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="font-medium text-foreground">~42 ms</span> average detection — most logs never reach the heavy models.</li>
            <li><span className="font-medium text-foreground">3.8%</span> false-alert rate vs 14.2% with rules alone.</li>
            <li><span className="font-medium text-foreground">Self-learning:</span> labelled anomaly clusters feed back into training.</li>
          </ul>
        </Panel>
      </div>

      <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground">
        Department of Computer Science & Engineering · RV College of Engineering, Bengaluru
      </p>
    </>
  );
}
