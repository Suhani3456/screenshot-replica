import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileText, Loader2, Play, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SeverityBadge } from "@/components/smartlog/badges";
import { PageHeader, Panel } from "@/components/smartlog/common";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUploadLogFile } from "@/hooks/use-smartlog";
import { CATEGORY_COLOR } from "@/lib/constants";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Logs — SmartLog AI" },
      { name: "description", content: "Drag and drop .log, .txt or .csv files and batch-classify every line with the hybrid AI pipeline." },
      { property: "og:title", content: "Upload Logs — SmartLog AI" },
      { property: "og:description", content: "Batch-classify log files with SmartLog AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});

const ACCEPT = [".log", ".txt", ".csv"];
const MAX_BYTES = 10 * 1024 * 1024;

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [lineCount, setLineCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadLogFile();

  const accept = async (f: File) => {
    if (!ACCEPT.some((ext) => f.name.toLowerCase().endsWith(ext))) {
      toast.error("Unsupported file type", { description: "Please upload a .log, .txt or .csv file." });
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File too large", { description: "Maximum size is 10 MB." });
      return;
    }
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    setFile(f);
    setPreview(lines.slice(0, 12));
    setLineCount(lines.length);
    upload.reset();
  };

  const clear = () => {
    setFile(null);
    setPreview([]);
    setLineCount(0);
    upload.reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const r = upload.data;

  return (
    <>
      <PageHeader title="Upload logs" description="Batch-classify a log export. Up to 5,000 lines per file are processed." />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) accept(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-card bg-grid px-6 py-14 text-center transition-all",
              dragging ? "border-primary bg-primary/5 shadow-glow" : "hover:border-primary/50",
            )}
          >
            <span className="rounded-full border bg-background p-3 text-primary">
              <UploadCloud className="size-6" />
            </span>
            <div>
              <p className="text-sm font-semibold">Drop a log file here, or click to browse</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">.log · .txt · .csv — max 10 MB</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) accept(f);
              }}
            />
          </div>

          {file && (
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <span className="truncate font-mono">{file.name}</span>
                </span>
              }
              subtitle={`${(file.size / 1024).toFixed(1)} KB · ${fmtNumber(lineCount)} lines`}
              actions={
                <>
                  <Button size="sm" variant="ghost" onClick={clear} disabled={upload.isPending} aria-label="Remove file">
                    <X className="size-4" />
                  </Button>
                  <Button size="sm" onClick={() => upload.mutate(file)} disabled={upload.isPending}>
                    {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Run Classification
                  </Button>
                </>
              }
              bodyClassName="p-0"
            >
              {(upload.isPending || r) && (
                <div className="border-b px-4 py-3">
                  <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted-foreground">
                    <span>{upload.isPending ? "classifying…" : "complete"}</span>
                    <span>{upload.progress}%</span>
                  </div>
                  <Progress value={upload.progress} className="h-1.5" />
                </div>
              )}
              <pre className="max-h-72 overflow-auto bg-surface p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {preview.map((l, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-6 shrink-0 select-none text-right opacity-50">{i + 1}</span>
                    <span className="break-all">{l}</span>
                  </div>
                ))}
                {lineCount > preview.length && <div className="mt-2 opacity-60">… {fmtNumber(lineCount - preview.length)} more lines</div>}
              </pre>
            </Panel>
          )}
        </div>

        <Panel title="Results summary" className="lg:col-span-2">
          {!r ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {upload.isPending ? "Running the hybrid pipeline on every line…" : "Upload a file and run classification to see a summary here."}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-2.5 text-sm text-success">
                <CheckCircle2 className="size-4" /> Classified {fmtNumber(r.classified)} lines in {(r.duration_ms / 1000).toFixed(1)}s
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Lines", r.total_lines],
                  ["Incidents", r.incidents],
                  ["Unknown", r.unknown],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md border bg-surface p-2.5">
                    <p className="font-display text-xl font-semibold tabular-nums">{fmtNumber(v as number)}</p>
                    <p className="text-[11px] text-muted-foreground">{k}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">By severity</p>
                <div className="flex flex-wrap gap-2">
                  {r.by_severity.map((s) => (
                    <span key={s.severity} className="flex items-center gap-1.5">
                      <SeverityBadge severity={s.severity} />
                      <span className="font-mono text-xs">{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">By category</p>
                <ul className="space-y-1.5">
                  {r.by_category.map((c) => (
                    <li key={c.category} className="flex items-center gap-2 text-xs">
                      <span className="size-2 rounded-sm" style={{ background: CATEGORY_COLOR[c.category] }} />
                      <span className="flex-1">{c.category}</span>
                      <span className="font-mono text-muted-foreground">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild className="w-full">
                <Link to="/incidents">
                  View in Incidents <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
