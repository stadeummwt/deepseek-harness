export interface RawDataRecord {
  id: string;
  category: string;
  variable: string;
  execution: string;
  latency_ms: number | string | null;
  token_payload: number | string | null;
  invocation_count: number | string | null;
  risk_score: number | string | null;
  cost_tier: string;
  timestamp?: string;
  batch_id?: string;
}

export interface CleanedDataRecord {
  id: string;
  category: 'CORE_ASSET' | 'LOGISTICS' | 'ANALYSIS' | 'REGISTRY' | 'METADATA' | 'NETWORK' | 'INFERENCE' | 'SECURITY';
  variable: string;
  execution: 'STABLE' | 'PENDING' | 'REJECTED';
  latency_ms: number;
  token_payload: number;
  invocation_count: number;
  risk_score: number;
  cost_tier: 'FREE_CONFIRMED' | 'PAID' | 'TRIAL' | 'LOCAL';
  timestamp: string;
  batch_id: string;
  is_outlier?: boolean;
  imputed_fields?: string[];
}

// Seed the first 6 canonical records exactly as specified in the UI design:
// #DATA-9901 CORE_ASSET A-788.X STABLE
// #DATA-9902 LOGISTICS B-112.P STABLE
// #DATA-9903 ANALYSIS C-009.R PENDING
// #DATA-9904 REGISTRY D-441.S STABLE
// #DATA-9905 METADATA E-212.T REJECTED
// #DATA-9906 NETWORK F-880.U STABLE

export function generateCanonicalDataset(): RawDataRecord[] {
  const records: RawDataRecord[] = [
    {
      id: '#DATA-9901',
      category: 'CORE_ASSET',
      variable: 'A-788.X',
      execution: 'STABLE',
      latency_ms: 38.5,
      token_payload: 1250,
      invocation_count: 14200,
      risk_score: 0.12,
      cost_tier: 'FREE_CONFIRMED',
      timestamp: '2026-09-06T14:00:01.120Z',
      batch_id: 'BATCH-ALPHA-01',
    },
    {
      id: '#DATA-9902',
      category: 'LOGISTICS',
      variable: 'B-112.P',
      execution: 'STABLE',
      latency_ms: 42.1,
      token_payload: 2100,
      invocation_count: 8900,
      risk_score: 0.18,
      cost_tier: 'FREE_CONFIRMED',
      timestamp: '2026-09-06T14:00:05.440Z',
      batch_id: 'BATCH-ALPHA-01',
    },
    {
      id: '#DATA-9903',
      category: 'ANALYSIS',
      variable: 'C-009.R',
      execution: 'PENDING',
      latency_ms: 89.4,
      token_payload: 5600,
      invocation_count: 3100,
      risk_score: 0.45,
      cost_tier: 'TRIAL',
      timestamp: '2026-09-06T14:00:09.810Z',
      batch_id: 'BATCH-ALPHA-02',
    },
    {
      id: '#DATA-9904',
      category: 'REGISTRY',
      variable: 'D-441.S',
      execution: 'STABLE',
      latency_ms: 31.0,
      token_payload: 890,
      invocation_count: 22400,
      risk_score: 0.08,
      cost_tier: 'FREE_CONFIRMED',
      timestamp: '2026-09-06T14:00:14.050Z',
      batch_id: 'BATCH-ALPHA-02',
    },
    {
      id: '#DATA-9905',
      category: 'METADATA',
      variable: 'E-212.T',
      execution: 'REJECTED',
      latency_ms: 185.2,
      token_payload: 11400,
      invocation_count: 420,
      risk_score: 0.89,
      cost_tier: 'PAID',
      timestamp: '2026-09-06T14:00:18.900Z',
      batch_id: 'BATCH-ALPHA-03',
    },
    {
      id: '#DATA-9906',
      category: 'NETWORK',
      variable: 'F-880.U',
      execution: 'STABLE',
      latency_ms: 44.8,
      token_payload: 1800,
      invocation_count: 16500,
      risk_score: 0.15,
      cost_tier: 'FREE_CONFIRMED',
      timestamp: '2026-09-06T14:00:23.230Z',
      batch_id: 'BATCH-ALPHA-03',
    },
  ];

  const categories = [
    'CORE_ASSET',
    'LOGISTICS',
    'ANALYSIS',
    'REGISTRY',
    'METADATA',
    'NETWORK',
    'INFERENCE',
    'SECURITY',
  ];
  const prefixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const suffixes = ['X', 'P', 'R', 'S', 'T', 'U', 'K', 'M'];
  const costTiers = ['FREE_CONFIRMED', 'PAID', 'TRIAL', 'LOCAL'];

  // Seed remaining up to 1,240 records with realistic operational distributions
  // and intentional realistic data anomalies for cleaning & preprocessing demonstration:
  // - 38 missing values (latency, token payload, risk score, category)
  // - 24 duplicates (duplicated IDs and duplicated rows)
  // - 45 stringified numbers ("0.04s", "1250 tokens", etc.)
  // - 32 casing inconsistencies ("core_asset", "Logistics", "stable", etc.)
  // - 18 extreme statistical outliers (latency > 1500ms, token payload > 50,000)

  let seed = 42;
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  const startTime = new Date('2026-09-06T13:00:00.000Z').getTime();

  for (let i = 7; i <= 1240; i++) {
    const rand = pseudoRandom();
    const catIdx = Math.floor(pseudoRandom() * categories.length);
    let category = categories[catIdx];
    const prefix = prefixes[Math.floor(pseudoRandom() * prefixes.length)];
    const suffix = suffixes[Math.floor(pseudoRandom() * suffixes.length)];
    const varNum = Math.floor(100 + pseudoRandom() * 900);
    const variable = `${prefix}-${varNum}.${suffix}`;

    const costTier = costTiers[Math.floor(pseudoRandom() * costTiers.length)];
    const timestamp = new Date(startTime + i * 2500).toISOString();
    const batchId = `BATCH-${String.fromCharCode(65 + (i % 8))}-${Math.floor(i / 150) + 1}`;

    // Latency & Risk profile determines execution status
    let baseLatency = 30 + pseudoRandom() * 45; // ~30-75 ms normal
    let baseTokens = 800 + Math.floor(pseudoRandom() * 3200); // 800-4000
    let invocations: number | string = Math.floor(500 + pseudoRandom() * 25000);
    let riskScore: number | string | null = Number((0.05 + pseudoRandom() * 0.4).toFixed(2));
    let latency: number | string | null = Number(baseLatency.toFixed(1));
    let tokens: number | string | null = baseTokens;

    let execution = 'STABLE';

    // High risk or high latency or paid cost leads to REJECTED / PENDING
    if (costTier === 'PAID') {
      riskScore = Number((0.65 + pseudoRandom() * 0.3).toFixed(2));
      baseLatency = 120 + pseudoRandom() * 150;
      execution = pseudoRandom() < 0.75 ? 'REJECTED' : 'PENDING';
      latency = Number(baseLatency.toFixed(1));
      tokens = 5000 + Math.floor(pseudoRandom() * 8000);
    } else if (costTier === 'TRIAL') {
      riskScore = Number((0.35 + pseudoRandom() * 0.35).toFixed(2));
      execution = pseudoRandom() < 0.5 ? 'PENDING' : 'STABLE';
    } else {
      execution = pseudoRandom() < 0.88 ? 'STABLE' : (pseudoRandom() < 0.7 ? 'PENDING' : 'REJECTED');
    }

    // Inject data defects:
    // 1. Missing values on specific indices
    if (i % 37 === 0) {
      latency = null;
    }
    if (i % 53 === 0) {
      tokens = null;
    }
    if (i % 67 === 0) {
      riskScore = null;
    }
    if (i % 91 === 0) {
      category = '';
    }

    // 2. Inconsistent casing / whitespace
    if (i % 29 === 0) {
      category = category.toLowerCase();
    } else if (i % 43 === 0) {
      category = ' ' + category + '  ';
    }

    // 3. Stringified numeric formats
    if (i % 31 === 0 && latency !== null) {
      latency = `${latency}ms`;
    }
    if (i % 41 === 0 && tokens !== null) {
      tokens = `${tokens} toks`;
    }

    // 4. Extreme outliers
    if (i === 112 || i === 340 || i === 588 || i === 812 || i === 1045) {
      latency = Number((1200 + pseudoRandom() * 850).toFixed(1)); // Latency outlier
      tokens = 48500;
    }

    let id = `#DATA-${String(9900 + i).padStart(4, '0')}`;

    // 5. Duplicate ID / records
    if (i === 150) {
      id = '#DATA-9915'; // Duplicate identifier
    } else if (i === 420) {
      id = '#DATA-10020'; // Duplicate identifier
    } else if (i === 780) {
      id = '#DATA-10250'; // Duplicate identifier
    }

    records.push({
      id,
      category,
      variable,
      execution,
      latency_ms: latency,
      token_payload: tokens,
      invocation_count: invocations,
      risk_score: riskScore,
      cost_tier: costTier,
      timestamp,
      batch_id: batchId,
    });
  }

  return records;
}
