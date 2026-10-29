import { cva } from "class-variance-authority";
import { Bot, Brain, Network, Regex } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Classifier, IncidentStatus, LogLevel, Severity } from "@/types";

const tone = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        critical: "border-sev-critical/30 bg-sev-critical/15 text-sev-critical",
        high: "border-sev-high/30 bg-sev-high/15 text-sev-high",
        medium: "border-sev-medium/30 bg-sev-medium/15 text-sev-medium",
        low: "border-sev-low/30 bg-sev-low/15 text-sev-low",
        unknown: "border-sev-unknown/30 bg-sev-unknown/15 text-sev-unknown",
        neutral: "border-border bg-muted text-muted-foreground",
        success: "border-success/30 bg-success/15 text-success",
        primary: "border-primary/30 bg-primary/10 text-primary",
      },
    },
  },
);

const SEV_TONE: Record<Severity, "critical" | "high" | "medium" | "low" | "unknown"> = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
  Unknown: "unknown",
};

const DOT: Record<Severity, string> = {
  Critical: "bg-sev-critical",
  High: "bg-sev-high",
  Medium: "bg-sev-medium",
  Low: "bg-sev-low",
  Unknown: "bg-sev-unknown",
};

export function SeverityDot({ severity, className }: { severity: Severity; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", DOT[severity], className)} />;
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={cn(tone({ tone: SEV_TONE[severity] }), className)}>
      <SeverityDot severity={severity} className="size-1.5" />
      {severity}
    </span>
  );
}

const LEVEL_TONE: Record<LogLevel, "critical" | "high" | "medium" | "low"> = {
  CRITICAL: "critical",
  ERROR: "high",
  WARN: "medium",
  INFO: "low",
};

export function LevelBadge({ level }: { level: LogLevel }) {
  return <span className={cn(tone({ tone: LEVEL_TONE[level] }), "font-mono")}>{level}</span>;
}

const CLASSIFIER_ICON: Record<Classifier, typeof Regex> = {
  Regex: Regex,
  "BERT+LogReg": Brain,
  DBSCAN: Network,
  LLM: Bot,
};

export function ClassifierBadge({ classifier }: { classifier: Classifier }) {
  const Icon = CLASSIFIER_ICON[classifier];
  return (
    <span className={cn(tone({ tone: classifier === "DBSCAN" ? "unknown" : "neutral" }), "normal-case tracking-normal")}>
      <Icon className="size-3" />
      {classifier}
    </span>
  );
}

const STATUS_TONE: Record<IncidentStatus, "critical" | "medium" | "success"> = {
  Open: "critical",
  Acknowledged: "medium",
  Resolved: "success",
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={cn(tone({ tone: STATUS_TONE[status] }), "normal-case tracking-normal")}>{status}</span>;
}

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "bg-success" : pct >= 60 ? "bg-sev-medium" : "bg-sev-high";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function LiveIndicator({ paused = false, label = "LIVE" }: { paused?: boolean; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest",
        paused ? "border-border text-muted-foreground" : "border-sev-critical/40 bg-sev-critical/10 text-sev-critical",
      )}
    >
      <span className={cn("size-1.5 rounded-full", paused ? "bg-muted-foreground" : "animate-pulse-dot bg-sev-critical")} />
      {paused ? "PAUSED" : label}
    </span>
  );
}
