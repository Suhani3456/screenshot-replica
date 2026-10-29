import type { Category, Classifier, IncidentStatus, LogLevel, Severity, SourceSystem } from "@/types";

export const CATEGORIES: Category[] = [
  "Database Error",
  "API Failure",
  "Login Failure",
  "Payment Issue",
  "Security Alert",
  "Resource Usage",
  "Workflow Error",
  "User Action",
  "Unknown",
];

export const KNOWN_CATEGORIES = CATEGORIES.filter((c) => c !== "Unknown");

export const SOURCES: SourceSystem[] = ["CRM", "HRMS", "Billing", "Cloud", "Server"];
export const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low", "Unknown"];
export const LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR", "CRITICAL"];
export const CLASSIFIERS: Classifier[] = ["Regex", "BERT+LogReg", "DBSCAN", "LLM"];
export const STATUSES: IncidentStatus[] = ["Open", "Acknowledged", "Resolved"];

export const SEVERITY_RANK: Record<Severity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Unknown: 0,
};

/** CSS variable for each severity — usable in SVG fill/stroke. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  Critical: "var(--sev-critical)",
  High: "var(--sev-high)",
  Medium: "var(--sev-medium)",
  Low: "var(--sev-low)",
  Unknown: "var(--sev-unknown)",
};

export const CATEGORY_COLOR: Record<Category, string> = {
  "Database Error": "var(--chart-1)",
  "API Failure": "var(--chart-3)",
  "Login Failure": "var(--chart-4)",
  "Payment Issue": "var(--chart-2)",
  "Security Alert": "var(--chart-5)",
  "Resource Usage": "var(--chart-6)",
  "Workflow Error": "var(--chart-7)",
  "User Action": "var(--chart-8)",
  Unknown: "var(--chart-9)",
};

export const SOURCE_COLOR: Record<SourceSystem, string> = {
  CRM: "var(--chart-1)",
  HRMS: "var(--chart-2)",
  Billing: "var(--chart-3)",
  Cloud: "var(--chart-6)",
  Server: "var(--chart-7)",
};

export const LEVEL_COLOR: Record<LogLevel, string> = {
  INFO: "var(--sev-low)",
  WARN: "var(--sev-medium)",
  ERROR: "var(--sev-high)",
  CRITICAL: "var(--sev-critical)",
};
