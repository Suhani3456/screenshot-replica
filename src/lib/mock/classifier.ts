/**
 * Mock hybrid classifier that mimics the SmartLog AI pipeline:
 * Preprocessing → Regex → BERT + LogReg → DBSCAN → LLM fallback.
 * Pure and deterministic so the UI behaves consistently.
 */
import type {
  Category,
  ClassificationResult,
  Classifier,
  LogLevel,
  PipelineStep,
  Severity,
} from "@/types";

export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function detectLevel(text: string): LogLevel {
  const m = text.match(/\b(CRITICAL|FATAL|ERROR|WARN(?:ING)?|INFO|DEBUG)\b/);
  if (!m) return "INFO";
  const v = m[1] ?? "INFO";
  if (v === "FATAL" || v === "CRITICAL") return "CRITICAL";
  if (v.startsWith("WARN")) return "WARN";
  if (v === "ERROR") return "ERROR";
  return "INFO";
}

export function preprocess(text: string): string {
  return text
    .replace(/^\s*\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[,.]\d+)?\s*/, "")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "<IP>")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "<EMAIL>")
    .replace(/https?:\/\/\S+/g, "<URL>")
    .replace(/\b(?:appattempt|application|container|attempt)_[\w_]+/g, "<ID>")
    .replace(/\b[A-Z]{2,5}-[A-Z0-9-]*\d[A-Z0-9-]*\b/g, "<ID>")
    .replace(/\b0x[0-9a-fA-F]+\b/g, "<HEX>")
    .replace(/\b\d+(?:[.,]\d+)*\b/g, "<NUM>")
    .replace(/\s+/g, " ")
    .trim();
}

const REGEX_RULES: { pattern: RegExp; category: Category; name: string }[] = [
  { pattern: /\b(?:connection|db|database)\b.*\b(?:timed out|timeout)\b/i, category: "Database Error", name: "db_timeout" },
  { pattern: /\bdeadlock\b|\bORA-\d+|\bSQLSTATE\b/i, category: "Database Error", name: "db_engine_error" },
  { pattern: /failed login attempt|authentication failed|account locked/i, category: "Login Failure", name: "auth_failure" },
  { pattern: /\bHTTP 5\d\d\b|status=5\d\d/i, category: "API Failure", name: "http_5xx" },
  { pattern: /sql injection|privilege escalation|brute[- ]force/i, category: "Security Alert", name: "intrusion_signature" },
  { pattern: /disk usage .*\d+%/i, category: "Resource Usage", name: "disk_threshold" },
];

const EMBEDDING_KEYWORDS: Record<Exclude<Category, "Unknown" | "Workflow Error">, string[]> = {
  "Database Error": ["slow query", "select ", "jdbc", "database", "rollback", "replica lag"],
  "API Failure": ["contacting", "retrying connect", "lease", "upstream", "endpoint", "rpc", "ipc.client", "gateway timeout"],
  "Login Failure": ["login", "sso", "token", "credentials", "password", "mfa"],
  "Payment Issue": ["payment", "invoice", "refund", "charge", "card", "txn", "declined", "issuer"],
  "Security Alert": ["outbound traffic", "suspicious", "malware", "firewall", "unauthorized", "exfiltration"],
  "Resource Usage": ["memory", "cpu", "heap", "utilization", "exceeding", "killed by yarn", "oom"],
  "User Action": ["exported", "updated by", "logged in successfully", "viewed", "downloaded report", "created by"],
};

const LLM_KEYWORDS = ["escalation", "workflow", "approval", "sla", "batch job", "stage", "ticket", "rule execution"];

const BASE_SEVERITY: Record<Category, Severity> = {
  "Database Error": "High",
  "API Failure": "High",
  "Login Failure": "Medium",
  "Payment Issue": "High",
  "Security Alert": "Critical",
  "Resource Usage": "Medium",
  "Workflow Error": "Medium",
  "User Action": "Low",
  Unknown: "Unknown",
};

export function severityFor(category: Category, level: LogLevel, text: string): Severity {
  if (category === "Unknown") return "Unknown";
  if (level === "CRITICAL") return "Critical";
  if (category === "Login Failure" && /locked|x\s?[5-9]\b|brute/i.test(text)) return "High";
  if (category === "User Action" && level !== "INFO") return "Medium";
  return BASE_SEVERITY[category];
}

const EXPLANATIONS: Record<Category, { explanation: string; remediation: string[] }> = {
  "Database Error": {
    explanation:
      "The application could not obtain or keep a healthy database connection. This usually points to an exhausted connection pool, long-running locks, or the database host being under heavy load.",
    remediation: [
      "Check DB host CPU, I/O wait and active connection count",
      "Inspect connection-pool metrics (active / idle / pending)",
      "Look for long-running transactions or lock contention",
      "Increase pool timeout or scale read replicas if load is sustained",
    ],
  },
  "API Failure": {
    explanation:
      "A downstream service did not respond or returned a server error. Retries are occurring, which suggests the dependency is degraded or a network path between services is unstable.",
    remediation: [
      "Verify health of the upstream service and its load balancer",
      "Check service-mesh / DNS resolution between the two nodes",
      "Enable or tune circuit breaker to stop retry storms",
      "Correlate with recent deployments of the dependency",
    ],
  },
  "Login Failure": {
    explanation:
      "Repeated authentication failures were observed. This can be a user forgetting credentials, an expired SSO token, or the early stage of a credential-stuffing attempt.",
    remediation: [
      "Review the source IPs for geo or reputation anomalies",
      "Confirm IdP / SSO certificate and token TTL configuration",
      "Apply rate limiting or temporary lockout on the account",
      "Notify the account owner if attempts continue",
    ],
  },
  "Payment Issue": {
    explanation:
      "A payment, refund or charge operation failed or behaved unexpectedly. Customer-facing revenue flows are affected, so this should be triaged quickly.",
    remediation: [
      "Check payment gateway status page and API latency",
      "Reconcile the affected transaction IDs with the ledger",
      "Ensure idempotency keys are used to avoid duplicate charges",
      "Inform the billing support team for customer follow-up",
    ],
  },
  "Security Alert": {
    explanation:
      "The log matches a known attack signature or anomalous access pattern. Treat as a potential security incident until proven otherwise.",
    remediation: [
      "Isolate or block the offending IP at the WAF / firewall",
      "Rotate credentials of any affected service accounts",
      "Preserve logs for forensic analysis",
      "Escalate to the SOC on-call per incident runbook",
    ],
  },
  "Resource Usage": {
    explanation:
      "A host or container is running close to or beyond its resource limits (CPU, memory or disk). Sustained pressure causes throttling, OOM kills and cascading failures.",
    remediation: [
      "Identify the top consuming processes or containers",
      "Raise limits or autoscale the affected node group",
      "Clean up logs / temp data if disk is the bottleneck",
      "Profile the service for memory leaks",
    ],
  },
  "Workflow Error": {
    explanation:
      "A business workflow rule could not execute because of missing or invalid configuration (e.g. an undefined escalation level or missing SLA policy). The LLM fallback recognised the business context that the trained models had too few examples of.",
    remediation: [
      "Open the workflow / rule configuration referenced in the log",
      "Define the missing level, policy or mapping",
      "Re-run the failed job or ticket transition",
      "Add a validation check when rules are edited",
    ],
  },
  "User Action": {
    explanation:
      "A normal user-initiated action was recorded. This is informational and kept for audit purposes.",
    remediation: ["No action needed", "Retain for audit trail per compliance policy"],
  },
  Unknown: {
    explanation:
      "This log does not match any known pattern and sits far from all known clusters in embedding space (DBSCAN noise). It has been flagged as a new, unknown anomaly for human review.",
    remediation: [
      "Review the raw log and surrounding context manually",
      "Label it in the Anomaly Explorer so the model learns this pattern",
      "Check whether a new service or version was recently deployed",
    ],
  },
};

export function classifyText(raw: string): ClassificationResult {
  const text = raw.trim();
  const cleaned = preprocess(text);
  const lower = text.toLowerCase();
  const level = detectLevel(text);
  const jitter = hash01(text);
  const trace: PipelineStep[] = [
    {
      stage: "Preprocessing",
      matched: true,
      skipped: false,
      score: null,
      detail: "Stripped timestamps, masked IPs, IDs and numbers",
    },
  ];

  const finish = (
    category: Category,
    classified_by: Classifier,
    confidence: number,
  ): ClassificationResult => {
    const info = EXPLANATIONS[category];
    return {
      category,
      severity: severityFor(category, level, text),
      confidence: Math.round(confidence * 1000) / 1000,
      classified_by,
      cleaned_text: cleaned,
      is_known: category !== "Unknown",
      pipeline_trace: trace,
      explanation: info.explanation,
      remediation: info.remediation,
      latency_ms: Math.round(
        { Regex: 2, "BERT+LogReg": 38, DBSCAN: 46, LLM: 820 }[classified_by] * (0.8 + jitter * 0.5),
      ),
    };
  };

  const skipRest = (from: number) => {
    const stages: PipelineStep["stage"][] = [
      "Regex Match",
      "BERT Embedding + Logistic Regression",
      "DBSCAN Anomaly Check",
      "LLM Fallback",
    ];
    for (const stage of stages.slice(from)) {
      trace.push({ stage, matched: false, skipped: true, score: null, detail: "Skipped — decided earlier" });
    }
  };

  // 1. Regex
  const rule = REGEX_RULES.find((r) => r.pattern.test(text));
  if (rule) {
    trace.push({ stage: "Regex Match", matched: true, skipped: false, score: 1, detail: `Matched rule "${rule.name}"` });
    skipRest(1);
    return finish(rule.category, "Regex", 0.99);
  }
  trace.push({ stage: "Regex Match", matched: false, skipped: false, score: 0, detail: "No rule matched" });

  // 2. BERT + LogReg (simulated with keyword affinity)
  let best: { category: Category; score: number } = { category: "Unknown", score: 0 };
  for (const [category, words] of Object.entries(EMBEDDING_KEYWORDS) as [Category, string[]][]) {
    const score = words.filter((w) => lower.includes(w)).length;
    if (score > best.score) best = { category, score };
  }
  if (best.score > 0) {
    const prob = Math.min(0.97, 0.66 + best.score * 0.1 + jitter * 0.12);
    trace.push({
      stage: "BERT Embedding + Logistic Regression",
      matched: true,
      skipped: false,
      score: prob,
      detail: `p(${best.category}) = ${prob.toFixed(2)} ≥ 0.50 threshold`,
    });
    skipRest(2);
    return finish(best.category, "BERT+LogReg", prob);
  }
  const lowProb = 0.18 + jitter * 0.2;
  trace.push({
    stage: "BERT Embedding + Logistic Regression",
    matched: false,
    skipped: false,
    score: lowProb,
    detail: `Max class probability ${lowProb.toFixed(2)} below 0.50 threshold`,
  });

  // 3. DBSCAN
  const distance = 0.62 + jitter * 0.3;
  trace.push({
    stage: "DBSCAN Anomaly Check",
    matched: false,
    skipped: false,
    score: distance,
    detail: `Nearest cluster distance ${distance.toFixed(2)} > ε=0.45 → noise point`,
  });

  // 4. LLM fallback
  const llmHits = LLM_KEYWORDS.filter((w) => lower.includes(w)).length;
  if (llmHits > 0) {
    const conf = Math.min(0.93, 0.76 + llmHits * 0.04 + jitter * 0.05);
    trace[3] = { ...trace[3]!, detail: trace[3]!.detail + ", sent to LLM" };
    trace.push({
      stage: "LLM Fallback",
      matched: true,
      skipped: false,
      score: conf,
      detail: "LLM recognised business workflow context",
    });
    return finish("Workflow Error", "LLM", conf);
  }

  trace.push({
    stage: "LLM Fallback",
    matched: false,
    skipped: false,
    score: 0.2 + jitter * 0.15,
    detail: "LLM could not map to a known category",
  });
  // DBSCAN made the final call: unknown anomaly
  trace[3] = { ...trace[3]!, matched: true };
  return finish("Unknown", "DBSCAN", 0.42 + jitter * 0.2);
}
