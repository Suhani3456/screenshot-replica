import type { Incident } from "@/types";

export const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const fmtPct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

export function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-CA")} ${d.toLocaleTimeString("en-GB", { hour12: false })}`;
}

export function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export function incidentsToCsv(rows: Incident[]) {
  const header = ["id", "timestamp", "source", "level", "category", "severity", "confidence", "classified_by", "status", "message"];
  const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.id, r.timestamp, r.source, r.level, r.category, r.severity, r.confidence, r.classified_by, r.status, r.message]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
