/**
 * @license
 * @dsh-supreme/memory-policy
 * Memory selection policy and context budgeting for DeepSeek Harness.
 * Does NOT duplicate DSH ctx.sessions.
 */

import { Context, Service } from 'cordis';
import type {
  MemoryClass,
  MemoryItem,
  MemorySelectionResult,
} from '../../types.ts';

export interface LongTermMemoryProvider {
  name: string;
  isAvailable(): boolean;
  query(queryText: string, limit?: number): Promise<MemoryItem[]>;
}

export class NoopLongTermProvider implements LongTermMemoryProvider {
  name = 'noop';
  isAvailable(): boolean {
    return true;
  }
  async query(_queryText: string, _limit?: number): Promise<MemoryItem[]> {
    return [];
  }
}

export interface SupremeMemoryPolicyConfig {
  defaultBudgetChars?: number;
  longTermProvider?: LongTermMemoryProvider;
  enableProjectKnowledge?: boolean;
}

export class SupremeMemoryPolicyService extends Service {
  static provide = 'supremeMemoryPolicy';
  public config: Required<SupremeMemoryPolicyConfig>;
  private projectKnowledgeItems: MemoryItem[] = [];

  constructor(ctx: Context, config: SupremeMemoryPolicyConfig = {}) {
    super(ctx, 'supremeMemoryPolicy');

    this.config = {
      defaultBudgetChars: config.defaultBudgetChars ?? 2000,
      longTermProvider: config.longTermProvider ?? new NoopLongTermProvider(),
      enableProjectKnowledge: config.enableProjectKnowledge ?? true,
    };
  }

  public registerProjectKnowledge(item: Omit<MemoryItem, 'memory_class'>): void {
    // Secret safety: Reject knowledge items containing secret indicators
    const lower = (item.content + ' ' + item.source).toLowerCase();
    if (lower.includes('secret') || lower.includes('key=') || lower.includes('token=') || lower.includes('password=')) {
      throw new Error('Security violation: Refusing to register secret-bearing item into memory');
    }

    this.projectKnowledgeItems.push({
      ...item,
      memory_class: 'PROJECT_CONTEXT',
    });
  }

  public listProjectKnowledge(): MemoryItem[] {
    return [...this.projectKnowledgeItems];
  }

  /**
   * Evaluates task relevance, queries allowed sources, and budgets context.
   */
  public async selectMemoryForTask(
    taskDescription: string,
    options?: {
      maxBudgetChars?: number;
      requiredClasses?: MemoryClass[];
    }
  ): Promise<MemorySelectionResult> {
    const budget = options?.maxBudgetChars ?? this.config.defaultBudgetChars;
    const allowedClasses = options?.requiredClasses ?? ['CORE_PROFILE', 'PROJECT_CONTEXT', 'TASK_RELEVANT', 'LONG_TERM'];

    const candidates: MemoryItem[] = [];

    // 1. Project knowledge selection
    if (this.config.enableProjectKnowledge && allowedClasses.includes('PROJECT_CONTEXT')) {
      const taskWords = taskDescription.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      for (const item of this.projectKnowledgeItems) {
        // Keyword relevance matching
        const itemLower = item.content.toLowerCase();
        const matches = taskWords.some((w) => itemLower.includes(w));
        if (matches) {
          candidates.push(item);
        }
      }
    }

    // 2. Long-term memory query
    if (allowedClasses.includes('LONG_TERM') && this.config.longTermProvider.isAvailable()) {
      const ltItems = await this.config.longTermProvider.query(taskDescription, 5);
      candidates.push(...ltItems);
    }

    // Sort by priority (higher priority first)
    candidates.sort((a, b) => b.priority - a.priority);

    // Enforce hard budget limit
    const selected: MemoryItem[] = [];
    let currentSize = 0;
    let rejectedCount = 0;

    for (const cand of candidates) {
      const itemSize = cand.content.length;
      if (currentSize + itemSize <= budget) {
        selected.push(cand);
        currentSize += itemSize;
      } else {
        rejectedCount++;
      }
    }

    return {
      selected_items: selected,
      total_size: currentSize,
      budget,
      rejection_count: rejectedCount,
    };
  }

  /**
   * Generates a concise system prompt memory section ONLY if items exist.
   * Returns empty string if no memory is relevant (conditional injection).
   */
  public generatePromptSection(selection: MemorySelectionResult): string {
    if (selection.selected_items.length === 0) {
      return '';
    }

    const lines = ['<supplemental_context>'];
    for (const item of selection.selected_items) {
      lines.push(`- [${item.source}] ${item.content}`);
    }
    lines.push('</supplemental_context>');
    return lines.join('\n');
  }
}

// Module augmentation
declare module 'cordis' {
  interface Context {
    supremeMemoryPolicy: SupremeMemoryPolicyService;
  }
}

export const SupremeMemoryPolicyPlugin = SupremeMemoryPolicyService;
export default SupremeMemoryPolicyPlugin;
