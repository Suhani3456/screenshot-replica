/**
 * SmartLog AI — single API service layer.
 * Every data access in the UI goes through this file. To connect a real
 * backend, set VITE_USE_MOCK=false and VITE_API_URL=<your server>.
 */
import { SEVERITY_RANK } from "@/lib/constants";
import type {
  AnomalyCluster,
  AnomalyData,
  Category,
  ClassificationResult,
  DashboardStats,
  Incident,
  IncidentFilters,
  IncidentStatus,
  LogEntry,
  ModelMetrics,
  Paginated,
  Severity,
  SourceSystem,
  TimeSeriesPoint,
  UploadResult,
} from "@/types";

export const BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const USE_MOCK: boolean = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => sleep(180 + Math.random() * 320);

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const mock = () => import("@/lib/mock/data");
const mockClassifier = () => import("@/lib/mock/classifier");

function countBy<T, K extends string>(items: T[], key: (t: T) => K): Record<K, number> {
  return items.reduce(
    (acc, it) => {
      const k = key(it);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<K, number>,
  );
}

// ---------------- Dashboard ----------------

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!USE_MOCK) return http("/api/dashboard/stats");
  const { store, isIncident } = await mock();
  const { CATEGORIES, SOURCES, SEVERITIES } = await import("@/lib/constants");
  await latency();
  const incidents = store.records.filter(isIncident);
  const cat = countBy(incidents, (i) => i.category);
  const src = countBy(incidents, (i) => i.source);
  const sev = countBy(incidents, (i) => i.severity);
  return {
    total_logs: store.baseLogsProcessed + store.records.length * 37 + store.streamed,
    incidents: incidents.length,
    critical: sev.Critical ?? 0,
    unknown_anomalies: cat.Unknown ?? 0,
    avg_detection_ms: 42 + (store.streamed % 7),
    false_alert_rate: 3.8,
    by_category: CATEGORIES.map((category) => ({ category, count: cat[category] ?? 0 })),
    by_source: SOURCES.map((source) => ({ source, count: src[source] ?? 0 })),
    by_severity: SEVERITIES.map((severity) => ({ severity, count: sev[severity] ?? 0 })),
  };
}

export async function getIncidentsTimeSeries(): Promise<TimeSeriesPoint[]> {
  if (!USE_MOCK) return http("/api/dashboard/timeseries");
  const { store, isIncident } = await mock();
  await latency();
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const buckets: TimeSeriesPoint[] = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(now.getTime() - (23 - i) * 3600_000).toISOString(),
    incidents: 0,
    critical: 0,
  }));
  const start = now.getTime() - 23 * 3600_000;
  for (const r of store.records) {
    if (!isIncident(r)) continue;
    const idx = Math.floor((new Date(r.timestamp).getTime() - start) / 3600_000);
    const b = buckets[Math.min(23, Math.max(0, idx))];
    if (idx < 0) continue;
    b.incidents += 1;
    if (r.severity === "Critical") b.critical += 1;
  }
  return buckets;
}

// ---------------- Logs & incidents ----------------

export async function getRecentLogs(limit = 100): Promise<LogEntry[]> {
  if (!USE_MOCK) return http(`/api/logs?limit=${limit}`);
  const { store } = await mock();
  await latency();
  return store.records.slice(0, limit).map(toLogEntry);
}

function toLogEntry(i: Incident): LogEntry {
  const { id, timestamp, source, level, message, category, severity, confidence, classified_by } = i;
  return { id, timestamp, source, level, message, category, severity, confidence, classified_by };
}

export async function listIncidents(
  filters: IncidentFilters = {},
  page = 1,
): Promise<Paginated<Incident>> {
  const pageSize = filters.pageSize ?? 15;
  if (!USE_MOCK) {
    const qs = new URLSearchParams(
      Object.entries({ ...filters, page, pageSize }).flatMap(([k, v]) =>
        v === undefined || v === "" || v === "all" ? [] : [[k, String(v)]],
      ),
    );
    return http(`/api/incidents?${qs}`);
  }
  const { store, isIncident } = await mock();
  await latency();
  const q = filters.search?.toLowerCase().trim();
  const from = filters.from ? new Date(filters.from).getTime() : null;
  const to = filters.to ? new Date(filters.to).getTime() + 86_400_000 : null;
  let items = store.records.filter((i) => {
    if (!isIncident(i)) return false;
    if (filters.severity && filters.severity !== "all" && i.severity !== filters.severity) return false;
    if (filters.category && filters.category !== "all" && i.category !== filters.category) return false;
    if (filters.source && filters.source !== "all" && i.source !== filters.source) return false;
    if (filters.status && filters.status !== "all" && i.status !== filters.status) return false;
    const t = new Date(i.timestamp).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t >= to) return false;
    if (q && !`${i.message} ${i.id} ${i.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const dir = filters.sortDir === "asc" ? 1 : -1;
  const by = filters.sortBy ?? "timestamp";
  items = [...items].sort((a, b) => {
    let cmp = 0;
    if (by === "severity") cmp = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    else if (by === "confidence") cmp = a.confidence - b.confidence;
    else cmp = String(a[by]).localeCompare(String(b[by]));
    return cmp * dir;
  });
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export async function getIncident(id: string): Promise<Incident> {
  if (!USE_MOCK) return http(`/api/incidents/${encodeURIComponent(id)}`);
  const { store } = await mock();
  await sleep(150);
  const found = store.records.find((r) => r.id === id);
  if (!found) throw new Error(`Incident ${id} not found`);
  return { ...found };
}

export async function updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
  if (!USE_MOCK)
    return http(`/api/incidents/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  const { store } = await mock();
  await sleep(250);
  const found = store.records.find((r) => r.id === id);
  if (!found) throw new Error(`Incident ${id} not found`);
  found.status = status;
  return { ...found };
}

// ---------------- Classification ----------------

export async function classifyLog(text: string): Promise<ClassificationResult> {
  if (!text.trim()) throw new Error("Log text is empty");
  if (!USE_MOCK)
    return http("/api/classify", { method: "POST", body: JSON.stringify({ text }) });
  const { classifyText } = await mockClassifier();
  const result = classifyText(text);
  await sleep(result.classified_by === "LLM" ? 1400 : 700);
  return result;
}

export async function uploadLogFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  if (!USE_MOCK) {
    const body = new FormData();
    body.append("file", file);
    onProgress?.(10);
    const res = await http<UploadResult>("/api/upload", { method: "POST", body });
    onProgress?.(100);
    return res;
  }
  const started = performance.now();
  const { classifyText, detectLevel } = await mockClassifier();
  const { addLog, isIncident } = await mock();
  const text = await file.text();
  let lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (file.name.toLowerCase().endsWith(".csv")) {
    // Use the longest column of each row as the log message; skip header.
    lines = lines.slice(1).map((row) =>
      row
        .split(",")
        .map((c) => c.replace(/^"|"$/g, ""))
        .reduce((a, b) => (b.length > a.length ? b : a), ""),
    );
  }
  lines = lines.slice(0, 5000);
  const sevCount: Partial<Record<Severity, number>> = {};
  const catCount: Partial<Record<Category, number>> = {};
  let incidents = 0;
  let unknown = 0;
  const chunk = Math.max(1, Math.ceil(lines.length / 20));
  const sources: SourceSystem[] = ["CRM", "HRMS", "Billing", "Cloud", "Server"];
  for (let i = 0; i < lines.length; i++) {
    const r = classifyText(lines[i]);
    sevCount[r.severity] = (sevCount[r.severity] ?? 0) + 1;
    catCount[r.category] = (catCount[r.category] ?? 0) + 1;
    if (r.category === "Unknown") unknown++;
    const entry: LogEntry = {
      id: `UPL-${Date.now().toString(36)}-${i}`,
      timestamp: new Date().toISOString(),
      source: sources[i % sources.length],
      level: detectLevel(lines[i]),
      message: lines[i],
      category: r.category,
      severity: r.severity,
      confidence: r.confidence,
      classified_by: r.classified_by,
    };
    if (isIncident(entry)) {
      incidents++;
      addLog(entry);
    }
    if (i % chunk === 0) {
      onProgress?.(Math.round(((i + 1) / lines.length) * 100));
      await sleep(80);
    }
  }
  onProgress?.(100);
  return {
    file_name: file.name,
    total_lines: lines.length,
    classified: lines.length,
    incidents,
    unknown,
    by_severity: (Object.entries(sevCount) as [Severity, number][]).map(([severity, count]) => ({ severity, count })),
    by_category: (Object.entries(catCount) as [Category, number][])
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    duration_ms: Math.round(performance.now() - started),
  };
}

// ---------------- Anomalies ----------------

export async function getAnomalyClusters(): Promise<AnomalyData> {
  if (!USE_MOCK) return http("/api/anomalies");
  const { anomalyPoints, anomalyClusters } = await mock();
  await latency();
  return {
    points: anomalyPoints.map((p) => {
      const c = anomalyClusters.find((cl) => cl.id === p.cluster);
      return c?.labeled_as ? { ...p, category: c.labeled_as } : { ...p };
    }),
    clusters: anomalyClusters.map((c) => ({ ...c })),
  };
}

export async function labelCluster(clusterId: string, category: Category): Promise<AnomalyCluster> {
  if (!USE_MOCK)
    return http(`/api/anomalies/${encodeURIComponent(clusterId)}/label`, {
      method: "POST",
      body: JSON.stringify({ category }),
    });
  const { anomalyClusters } = await mock();
  await sleep(400);
  const c = anomalyClusters.find((cl) => cl.id === clusterId);
  if (!c) throw new Error(`Cluster ${clusterId} not found`);
  c.labeled_as = category;
  return { ...c };
}

// ---------------- Model metrics ----------------

export async function getModelMetrics(): Promise<ModelMetrics> {
  if (!USE_MOCK) return http("/api/metrics");
  const { modelMetrics, store } = await mock();
  await latency();
  const usage = countBy(store.records, (r) => r.classified_by);
  const scale = 412; // records seen in production vs sample
  return {
    ...modelMetrics,
    classifier_usage: modelMetrics.classifier_usage.map((u) => ({
      classifier: u.classifier,
      count: (usage[u.classifier] ?? 0) * scale,
    })),
  };
}

// ---------------- Streaming ----------------

type StreamListener = (log: LogEntry) => void;
const listeners = new Set<StreamListener>();
let mockTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Subscribe to the live log stream. Returns an unsubscribe function.
 * Real mode: WebSocket to `${BASE_URL}/ws/stream` (JSON LogEntry per message).
 * Mock mode: one shared interval emits a new log every ~2s.
 */
export function openLogStream(onMessage: StreamListener): () => void {
  if (!USE_MOCK) {
    const ws = new WebSocket(`${BASE_URL.replace(/^http/, "ws")}/ws/stream`);
    ws.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data) as LogEntry);
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => ws.close();
  }
  listeners.add(onMessage);
  if (!mockTimer) {
    mockTimer = setInterval(async () => {
      const { makeLog, addLog } = await mock();
      const count = Math.random() < 0.3 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const log = makeLog(new Date());
        addLog(log);
        listeners.forEach((l) => l(log));
      }
    }, 2000);
  }
  return () => {
    listeners.delete(onMessage);
    if (listeners.size === 0 && mockTimer) {
      clearInterval(mockTimer);
      mockTimer = null;
    }
  };
}
