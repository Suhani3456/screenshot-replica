import { AlertTriangle, Lightbulb, ListChecks } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIncident, useUpdateIncidentStatus } from "@/hooks/use-smartlog";
import { STATUSES } from "@/lib/constants";
import { fmtDateTime, fmtTime } from "@/lib/format";
import type { IncidentStatus } from "@/types";
import {
  ClassifierBadge,
  ConfidenceBar,
  LevelBadge,
  SeverityBadge,
  SeverityDot,
  StatusBadge,
} from "./badges";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function IncidentDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading, isError, error } = useIncident(id);
  const update = useUpdateIncidentStatus();

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-mono text-base">
            {data && <SeverityDot severity={data.severity} />}
            {id}
          </SheetTitle>
          <SheetDescription>
            {data ? `${data.source} · ${fmtDateTime(data.timestamp)}` : "Loading incident details"}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {isError && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {data && (
          <div className="mt-6 space-y-6 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={data.severity} />
              <LevelBadge level={data.level} />
              <ClassifierBadge classifier={data.classified_by} />
              <StatusBadge status={data.status} />
            </div>

            <Field label="Raw log">
              <pre className="whitespace-pre-wrap break-all rounded-md border bg-surface p-3 font-mono text-xs leading-relaxed">
                {data.message}
              </pre>
            </Field>
            <Field label="Normalized log">
              <pre className="whitespace-pre-wrap break-all rounded-md border border-dashed bg-surface/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {data.normalized}
              </pre>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">{data.category}</Field>
              <Field label="Source system">{data.source}</Field>
              <Field label="Confidence">
                <ConfidenceBar value={data.confidence} />
              </Field>
              <Field label="Status">
                <Select
                  value={data.status}
                  onValueChange={(v) => update.mutate({ id: data.id, status: v as IncidentStatus })}
                  disabled={update.isPending}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="rounded-lg border bg-primary/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4 text-primary" /> AI root-cause explanation
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{data.explanation}</p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="size-4 text-success" /> Suggested remediation
              </p>
              <ol className="space-y-2">
                {data.remediation.map((r, i) => (
                  <li key={r} className="flex gap-3 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px]">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{r}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4 text-sev-medium" /> Related logs timeline
              </p>
              {data.related_logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No related logs from {data.source} in the ±3h window.</p>
              ) : (
                <ol className="relative space-y-3 border-l pl-4">
                  {data.related_logs.map((l) => (
                    <li key={l.id} className="relative">
                      <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full border-2 border-background bg-primary" />
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">{fmtTime(l.timestamp)}</span>
                        <LevelBadge level={l.level} />
                      </div>
                      <p className="mt-1 break-all font-mono text-xs">{l.message}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
