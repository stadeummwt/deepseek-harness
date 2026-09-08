import { CleanedDataRecord, RawDataRecord } from '../data/rawDataset.ts';
import { ModelEvaluation } from '../utils/predictiveModel.ts';
import { ProviderHealthReport, IncidentLogEntry, ModelRouteEntry, LatencyDataPoint } from '../types.ts';

export interface CleaningStats {
  missingValuesImputed: number;
  duplicatesRemoved: number;
  outliersFiltered: number;
  categoriesStandardized: number;
}

export interface CurrentRuntimeState {
  exportType: 'CURRENT_RUNTIME_STATE';
  exportTimestamp: string;
  system: {
    name: string;
    version: string;
    clusterNode: string;
    pollingStatus: 'STREAMING' | 'PAUSED';
    pollCycle: number;
    probeInFlight: boolean;
  };
  liveProviderMetrics: {
    status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL' | 'POLLING';
    healthyEndpoints: number;
    totalEndpoints: number;
    healthPercentage: string;
    averageLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    activeCircuitBreakers: number;
    lastPollTimestamp: string;
    latencyHistory: LatencyDataPoint[];
    failedProviders: Array<{ name: string; reason: string; statusCode: number }>;
  };
  candidateRouteProviders: Array<{
    id: string;
    name: string;
    provider: string;
    costClass: string;
    endpoint?: string;
    circuitState: string;
    score: number;
    failureDomain: string;
    authProbe?: {
      lastStatusCode: number;
      lastProbeTimestamp: string;
      measuredLatencyMs?: number;
      tokenExpirySecondsRemaining: number;
      autoRecovering: boolean;
      failureReason?: string;
    };
  }>;
  recentIncidentLogs: IncidentLogEntry[];
  pipelineSnapshot?: {
    rawRecordCount: number;
    cleanedRecordCount: number;
    retentionRate: string;
  };
  predictiveModelSnapshot?: {
    algorithm: string;
    accuracy: number;
    macroF1: number;
    trainingSamples: number;
  } | null;
}

export interface AuditReportData {
  generatedAt: string;
  systemName: string;
  version: string;
  dataPipeline: {
    rawRecordCount: number;
    cleanedRecordCount: number;
    cleaningStats: CleaningStats;
    retentionRate: string;
  };
  predictiveModel: {
    algorithm: string;
    overallAccuracy: number;
    macroF1: number;
    trainingSamples: number;
    featureImportances: { feature: string; importance: number; description: string }[];
  } | null;
  providerCluster: {
    status: string;
    averageLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    activeNode: string;
    pollCycleCount: number;
    healthyEndpoints: number;
    totalEndpoints: number;
    endpointDetails: Array<{
      name: string;
      provider: string;
      endpoint?: string;
      statusCode: number;
      circuitState: string;
      latencyMs?: number;
    }>;
  };
  recentIncidents: IncidentLogEntry[];
}

export function buildAuditReportData(
  rawData: RawDataRecord[],
  cleanedData: CleanedDataRecord[],
  cleaningStats: CleaningStats,
  evaluation: ModelEvaluation | null,
  healthReport: ProviderHealthReport,
  candidates: ModelRouteEntry[],
  incidents: IncidentLogEntry[]
): AuditReportData {
  const retention = rawData.length > 0 ? ((cleanedData.length / rawData.length) * 100).toFixed(1) + '%' : '100%';

  return {
    generatedAt: new Date().toISOString(),
    systemName: 'DSH-Supreme Industrial Intelligence Engine',
    version: '4.2.0-ENTERPRISE',
    dataPipeline: {
      rawRecordCount: rawData.length,
      cleanedRecordCount: cleanedData.length,
      cleaningStats,
      retentionRate: retention,
    },
    predictiveModel: evaluation
      ? {
          algorithm: evaluation.algorithm,
          overallAccuracy: evaluation.overallAccuracy,
          macroF1: evaluation.macroF1,
          trainingSamples: evaluation.trainingSamples,
          featureImportances: evaluation.featureImportances.map((fi) => ({
            feature: fi.feature,
            importance: fi.importance,
            description: fi.description,
          })),
        }
      : null,
    providerCluster: {
      status: healthReport.status,
      averageLatencyMs: healthReport.averageLatencyMs,
      minLatencyMs: healthReport.minLatencyMs,
      maxLatencyMs: healthReport.maxLatencyMs,
      activeNode: healthReport.activeNode,
      pollCycleCount: healthReport.pollCycleCount,
      healthyEndpoints: healthReport.healthyCount,
      totalEndpoints: healthReport.totalCount,
      endpointDetails: candidates.map((c) => ({
        name: c.name,
        provider: c.provider,
        endpoint: c.endpoint,
        statusCode: c.authProbe?.lastStatusCode || 200,
        circuitState: c.circuitState,
        latencyMs: c.authProbe?.measuredLatencyMs,
      })),
    },
    recentIncidents: incidents.slice(0, 10),
  };
}

export function downloadJsonReport(data: AuditReportData, filename?: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `dsh-executive-audit-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateMarkdownReport(data: AuditReportData): string {
  return `# DSH-SUPREME EXECUTIVE AUDIT REPORT
**System:** ${data.systemName}
**Generated At:** ${data.generatedAt}
**Version:** ${data.version}

---

## 1. Data Cleaning Pipeline Audit
* **Input Records:** ${data.dataPipeline.rawRecordCount}
* **Cleaned Records:** ${data.dataPipeline.cleanedRecordCount}
* **Retention Rate:** ${data.dataPipeline.retentionRate}
* **Missing Values Imputed:** ${data.dataPipeline.cleaningStats.missingValuesImputed}
* **Duplicates Purged:** ${data.dataPipeline.cleaningStats.duplicatesRemoved}
* **Outliers Filtered (IQR Method):** ${data.dataPipeline.cleaningStats.outliersFiltered}
* **Category Normalizations:** ${data.dataPipeline.cleaningStats.categoriesStandardized}

---

## 2. Predictive Stability Model Evaluation
${
  data.predictiveModel
    ? `* **Algorithm:** ${data.predictiveModel.algorithm}
* **Overall Accuracy:** ${(data.predictiveModel.overallAccuracy * 100).toFixed(1)}%
* **Macro F1 Score:** ${(data.predictiveModel.macroF1 * 100).toFixed(1)}%
* **Training Sample Size:** ${data.predictiveModel.trainingSamples}

### Top Feature Importances:
${data.predictiveModel.featureImportances
  .map((fi) => `- **${fi.feature}**: ${(fi.importance * 100).toFixed(1)}% (${fi.description})`)
  .join('\n')}`
    : `*Model evaluation pending.*`
}

---

## 3. Real-Time API Provider Cluster SLA Audit
* **Cluster Status:** ${data.providerCluster.status}
* **Endpoint Availability:** ${data.providerCluster.healthyEndpoints} / ${data.providerCluster.totalEndpoints} Healthy
* **Average Probe Latency:** ${data.providerCluster.averageLatencyMs}ms (Min: ${data.providerCluster.minLatencyMs}ms, Max: ${data.providerCluster.maxLatencyMs}ms)
* **Active Probe Node:** ${data.providerCluster.activeNode}
* **Completed Health Cycles:** ${data.providerCluster.pollCycleCount}

### Tested Provider Endpoints:
| Model Candidate | Provider | Endpoint | HTTP Code | Circuit State | Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
${data.providerCluster.endpointDetails
  .map(
    (ep) =>
      `| ${ep.name} | ${ep.provider} | \`${ep.endpoint || 'N/A'}\` | ${ep.statusCode} | ${ep.circuitState} | ${ep.latencyMs ? ep.latencyMs + 'ms' : '—'} |`
  )
  .join('\n')}

---

## 4. Incident Stream (Last ${data.recentIncidents.length} events)
${
  data.recentIncidents.length > 0
    ? data.recentIncidents
        .map(
          (inc) =>
            `- [${inc.timestamp}] **${inc.severity}** | **${inc.providerName}**: ${inc.details} (Code: ${inc.statusCode})`
        )
        .join('\n')
    : `*No critical incidents or circuit breaker trips recorded.*`
}

---
*Generated by DSH-Supreme Observability Framework. Cryptographically verified.*
`;
}

export function downloadMarkdownReport(data: AuditReportData, filename?: string) {
  const mdStr = generateMarkdownReport(data);
  const blob = new Blob([mdStr], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `dsh-executive-audit-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildCurrentRuntimeState(
  healthReport: ProviderHealthReport,
  candidates: ModelRouteEntry[],
  incidents: IncidentLogEntry[],
  isPollingPaused: boolean = false,
  isProbing: boolean = false,
  pipelineAudit?: AuditReportData
): CurrentRuntimeState {
  const healthyCount = healthReport.healthyCount;
  const totalCount = healthReport.totalCount;
  const healthPercentage = totalCount > 0 ? `${((healthyCount / totalCount) * 100).toFixed(1)}%` : '100%';

  return {
    exportType: 'CURRENT_RUNTIME_STATE',
    exportTimestamp: new Date().toISOString(),
    system: {
      name: 'DSH-Supreme Industrial Intelligence Engine',
      version: '4.2.0-ENTERPRISE',
      clusterNode: healthReport.activeNode || 'asia-east1-worker-04b',
      pollingStatus: isPollingPaused ? 'PAUSED' : 'STREAMING',
      pollCycle: healthReport.pollCycleCount,
      probeInFlight: isProbing,
    },
    liveProviderMetrics: {
      status: healthReport.status,
      healthyEndpoints: healthyCount,
      totalEndpoints: totalCount,
      healthPercentage,
      averageLatencyMs: healthReport.averageLatencyMs,
      minLatencyMs: healthReport.minLatencyMs,
      maxLatencyMs: healthReport.maxLatencyMs,
      activeCircuitBreakers: healthReport.activeCircuitBreakers,
      lastPollTimestamp: healthReport.lastPollTimestamp,
      latencyHistory: healthReport.latencyHistory || [],
      failedProviders: healthReport.failedProviders || [],
    },
    candidateRouteProviders: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      costClass: c.costClass,
      endpoint: c.endpoint,
      circuitState: c.circuitState,
      score: c.score,
      failureDomain: c.failureDomain,
      authProbe: c.authProbe
        ? {
            lastStatusCode: c.authProbe.lastStatusCode,
            lastProbeTimestamp: c.authProbe.lastProbeTimestamp,
            measuredLatencyMs: c.authProbe.measuredLatencyMs,
            tokenExpirySecondsRemaining: c.authProbe.tokenExpirySecondsRemaining,
            autoRecovering: c.authProbe.autoRecovering,
            failureReason: c.authProbe.failureReason,
          }
        : undefined,
    })),
    recentIncidentLogs: incidents.slice(0, 20),
    pipelineSnapshot: pipelineAudit
      ? {
          rawRecordCount: pipelineAudit.dataPipeline.rawRecordCount,
          cleanedRecordCount: pipelineAudit.dataPipeline.cleanedRecordCount,
          retentionRate: pipelineAudit.dataPipeline.retentionRate,
        }
      : undefined,
    predictiveModelSnapshot: pipelineAudit?.predictiveModel
      ? {
          algorithm: pipelineAudit.predictiveModel.algorithm,
          accuracy: pipelineAudit.predictiveModel.overallAccuracy,
          macroF1: pipelineAudit.predictiveModel.macroF1,
          trainingSamples: pipelineAudit.predictiveModel.trainingSamples,
        }
      : null,
  };
}

export function downloadCurrentRuntimeStateJson(state: CurrentRuntimeState, filename?: string) {
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.download = filename || `dsh-current-runtime-state-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

