import { CleanedDataRecord } from '../data/rawDataset.ts';

export interface NumericStats {
  field: string;
  label: string;
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
}

export interface CategorySummary {
  category: string;
  count: number;
  percentage: number;
  stableRatio: number;
  avgLatencyMs: number;
  avgTokens: number;
  avgRisk: number;
}

export interface OutlierItem {
  id: string;
  category: string;
  variable: string;
  execution: string;
  field: string;
  value: number;
  zScore: number;
  iqrDistance: number;
  severity: 'MODERATE' | 'EXTREME';
}

export interface TrendDataPoint {
  batch: string;
  index: number;
  avgLatencyMs: number;
  stableCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalVolume: number;
  avgRisk: number;
}

export interface FullAnalysisReport {
  totalRecords: number;
  executionDistribution: {
    STABLE: { count: number; percentage: number };
    PENDING: { count: number; percentage: number };
    REJECTED: { count: number; percentage: number };
  };
  numericStatistics: {
    latency: NumericStats;
    tokens: NumericStats;
    risk: NumericStats;
    invocations: NumericStats;
  };
  categoryBreakdown: CategorySummary[];
  outliers: OutlierItem[];
  trendSeries: TrendDataPoint[];
}

function calculateStats(values: number[], field: string, label: string): NumericStats {
  if (values.length === 0) {
    return {
      field,
      label,
      count: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      skewness: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];

  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;

  // Median
  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Quartiles
  const q1 = sorted[Math.floor(count * 0.25)];
  const q3 = sorted[Math.floor(count * 0.75)];
  const iqr = q3 - q1;

  // Variance & Standard Deviation
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  // Skewness: 3 * (mean - median) / stdDev
  const skewness = stdDev > 0 ? Number(((3 * (mean - median)) / stdDev).toFixed(2)) : 0;

  return {
    field,
    label,
    count,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    iqr: Number(iqr.toFixed(2)),
    skewness,
  };
}

export function performStatisticalAnalysis(records: CleanedDataRecord[]): FullAnalysisReport {
  const totalRecords = records.length || 1;

  // 1. Execution status distribution
  let stableCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  const latencies: number[] = [];
  const tokens: number[] = [];
  const risks: number[] = [];
  const invocations: number[] = [];

  const categoryMap = new Map<string, {
    count: number;
    stable: number;
    latencySum: number;
    tokenSum: number;
    riskSum: number;
  }>();

  for (const r of records) {
    if (r.execution === 'STABLE') stableCount++;
    else if (r.execution === 'PENDING') pendingCount++;
    else if (r.execution === 'REJECTED') rejectedCount++;

    latencies.push(r.latency_ms);
    tokens.push(r.token_payload);
    risks.push(r.risk_score);
    invocations.push(r.invocation_count);

    const cat = r.category;
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { count: 0, stable: 0, latencySum: 0, tokenSum: 0, riskSum: 0 });
    }
    const cData = categoryMap.get(cat)!;
    cData.count++;
    if (r.execution === 'STABLE') cData.stable++;
    cData.latencySum += r.latency_ms;
    cData.tokenSum += r.token_payload;
    cData.riskSum += r.risk_score;
  }

  const executionDistribution = {
    STABLE: { count: stableCount, percentage: Number(((stableCount / totalRecords) * 100).toFixed(1)) },
    PENDING: { count: pendingCount, percentage: Number(((pendingCount / totalRecords) * 100).toFixed(1)) },
    REJECTED: { count: rejectedCount, percentage: Number(((rejectedCount / totalRecords) * 100).toFixed(1)) },
  };

  // 2. Numeric Statistics
  const latencyStats = calculateStats(latencies, 'latency_ms', 'Response Latency (ms)');
  const tokenStats = calculateStats(tokens, 'token_payload', 'Token Payload (toks)');
  const riskStats = calculateStats(risks, 'risk_score', 'Operational Risk Index');
  const invocationStats = calculateStats(invocations, 'invocation_count', 'Invocation Volume');

  // 3. Category Breakdown
  const categoryBreakdown: CategorySummary[] = Array.from(categoryMap.entries()).map(([cat, c]) => ({
    category: cat,
    count: c.count,
    percentage: Number(((c.count / totalRecords) * 100).toFixed(1)),
    stableRatio: Number(((c.stable / (c.count || 1)) * 100).toFixed(1)),
    avgLatencyMs: Number((c.latencySum / (c.count || 1)).toFixed(2)),
    avgTokens: Math.round(c.tokenSum / (c.count || 1)),
    avgRisk: Number((c.riskSum / (c.count || 1)).toFixed(2)),
  })).sort((a, b) => b.count - a.count);

  // 4. Outlier Analysis (Z-Score & IQR)
  const outliers: OutlierItem[] = [];
  const upperLatencyFence = latencyStats.q3 + 1.5 * latencyStats.iqr;

  for (const r of records) {
    const latZ = latencyStats.stdDev > 0 ? (r.latency_ms - latencyStats.mean) / latencyStats.stdDev : 0;
    const tokZ = tokenStats.stdDev > 0 ? (r.token_payload - tokenStats.mean) / tokenStats.stdDev : 0;

    if (r.latency_ms > upperLatencyFence || Math.abs(latZ) > 2.5) {
      outliers.push({
        id: r.id,
        category: r.category,
        variable: r.variable,
        execution: r.execution,
        field: 'Latency',
        value: r.latency_ms,
        zScore: Number(latZ.toFixed(2)),
        iqrDistance: Number(((r.latency_ms - latencyStats.q3) / (latencyStats.iqr || 1)).toFixed(2)),
        severity: latZ > 4.0 || r.latency_ms > 500 ? 'EXTREME' : 'MODERATE',
      });
    } else if (tokZ > 3.0) {
      outliers.push({
        id: r.id,
        category: r.category,
        variable: r.variable,
        execution: r.execution,
        field: 'Token Payload',
        value: r.token_payload,
        zScore: Number(tokZ.toFixed(2)),
        iqrDistance: Number(((r.token_payload - tokenStats.q3) / (tokenStats.iqr || 1)).toFixed(2)),
        severity: tokZ > 4.5 ? 'EXTREME' : 'MODERATE',
      });
    }
  }

  // 5. Sequential Trend Aggregation (bucketed by ~50 records or batches)
  const bucketSize = Math.max(10, Math.floor(records.length / 20));
  const trendSeries: TrendDataPoint[] = [];

  for (let i = 0; i < records.length; i += bucketSize) {
    const slice = records.slice(i, i + bucketSize);
    let latSum = 0;
    let riskSum = 0;
    let stCount = 0;
    let pendCount = 0;
    let rejCount = 0;

    for (const item of slice) {
      latSum += item.latency_ms;
      riskSum += item.risk_score;
      if (item.execution === 'STABLE') stCount++;
      else if (item.execution === 'PENDING') pendCount++;
      else if (item.execution === 'REJECTED') rejCount++;
    }

    const batchLabel = `B-${Math.floor(i / bucketSize) + 1}`;
    trendSeries.push({
      batch: batchLabel,
      index: Math.floor(i / bucketSize) + 1,
      avgLatencyMs: Number((latSum / slice.length).toFixed(1)),
      stableCount: stCount,
      pendingCount: pendCount,
      rejectedCount: rejCount,
      totalVolume: slice.length,
      avgRisk: Number((riskSum / slice.length).toFixed(2)),
    });
  }

  return {
    totalRecords: records.length,
    executionDistribution,
    numericStatistics: {
      latency: latencyStats,
      tokens: tokenStats,
      risk: riskStats,
      invocations: invocationStats,
    },
    categoryBreakdown,
    outliers,
    trendSeries,
  };
}
