import { Bot, Brain, Check, Network, Regex, Scissors, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ClassificationResult, PipelineStage } from "@/types";

const ICON: Record<PipelineStage, typeof Regex> = {
  Preprocessing: Scissors,
  "Regex Match": Regex,
  "BERT Embedding + Logistic Regression": Brain,
  "DBSCAN Anomaly Check": Network,
  "LLM Fallback": Bot,
};

const DECIDER: Record<ClassificationResult["classified_by"], PipelineStage> = {
  Regex: "Regex Match",
  "BERT+LogReg": "BERT Embedding + Logistic Regression",
  DBSCAN: "DBSCAN Anomaly Check",
  LLM: "LLM Fallback",
};

export function PipelineStepper({ result }: { result: ClassificationResult }) {
  const decider = DECIDER[result.classified_by];
  return (
    <ol className="grid gap-2 md:grid-cols-5">
      {result.pipeline_trace.map((step, i) => {
        const Icon = ICON[step.stage];
        const isDecider = step.stage === decider;
        const state = step.skipped ? "skipped" : isDecider ? "decider" : step.matched ? "passed" : "evaluated";
        return (
          <li
            key={step.stage}
            className={cn(
              "relative rounded-lg border p-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-1",
              state === "decider" && "border-primary bg-primary/10 shadow-glow",
              state === "passed" && "border-success/40 bg-success/5",
              state === "evaluated" && "bg-surface",
              state === "skipped" && "border-dashed opacity-45",
            )}
            style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md",
                  state === "decider" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
            </div>
            <p className="mt-2 text-xs font-semibold leading-snug">{step.stage}</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
              {state === "decider" && <span className="text-primary">● final decision</span>}
              {state === "passed" && (
                <span className="flex items-center gap-1 text-success">
                  <Check className="size-3" /> done
                </span>
              )}
              {state === "evaluated" && (
                <span className="flex items-center gap-1 text-sev-high">
                  <X className="size-3" /> no match
                </span>
              )}
              {state === "skipped" && <span className="text-muted-foreground">skipped</span>}
            </p>
            {step.score !== null && !step.skipped && (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">score {step.score.toFixed(2)}</p>
            )}
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{step.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
