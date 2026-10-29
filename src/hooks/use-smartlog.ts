import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import * as api from "@/lib/api";
import type { Category, IncidentFilters, IncidentStatus, LogEntry } from "@/types";

export const qk = {
  stats: ["dashboard", "stats"] as const,
  series: ["dashboard", "series"] as const,
  logs: (limit: number) => ["logs", limit] as const,
  incidents: (f: IncidentFilters, page: number) => ["incidents", f, page] as const,
  incident: (id: string) => ["incident", id] as const,
  anomalies: ["anomalies"] as const,
  metrics: ["metrics"] as const,
};

export const useDashboardStats = () =>
  useQuery({ queryKey: qk.stats, queryFn: api.getDashboardStats, refetchInterval: 10_000 });

export const useIncidentsTimeSeries = () =>
  useQuery({ queryKey: qk.series, queryFn: api.getIncidentsTimeSeries, refetchInterval: 30_000 });

export const useRecentLogs = (limit = 100) =>
  useQuery({ queryKey: qk.logs(limit), queryFn: () => api.getRecentLogs(limit), staleTime: Infinity });

export const useIncidents = (filters: IncidentFilters, page: number) =>
  useQuery({
    queryKey: qk.incidents(filters, page),
    queryFn: () => api.listIncidents(filters, page),
    placeholderData: keepPreviousData,
  });

export const useIncident = (id: string | null) =>
  useQuery({
    queryKey: qk.incident(id ?? ""),
    queryFn: () => api.getIncident(id as string),
    enabled: !!id,
  });

export function useUpdateIncidentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: IncidentStatus }) =>
      api.updateIncidentStatus(id, status),
    onSuccess: (inc) => {
      qc.setQueryData(qk.incident(inc.id), inc);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(`${inc.id} marked as ${inc.status}`);
    },
    onError: (e: Error) => toast.error("Could not update status", { description: e.message }),
  });
}

export const useClassifyLog = () =>
  useMutation({
    mutationFn: (text: string) => api.classifyLog(text),
    onError: (e: Error) => toast.error("Classification failed", { description: e.message }),
  });

export function useUploadLogFile() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    mutationFn: (file: File) => {
      setProgress(0);
      return api.uploadLogFile(file, setProgress);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("Upload failed", { description: e.message }),
  });
  return { ...mutation, progress };
}

export const useAnomalyClusters = () =>
  useQuery({ queryKey: qk.anomalies, queryFn: api.getAnomalyClusters });

export function useLabelCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clusterId, category }: { clusterId: string; category: Category }) =>
      api.labelCluster(clusterId, category),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: qk.anomalies });
      toast.success(`Cluster ${c.id} labelled as ${c.labeled_as}`, {
        description: "Feedback queued for the next model retraining run.",
      });
    },
    onError: (e: Error) => toast.error("Labelling failed", { description: e.message }),
  });
}

export const useModelMetrics = () =>
  useQuery({ queryKey: qk.metrics, queryFn: api.getModelMetrics });

/**
 * Live log stream with an in-memory buffer and pause/resume.
 * When paused, incoming logs are counted but not shown.
 */
export function useLogStream({ initial = [], max = 200 }: { initial?: LogEntry[]; max?: number } = {}) {
  const [logs, setLogs] = useState<LogEntry[]>(initial);
  const [paused, setPaused] = useState(false);
  const [missed, setMissed] = useState(0);
  const pausedRef = useRef(paused);
  const queueRef = useRef<LogEntry[]>([]);
  pausedRef.current = paused;

  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && initial.length) {
      seeded.current = true;
      setLogs(initial.slice(0, max));
    }
  }, [initial, max]);

  useEffect(() => {
    return api.openLogStream((log) => {
      if (pausedRef.current) {
        queueRef.current.unshift(log);
        setMissed((m) => m + 1);
        return;
      }
      setLogs((prev) => [log, ...prev].slice(0, max));
    });
  }, [max]);

  const toggle = useCallback(() => {
    setPaused((p) => {
      if (p) {
        const q = queueRef.current;
        queueRef.current = [];
        setLogs((prev) => [...q, ...prev].slice(0, max));
        setMissed(0);
      }
      return !p;
    });
  }, [max]);

  return { logs, paused, toggle, missed };
}
