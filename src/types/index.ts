export type Severity = "Critical" | "High" | "Medium" | "Low" | "Unknown";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export type SourceSystem = "CRM" | "HRMS" | "Billing" | "Cloud" | "Server";

export type Category =
  | "Database Error"
  | "API Failure"
  | "Login Failure"
  | "Payment Issue"
  | "Security Alert"
  | "Resource Usage"
  | "Workflow Error"
  | "User Action"
  | "Unknown";

export type Classifier = "Regex" | "BERT+LogReg" | "DBSCAN" | "LLM";

export type IncidentStatus = "Open" | "Acknowledged" | "Resolved";

export interface LogEntry {
  id: string;
  timestamp: string; // ISO
  source: SourceSystem;
  level: LogLevel;
  message: string;
  category: Category;
  severity: Severity;
  confidence: number; // 0..1
  classified_by: Classifier;
}

export interface Incident extends LogEntry {
  status: IncidentStatus;
  normalized: string;
  explanation: string;
  remediation: string[];
  related_logs: Pick<LogEntry, "id" | "timestamp" | "level" | "message" | "source">[];
}

export interface PipelineStep {
  stage: PipelineStage;
  matched: boolean;
  skipped: boolean;
  score: number | null;
  detail: string;
}

export type PipelineStage =
  | "Preprocessing"
  | "Regex Match"
  | "BERT Embedding + Logistic Regression"
  | "DBSCAN Anomaly Check"
  | "LLM Fallback";

export interface ClassificationResult {
  category: Category;
  severity: Severity;
  confidence: number;
  classified_by: Classifier;
  cleaned_text: string;
  is_known: boolean;
  pipeline_trace: PipelineStep[];
  explanation: string;
  remediation: string[];
  latency_ms: number;
}

export interface AnomalyPoint {
  x: number;
  y: number;
  cluster: string; // category name or "noise" / cluster id
  category: Category;
  message: string;
  is_noise: boolean;
}

export interface AnomalyCluster {
  id: string;
  label: string;
  count: number;
  samples: string[];
  labeled_as: Category | null;
  first_seen: string;
}

export interface AnomalyData {
  points: AnomalyPoint[];
  clusters: AnomalyCluster[];
}

export interface ClassMetric {
  category: Category;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  per_class: ClassMetric[];
  confusion_matrix: { labels: Category[]; matrix: number[][] };
  comparison: { approach: string; f1: number; false_alert_rate: number }[];
  classifier_usage: { classifier: Classifier; count: number }[];
}

export interface DashboardStats {
  total_logs: number;
  incidents: number;
  critical: number;
  unknown_anomalies: number;
  avg_detection_ms: number;
  false_alert_rate: number;
  by_category: { category: Category; count: number }[];
  by_source: { source: SourceSystem; count: number }[];
  by_severity: { severity: Severity; count: number }[];
}

export interface TimeSeriesPoint {
  time: string; // ISO hour bucket
  incidents: number;
  critical: number;
}

export interface IncidentFilters {
  search?: string;
  severity?: Severity | "all";
  category?: Category | "all";
  source?: SourceSystem | "all";
  status?: IncidentStatus | "all";
  from?: string; // ISO date
  to?: string;
  sortBy?: "timestamp" | "severity" | "confidence" | "source" | "category";
  sortDir?: "asc" | "desc";
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadResult {
  file_name: string;
  total_lines: number;
  classified: number;
  incidents: number;
  unknown: number;
  by_severity: { severity: Severity; count: number }[];
  by_category: { category: Category; count: number }[];
  duration_ms: number;
}
