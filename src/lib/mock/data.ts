/**
 * In-memory mock store seeded with realistic enterprise / Hadoop logs.
 * Only src/lib/api.ts should import this module.
 */
import { CATEGORIES, KNOWN_CATEGORIES, SOURCES } from "@/lib/constants";
import type {
  AnomalyCluster,
  AnomalyPoint,
  Category,
  Incident,
  IncidentStatus,
  LogEntry,
  ModelMetrics,
  SourceSystem,
} from "@/types";
import { classifyText, detectLevel, hash01, preprocess } from "./classifier";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261029);
const pick = <T,>(arr: readonly T[], r = rng): T => arr[Math.floor(r() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

interface Template {
  source: SourceSystem;
  text: string;
  weight: number;
}

const TEMPLATES: Template[] = [
  // Database
  { source: "Server", weight: 3, text: "{hts} ERROR [HikariPool-1 housekeeper] com.zaxxer.hikari.pool.HikariPool: HikariPool-1 - Connection is not available, request timed out after 30000ms." },
  { source: "CRM", weight: 3, text: "ERROR Connection to DB timed out after 30s" },
  { source: "Billing", weight: 2, text: "ERROR [billing-db] SQLSTATE[40001]: Serialization failure: 1213 Deadlock found when trying to get lock; try restarting transaction" },
  { source: "HRMS", weight: 1, text: "CRITICAL ORA-00060: deadlock detected while waiting for resource on table EMPLOYEE_PAYROLL" },
  { source: "CRM", weight: 2, text: "WARN Slow query detected ({n4} ms): SELECT * FROM accounts WHERE region_id = {n2}" },
  // API
  { source: "Cloud", weight: 4, text: "{hts} ERROR [RMCommunicator Allocator] org.apache.hadoop.mapreduce.v2.app.rm.RMContainerAllocator: ERROR IN CONTACTING RM." },
  { source: "CRM", weight: 3, text: "ERROR Upstream service /api/v2/contacts returned HTTP 503 Service Unavailable after 3 retries" },
  { source: "HRMS", weight: 2, text: "WARN Request to https://hrms-gateway.internal/employees timed out (status=504)" },
  { source: "Cloud", weight: 3, text: "{hts} WARN [LeaseRenewer:msrabi@msra-sa-41:9000] org.apache.hadoop.hdfs.LeaseRenewer: Failed to renew lease for [DFSClient_NONMAPREDUCE_1537864556_1] for {n2} seconds. Will retry shortly ..." },
  { source: "Cloud", weight: 3, text: "{hts} INFO [ContainerLauncher #{n1}] org.apache.hadoop.ipc.Client: Retrying connect to server: msra-sa-41/10.190.173.170:8030. Already tried {n1} time(s); retry policy is RetryUpToMaximumCountWithFixedSleep(maxRetries=10, sleepTime=1000 MILLISECONDS)" },
  // Login
  { source: "CRM", weight: 3, text: "WARN Failed login attempt from {ip} x{n1}" },
  { source: "HRMS", weight: 3, text: "WARN User emp_{n4} authentication failed: invalid credentials (attempt {n1}/5)" },
  { source: "CRM", weight: 2, text: "ERROR SSO token validation failed for user {email}: token expired" },
  { source: "Server", weight: 1, text: "WARN Account locked after 5 failed login attempts for user admin_ops" },
  // Payment
  { source: "Billing", weight: 2, text: "CRITICAL Payment gateway returned 502 for invoice INV-{n5}, retrying" },
  { source: "Billing", weight: 3, text: "ERROR Transaction TXN-{n6} declined by issuer: insufficient funds" },
  { source: "Billing", weight: 2, text: "ERROR Refund for order ORD-{n5} failed: card network timeout" },
  { source: "Billing", weight: 1, text: "WARN Duplicate charge detected for customer CUST-{n4} amount=₹4,999.00" },
  // Security
  { source: "Server", weight: 1, text: "CRITICAL Possible SQL injection detected in parameter 'q' from {ip}" },
  { source: "Server", weight: 1, text: "CRITICAL Multiple privilege escalation attempts detected for user svc_backup" },
  { source: "Cloud", weight: 1, text: "WARN Unusual outbound traffic: {n1}.{n1} GB to {ip} in 5 minutes" },
  { source: "Server", weight: 1, text: "ERROR Brute-force pattern detected: {n3} SSH attempts from {ip}" },
  // Resource
  { source: "Cloud", weight: 3, text: "{hts} WARN [AsyncDispatcher event handler] org.apache.hadoop.mapreduce.v2.app.job.impl.TaskAttemptImpl: Container killed by YARN for exceeding memory limits. {n1}.2 GB of 4 GB physical memory used." },
  { source: "Server", weight: 2, text: "WARN CPU utilization at 9{n1}% on node worker-0{n1} for 10 minutes" },
  { source: "Server", weight: 1, text: "CRITICAL Disk usage on /var/lib/postgresql reached 9{n1}%" },
  { source: "Billing", weight: 2, text: "WARN JVM heap usage 8{n1}% (3.56 GB / 4 GB) on billing-service-{n1}" },
  // Workflow
  { source: "CRM", weight: 2, text: "ERROR Escalation rule execution failed for ticket ID {n4} - undefined escalation level." },
  { source: "HRMS", weight: 2, text: "ERROR Leave approval workflow stuck at stage 'Manager Review' for request LR-{n4}" },
  { source: "CRM", weight: 1, text: "WARN Case escalation for ticket {n4} skipped: SLA policy not found" },
  { source: "HRMS", weight: 1, text: "ERROR Payroll batch job PAY-OCT-2026 aborted at step 3/7: missing cost center mapping" },
  // User actions
  { source: "CRM", weight: 4, text: "INFO User u_{n4} exported {n4} contact records to CSV" },
  { source: "HRMS", weight: 3, text: "INFO Employee profile EMP-{n4} updated by hr_admin" },
  { source: "CRM", weight: 4, text: "INFO User logged in successfully: {email}" },
  { source: "Billing", weight: 2, text: "INFO Finance user f_{n3} downloaded report Q3-revenue.xlsx" },
  // Unknown
  { source: "Server", weight: 1, text: "WARN Checksum drift on shard ζ-{n1}: entropy pool exhausted, quorum vote inconclusive" },
  { source: "Cloud", weight: 1, text: "ERROR Unexpected byte sequence 0x7F3A in telemetry frame, decoder state=FLUX" },
  { source: "CRM", weight: 1, text: "WARN Legacy module LX-400 emitted unrecognized status code 0xDEAD" },
  { source: "Cloud", weight: 1, text: "ERROR Rebalancer observed phantom partitions on topic orders-v3 (count={n1})" },
];

const TOTAL_WEIGHT = TEMPLATES.reduce((s, t) => s + t.weight, 0);
const NAMES = ["a.sharma", "j.mehta", "s.rao", "k.iyer", "p.nair", "r.gupta", "m.das"];

function pickTemplate(r: () => number): Template {
  let x = r() * TOTAL_WEIGHT;
  for (const t of TEMPLATES) {
    x -= t.weight;
    if (x <= 0) return t;
  }
  return TEMPLATES[0]!;
}

function hadoopTs(d: Date) {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())},${p(d.getMilliseconds(), 3)}`;
}

function fill(text: string, d: Date, r: () => number) {
  const n = (digits: number) =>
    String(Math.floor(r() * (9 * 10 ** (digits - 1))) + 10 ** (digits - 1));
  return text
    .replace("{hts}", hadoopTs(d))
    .replace(/\{ip\}/g, () => `${Math.floor(r() * 200) + 10}.${Math.floor(r() * 255)}.${Math.floor(r() * 255)}.${Math.floor(r() * 254) + 1}`)
    .replace(/\{email\}/g, () => `${NAMES[Math.floor(r() * NAMES.length)]!}@corp.com`)
    .replace(/\{n(\d)\}/g, (_, d) => n(Number(d)));
}

let idCounter = 0;
const nextId = () => `LOG-${String(100000 + ++idCounter)}`;

export function makeLog(date: Date, r: () => number = Math.random): LogEntry {
  const t = pickTemplate(r);
  const message = fill(t.text, date, r);
  const result = classifyText(message);
  return {
    id: nextId(),
    timestamp: date.toISOString(),
    source: t.source,
    level: detectLevel(message),
    message,
    category: result.category,
    severity: result.severity,
    confidence: result.confidence,
    classified_by: result.classified_by,
  };
}

export function isIncident(log: LogEntry) {
  return log.level !== "INFO" || log.category === "Unknown";
}

function enrich(log: LogEntry, all: LogEntry[], status: IncidentStatus): Incident {
  const result = classifyText(log.message);
  const t = new Date(log.timestamp).getTime();
  const related = all
    .filter(
      (l) =>
        l.id !== log.id &&
        l.source === log.source &&
        Math.abs(new Date(l.timestamp).getTime() - t) < 3 * 3600_000,
    )
    .slice(0, 5)
    .map(({ id, timestamp, level, message, source }) => ({ id, timestamp, level, message, source }));
  return {
    ...log,
    status,
    normalized: preprocess(log.message),
    explanation: result.explanation,
    remediation: result.remediation,
    related_logs: related.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  };
}

// ---------- Seed ----------
const NOW = Date.now();
const SEED_COUNT = 260;

const seedLogs: LogEntry[] = Array.from({ length: SEED_COUNT }, () => {
  // Bias toward recent hours with a bump during the "business day"
  const ageH = Math.pow(rng(), 1.15) * 24;
  return makeLog(new Date(NOW - ageH * 3600_000 - int(0, 59) * 1000), rng);
}).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

function seedStatus(log: LogEntry): IncidentStatus {
  const ageH = (NOW - new Date(log.timestamp).getTime()) / 3600_000;
  const h = hash01(log.id);
  if (ageH > 8) return h < 0.7 ? "Resolved" : h < 0.9 ? "Acknowledged" : "Open";
  if (ageH > 2) return h < 0.35 ? "Resolved" : h < 0.7 ? "Acknowledged" : "Open";
  return h < 0.15 ? "Acknowledged" : "Open";
}

export const store = {
  records: seedLogs.map((l) => enrich(l, seedLogs, seedStatus(l))) as Incident[],
  baseLogsProcessed: 1_248_312,
  streamed: 0,
};

export function addLog(log: LogEntry, status: IncidentStatus = "Open"): Incident {
  const inc = enrich(log, store.records, status);
  store.records.unshift(inc);
  if (store.records.length > 3000) store.records.length = 3000;
  store.streamed += 1;
  return inc;
}

// ---------- Anomaly clusters ----------
const UNKNOWN_SAMPLES: Record<string, string[]> = {
  "UNK-01": [
    "WARN Checksum drift on shard ζ-3: entropy pool exhausted, quorum vote inconclusive",
    "WARN Checksum drift on shard ζ-7: entropy pool exhausted, quorum vote inconclusive",
    "WARN Checksum drift on shard ζ-1: quorum vote inconclusive after 3 rounds",
  ],
  "UNK-02": [
    "ERROR Unexpected byte sequence 0x7F3A in telemetry frame, decoder state=FLUX",
    "ERROR Unexpected byte sequence 0x7F3B in telemetry frame, decoder state=FLUX",
    "ERROR Telemetry decoder reset: frame header 0x00FF invalid",
  ],
  "UNK-03": [
    "ERROR Rebalancer observed phantom partitions on topic orders-v3 (count=4)",
    "ERROR Rebalancer observed phantom partitions on topic invoices-v1 (count=2)",
    "WARN Partition ownership flapping detected for consumer group cg-billing",
  ],
};

const anomalyRng = mulberry32(7);
function gauss(r: () => number) {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clusterCenters: Record<Category, [number, number]> = {
  "Database Error": [-62, 48],
  "API Failure": [-18, 70],
  "Login Failure": [34, 62],
  "Payment Issue": [68, 20],
  "Security Alert": [58, -38],
  "Resource Usage": [8, -62],
  "Workflow Error": [-46, -44],
  "User Action": [-74, -6],
  Unknown: [0, 0],
};

const knownSamples = (c: Category) =>
  store.records.filter((r) => r.category === c).map((r) => r.message);

const anomalyPoints: AnomalyPoint[] = [];
for (const c of KNOWN_CATEGORIES) {
  const [cx, cy] = clusterCenters[c];
  const samples = knownSamples(c);
  const n = 26 + Math.floor(anomalyRng() * 14);
  for (let i = 0; i < n; i++) {
    anomalyPoints.push({
      x: cx + gauss(anomalyRng) * 7,
      y: cy + gauss(anomalyRng) * 7,
      cluster: c,
      category: c,
      message: samples.length ? pick(samples, anomalyRng) : c,
      is_noise: false,
    });
  }
}

const unknownCenters: Record<string, [number, number]> = {
  "UNK-01": [22, 14],
  "UNK-02": [-20, 10],
  "UNK-03": [30, -14],
};

export const anomalyClusters: AnomalyCluster[] = Object.entries(UNKNOWN_SAMPLES).map(
  ([id, samples], i) => ({
    id,
    label: ["Shard checksum drift", "Telemetry decoder faults", "Phantom partitions"][i]!,
    count: [14, 11, 9][i]!,
    samples,
    labeled_as: null,
    first_seen: new Date(NOW - [5, 11, 2][i]! * 3600_000).toISOString(),
  }),
);

for (const cl of anomalyClusters) {
  const [cx, cy] = unknownCenters[cl.id]!;
  for (let i = 0; i < cl.count; i++) {
    anomalyPoints.push({
      x: cx + gauss(anomalyRng) * 3.2,
      y: cy + gauss(anomalyRng) * 3.2,
      cluster: cl.id,
      category: "Unknown",
      message: pick(cl.samples, anomalyRng),
      is_noise: false,
    });
  }
}

const noiseMsgs = [
  "WARN Legacy module LX-400 emitted unrecognized status code 0xDEAD",
  "ERROR Heartbeat from node ghost-12 received with future timestamp",
  "WARN Config hash mismatch between replicas r1 and r4",
  "ERROR Scheduler returned negative queue depth (-3)",
  "WARN Cert pin rotation event without matching key",
];
for (let i = 0; i < 26; i++) {
  anomalyPoints.push({
    x: (anomalyRng() - 0.5) * 190,
    y: (anomalyRng() - 0.5) * 170,
    cluster: "noise",
    category: "Unknown",
    message: pick(noiseMsgs, anomalyRng),
    is_noise: true,
  });
}

export { anomalyPoints };

// ---------- Model metrics ----------
const PER_CLASS: [Category, number, number, number][] = [
  ["Database Error", 0.96, 0.95, 412],
  ["API Failure", 0.93, 0.91, 538],
  ["Login Failure", 0.97, 0.96, 377],
  ["Payment Issue", 0.94, 0.92, 296],
  ["Security Alert", 0.95, 0.93, 164],
  ["Resource Usage", 0.92, 0.94, 451],
  ["Workflow Error", 0.88, 0.85, 121],
  ["User Action", 0.98, 0.97, 603],
  ["Unknown", 0.81, 0.78, 88],
];

function buildConfusion(): number[][] {
  const r = mulberry32(99);
  return PER_CLASS.map(([, , recall, support], i) => {
    const correct = Math.round(support * recall);
    let remaining = support - correct;
    const row: number[] = PER_CLASS.map(() => 0);
    row[i] = correct;
    while (remaining > 0) {
      let j = Math.floor(r() * PER_CLASS.length);
      if (j === i) j = (j + 1) % PER_CLASS.length;
      const take = Math.min(remaining, 1 + Math.floor(r() * 4));
      row[j] = (row[j] ?? 0) + take;
      remaining -= take;
    }
    return row;
  });
}

export const modelMetrics: ModelMetrics = (() => {
  const per_class = PER_CLASS.map(([category, precision, recall, support]) => ({
    category,
    precision,
    recall,
    f1: Math.round(((2 * precision * recall) / (precision + recall)) * 1000) / 1000,
    support,
  }));
  const totalSupport = per_class.reduce((s, c) => s + c.support, 0);
  const w = (k: "precision" | "recall" | "f1") =>
    Math.round((per_class.reduce((s, c) => s + c[k] * c.support, 0) / totalSupport) * 1000) / 1000;
  return {
    accuracy: 0.942,
    precision: w("precision"),
    recall: w("recall"),
    f1: w("f1"),
    per_class,
    confusion_matrix: { labels: CATEGORIES, matrix: buildConfusion() },
    comparison: [
      { approach: "Rule-based only", f1: 0.71, false_alert_rate: 0.142 },
      { approach: "ML only", f1: 0.86, false_alert_rate: 0.083 },
      { approach: "Hybrid (SmartLog AI)", f1: 0.932, false_alert_rate: 0.038 },
    ],
    classifier_usage: [
      { classifier: "Regex", count: 0 },
      { classifier: "BERT+LogReg", count: 0 },
      { classifier: "DBSCAN", count: 0 },
      { classifier: "LLM", count: 0 },
    ],
  };
})();

export { SOURCES };
