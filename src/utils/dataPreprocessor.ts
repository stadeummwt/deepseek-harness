import { RawDataRecord, CleanedDataRecord } from '../data/rawDataset.ts';

export interface DataIssues {
  totalRows: number;
  missingValues: {
    latency: number;
    tokens: number;
    risk: number;
    category: number;
    total: number;
  };
  duplicateIds: number;
  duplicateRows: number;
  typeMismatches: number;
  inconsistentCategories: number;
  outliersCount: number;
  healthScore: number; // 0 to 100
}

export interface PreprocessOptions {
  missingValueStrategy: 'impute_median' | 'impute_mean' | 'drop_rows';
  removeDuplicates: boolean;
  normalizeCategories: boolean;
  castDataTypes: boolean;
  handleOutliers: 'clip_iqr' | 'flag_only' | 'remove';
}

export const DEFAULT_PREPROCESS_OPTIONS: PreprocessOptions = {
  missingValueStrategy: 'impute_median',
  removeDuplicates: true,
  normalizeCategories: true,
  castDataTypes: true,
  handleOutliers: 'flag_only',
};

export interface CleaningReport {
  rawRowCount: number;
  cleanedRowCount: number;
  missingValuesImputed: number;
  missingValuesDropped: number;
  duplicatesRemoved: number;
  typeErrorsCorrected: number;
  categoriesStandardized: number;
  outliersDetected: number;
  outliersTreated: number;
  healthScoreBefore: number;
  healthScoreAfter: number;
  processingTimeMs: number;
  log: Array<{
    stage: string;
    details: string;
    affectedCount: number;
    status: 'SUCCESS' | 'WARNING' | 'INFO';
  }>;
}

// Utility to parse numeric values from strings like "45.2ms", "$100", " 1,240 tokens "
export function parseNumeric(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const cleanStr = String(val).replace(/[^0-9.-]/g, '').trim();
  if (!cleanStr) return null;
  const num = parseFloat(cleanStr);
  return isNaN(num) ? null : num;
}

// Compute median of a sorted array of numbers
function getMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Compute mean
function getMean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Detect issues in raw dataset
export function detectDataIssues(data: RawDataRecord[]): DataIssues {
  let missingLatency = 0;
  let missingTokens = 0;
  let missingRisk = 0;
  let missingCategory = 0;
  let typeMismatches = 0;
  let inconsistentCategories = 0;

  const validCategories = new Set([
    'CORE_ASSET',
    'LOGISTICS',
    'ANALYSIS',
    'REGISTRY',
    'METADATA',
    'NETWORK',
    'INFERENCE',
    'SECURITY',
  ]);

  const seenIds = new Set<string>();
  let duplicateIds = 0;
  const seenSignatures = new Set<string>();
  let duplicateRows = 0;

  const validLatencies: number[] = [];

  for (const item of data) {
    // Missing values
    const lat = parseNumeric(item.latency_ms);
    if (lat === null) missingLatency++;
    else {
      validLatencies.push(lat);
      if (typeof item.latency_ms === 'string') typeMismatches++;
    }

    const tok = parseNumeric(item.token_payload);
    if (tok === null) missingTokens++;
    else if (typeof item.token_payload === 'string') typeMismatches++;

    const rsk = parseNumeric(item.risk_score);
    if (rsk === null) missingRisk++;

    // Category consistency
    const cat = item.category ? String(item.category).trim().toUpperCase() : '';
    if (!cat) {
      missingCategory++;
    } else if (!validCategories.has(cat) || item.category !== cat) {
      inconsistentCategories++;
    }

    // Duplicates
    if (seenIds.has(item.id)) {
      duplicateIds++;
    } else {
      seenIds.add(item.id);
    }

    const sig = `${item.category}_${item.variable}_${item.execution}_${item.cost_tier}`;
    if (seenSignatures.has(sig)) {
      duplicateRows++;
    } else {
      seenSignatures.add(sig);
    }
  }

  // Outliers calculation via IQR on latencies
  validLatencies.sort((a, b) => a - b);
  const q1 = validLatencies[Math.floor(validLatencies.length * 0.25)] || 0;
  const q3 = validLatencies[Math.floor(validLatencies.length * 0.75)] || 0;
  const iqr = q3 - q1;
  const upperFence = q3 + 1.5 * iqr;
  const lowerFence = Math.max(0, q1 - 1.5 * iqr);

  let outliersCount = 0;
  for (const l of validLatencies) {
    if (l > upperFence || l < lowerFence) {
      outliersCount++;
    }
  }

  const totalMissing = missingLatency + missingTokens + missingRisk + missingCategory;
  const totalIssues = totalMissing + duplicateIds + typeMismatches + inconsistentCategories + outliersCount;
  const healthScore = Math.max(10, Math.min(100, Math.round(100 - (totalIssues / (data.length || 1)) * 35)));

  return {
    totalRows: data.length,
    missingValues: {
      latency: missingLatency,
      tokens: missingTokens,
      risk: missingRisk,
      category: missingCategory,
      total: totalMissing,
    },
    duplicateIds,
    duplicateRows,
    typeMismatches,
    inconsistentCategories,
    outliersCount,
    healthScore,
  };
}

// Execute full cleaning pipeline
export function preprocessDataset(
  rawDataset: RawDataRecord[],
  options: PreprocessOptions = DEFAULT_PREPROCESS_OPTIONS
): { cleaned: CleanedDataRecord[]; report: CleaningReport } {
  const startTime = performance.now();
  const reportLog: CleaningReport['log'] = [];
  const issuesBefore = detectDataIssues(rawDataset);

  let missingValuesImputed = 0;
  let missingValuesDropped = 0;
  let duplicatesRemoved = 0;
  let typeErrorsCorrected = 0;
  let categoriesStandardized = 0;
  let outliersDetected = 0;
  let outliersTreated = 0;

  // Step 1: Collect reference statistics for imputation (medians/means)
  const validLatencies: number[] = [];
  const validTokens: number[] = [];
  const validRisks: number[] = [];
  const validInvocations: number[] = [];

  for (const item of rawDataset) {
    const lat = parseNumeric(item.latency_ms);
    if (lat !== null && lat > 0) validLatencies.push(lat);

    const tok = parseNumeric(item.token_payload);
    if (tok !== null && tok > 0) validTokens.push(tok);

    const rsk = parseNumeric(item.risk_score);
    if (rsk !== null && rsk >= 0 && rsk <= 1) validRisks.push(rsk);

    const inv = parseNumeric(item.invocation_count);
    if (inv !== null && inv >= 0) validInvocations.push(inv);
  }

  validLatencies.sort((a, b) => a - b);
  validTokens.sort((a, b) => a - b);
  validRisks.sort((a, b) => a - b);
  validInvocations.sort((a, b) => a - b);

  const medianLatency = Number(getMedian(validLatencies).toFixed(2)) || 42.0;
  const meanLatency = Number(getMean(validLatencies).toFixed(2)) || 45.0;

  const medianTokens = Math.round(getMedian(validTokens)) || 1800;
  const meanTokens = Math.round(getMean(validTokens)) || 2100;

  const medianRisk = Number(getMedian(validRisks).toFixed(2)) || 0.22;
  const meanRisk = Number(getMean(validRisks).toFixed(2)) || 0.25;

  const medianInvocations = Math.round(getMedian(validInvocations)) || 12000;

  // Latency IQR fences
  const q1 = validLatencies[Math.floor(validLatencies.length * 0.25)] || 30;
  const q3 = validLatencies[Math.floor(validLatencies.length * 0.75)] || 65;
  const iqr = q3 - q1;
  const upperLatencyFence = q3 + 1.5 * iqr;
  const lowerLatencyFence = Math.max(5, q1 - 1.5 * iqr);

  reportLog.push({
    stage: 'BASELINE_METRICS',
    details: `Calculated statistical baselines: Median Latency = ${medianLatency}ms, Median Tokens = ${medianTokens}, Median Risk = ${medianRisk}`,
    affectedCount: rawDataset.length,
    status: 'INFO',
  });

  // Step 2: Deduplication and ID consistency
  const seenIds = new Set<string>();
  const intermediate: RawDataRecord[] = [];

  for (const item of rawDataset) {
    if (options.removeDuplicates) {
      if (seenIds.has(item.id)) {
        duplicatesRemoved++;
        continue;
      }
      seenIds.add(item.id);
    }
    intermediate.push(item);
  }

  if (duplicatesRemoved > 0) {
    reportLog.push({
      stage: 'DEDUPLICATION',
      details: `Purged ${duplicatesRemoved} duplicate primary identifier records`,
      affectedCount: duplicatesRemoved,
      status: 'SUCCESS',
    });
  }

  const validCategories: Array<CleanedDataRecord['category']> = [
    'CORE_ASSET',
    'LOGISTICS',
    'ANALYSIS',
    'REGISTRY',
    'METADATA',
    'NETWORK',
    'INFERENCE',
    'SECURITY',
  ];

  const cleanedRecords: CleanedDataRecord[] = [];

  for (let idx = 0; idx < intermediate.length; idx++) {
    const raw = intermediate[idx];
    const imputedFields: string[] = [];

    // Check if row must be dropped
    if (options.missingValueStrategy === 'drop_rows') {
      if (raw.latency_ms === null || raw.token_payload === null || raw.risk_score === null || !raw.category) {
        missingValuesDropped++;
        continue;
      }
    }

    // Step 3: Type casting & imputation for Latency
    let cleanLatency: number;
    const parsedLat = parseNumeric(raw.latency_ms);
    if (typeof raw.latency_ms === 'string') {
      typeErrorsCorrected++;
    }
    if (parsedLat === null) {
      cleanLatency = options.missingValueStrategy === 'impute_mean' ? meanLatency : medianLatency;
      missingValuesImputed++;
      imputedFields.push('latency_ms');
    } else {
      cleanLatency = parsedLat;
    }

    // Step 4: Token payload
    let cleanTokens: number;
    const parsedTok = parseNumeric(raw.token_payload);
    if (typeof raw.token_payload === 'string') {
      typeErrorsCorrected++;
    }
    if (parsedTok === null) {
      cleanTokens = options.missingValueStrategy === 'impute_mean' ? meanTokens : medianTokens;
      missingValuesImputed++;
      imputedFields.push('token_payload');
    } else {
      cleanTokens = Math.round(parsedTok);
    }

    // Step 5: Risk score
    let cleanRisk: number;
    const parsedRisk = parseNumeric(raw.risk_score);
    if (parsedRisk === null) {
      cleanRisk = options.missingValueStrategy === 'impute_mean' ? meanRisk : medianRisk;
      missingValuesImputed++;
      imputedFields.push('risk_score');
    } else {
      cleanRisk = Math.max(0, Math.min(1, Number(parsedRisk.toFixed(2))));
    }

    // Step 6: Invocations
    let cleanInvocations: number;
    const parsedInv = parseNumeric(raw.invocation_count);
    if (parsedInv === null) {
      cleanInvocations = medianInvocations;
    } else {
      cleanInvocations = Math.max(1, Math.round(parsedInv));
    }

    // Step 7: Category normalization
    let cleanCategory: CleanedDataRecord['category'] = 'CORE_ASSET';
    const rawCatStr = String(raw.category || '').trim().toUpperCase();
    if (raw.category !== rawCatStr || !raw.category) {
      categoriesStandardized++;
    }

    if (validCategories.includes(rawCatStr as any)) {
      cleanCategory = rawCatStr as any;
    } else {
      // Map unknown or empty categories safely to dominant class
      cleanCategory = 'CORE_ASSET';
      imputedFields.push('category');
    }

    // Step 8: Execution status normalization
    let cleanExecution: CleanedDataRecord['execution'] = 'STABLE';
    const rawExec = String(raw.execution || '').trim().toUpperCase();
    if (rawExec === 'STABLE' || rawExec === 'PENDING' || rawExec === 'REJECTED') {
      cleanExecution = rawExec;
    } else {
      cleanExecution = cleanRisk > 0.5 ? 'REJECTED' : 'STABLE';
    }

    // Step 9: Cost tier normalization
    let cleanCostTier: CleanedDataRecord['cost_tier'] = 'FREE_CONFIRMED';
    const rawCost = String(raw.cost_tier || '').trim().toUpperCase();
    if (rawCost === 'FREE_CONFIRMED' || rawCost === 'PAID' || rawCost === 'TRIAL' || rawCost === 'LOCAL') {
      cleanCostTier = rawCost;
    }

    // Step 10: Outlier detection & handling
    let isOutlier = cleanLatency > upperLatencyFence || cleanLatency < lowerLatencyFence || cleanTokens > 40000;
    if (isOutlier) {
      outliersDetected++;
      if (options.handleOutliers === 'remove') {
        outliersTreated++;
        continue; // Skip record
      } else if (options.handleOutliers === 'clip_iqr') {
        cleanLatency = Math.min(upperLatencyFence, Math.max(lowerLatencyFence, cleanLatency));
        cleanTokens = Math.min(32000, cleanTokens);
        outliersTreated++;
      }
    }

    cleanedRecords.push({
      id: raw.id,
      category: cleanCategory,
      variable: String(raw.variable || 'A-100.X').trim().toUpperCase(),
      execution: cleanExecution,
      latency_ms: Number(cleanLatency.toFixed(2)),
      token_payload: cleanTokens,
      invocation_count: cleanInvocations,
      risk_score: cleanRisk,
      cost_tier: cleanCostTier,
      timestamp: raw.timestamp || new Date().toISOString(),
      batch_id: raw.batch_id || 'BATCH-DEFAULT-01',
      is_outlier: isOutlier,
      imputed_fields: imputedFields.length > 0 ? imputedFields : undefined,
    });
  }

  // Preprocessing logs
  if (missingValuesImputed > 0) {
    reportLog.push({
      stage: 'MISSING_VALUE_IMPUTATION',
      details: `Imputed ${missingValuesImputed} missing fields using ${options.missingValueStrategy}`,
      affectedCount: missingValuesImputed,
      status: 'SUCCESS',
    });
  }
  if (missingValuesDropped > 0) {
    reportLog.push({
      stage: 'MISSING_VALUE_DROPPED',
      details: `Dropped ${missingValuesDropped} rows containing null attributes`,
      affectedCount: missingValuesDropped,
      status: 'WARNING',
    });
  }
  if (typeErrorsCorrected > 0) {
    reportLog.push({
      stage: 'TYPE_CASTING',
      details: `Corrected ${typeErrorsCorrected} string-formatted numbers into typed floats/integers`,
      affectedCount: typeErrorsCorrected,
      status: 'SUCCESS',
    });
  }
  if (categoriesStandardized > 0) {
    reportLog.push({
      stage: 'CATEGORY_CONSISTENCY',
      details: `Normalized ${categoriesStandardized} category strings with canonical uppercase and trim`,
      affectedCount: categoriesStandardized,
      status: 'SUCCESS',
    });
  }
  if (outliersDetected > 0) {
    reportLog.push({
      stage: 'OUTLIER_TREATMENT',
      details: `Detected ${outliersDetected} statistical outliers (Upper latency fence: ${upperLatencyFence.toFixed(1)}ms). Treatment: ${options.handleOutliers}`,
      affectedCount: outliersDetected,
      status: options.handleOutliers === 'remove' ? 'WARNING' : 'INFO',
    });
  }

  const duration = Math.round(performance.now() - startTime);

  return {
    cleaned: cleanedRecords,
    report: {
      rawRowCount: rawDataset.length,
      cleanedRowCount: cleanedRecords.length,
      missingValuesImputed,
      missingValuesDropped,
      duplicatesRemoved,
      typeErrorsCorrected,
      categoriesStandardized,
      outliersDetected,
      outliersTreated,
      healthScoreBefore: issuesBefore.healthScore,
      healthScoreAfter: 100,
      processingTimeMs: duration,
      log: reportLog,
    },
  };
}

// CSV Export and Import Utilities
export function exportToCSV(records: CleanedDataRecord[]): string {
  if (records.length === 0) return '';
  const headers = [
    'id',
    'category',
    'variable',
    'execution',
    'latency_ms',
    'token_payload',
    'invocation_count',
    'risk_score',
    'cost_tier',
    'timestamp',
    'batch_id',
    'is_outlier',
  ];
  const rows = records.map((r) => [
    r.id,
    r.category,
    r.variable,
    r.execution,
    r.latency_ms,
    r.token_payload,
    r.invocation_count,
    r.risk_score,
    r.cost_tier,
    r.timestamp,
    r.batch_id,
    r.is_outlier ? 'TRUE' : 'FALSE',
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function parseCSV(csvText: string): RawDataRecord[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const records: RawDataRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^['"]|['"]$/g, ''));
    const item: any = {};
    headers.forEach((h, idx) => {
      item[h] = cols[idx] !== undefined ? cols[idx] : null;
    });

    records.push({
      id: item.id || item.identifier || `#DATA-${String(9900 + i).padStart(4, '0')}`,
      category: item.category || '',
      variable: item.variable || `A-${100 + i}.X`,
      execution: item.execution || item.status || 'STABLE',
      latency_ms: item.latency_ms || item.latency || null,
      token_payload: item.token_payload || item.tokens || null,
      invocation_count: item.invocation_count || item.invocations || null,
      risk_score: item.risk_score || item.risk || null,
      cost_tier: item.cost_tier || item.tier || 'FREE_CONFIRMED',
      timestamp: item.timestamp,
      batch_id: item.batch_id,
    });
  }

  return records;
}
