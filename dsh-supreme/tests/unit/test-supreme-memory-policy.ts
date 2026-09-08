/**
 * Unit Test for @dsh-supreme/memory-policy
 */
import { Context } from 'cordis';
import SupremeMemoryPolicyPlugin, { NoopLongTermProvider } from '../../plugins/supreme-memory-policy/src/index.ts';

export async function runMemoryPolicyTests() {
  console.log('--- RUNNING SUPREME MEMORY POLICY TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  const ctx = new Context();
  const fiber = await ctx.plugin(SupremeMemoryPolicyPlugin, { defaultBudgetChars: 300 });
  const memPolicy = ctx.supremeMemoryPolicy;

  assert(!!memPolicy, 'supremeMemoryPolicy service mounted on Context');

  // Test 1: NOOP long-term provider works and does not fail
  const noop = new NoopLongTermProvider();
  assert(noop.isAvailable() === true, 'NoopLongTermProvider is available');
  const emptyRes = await noop.query('test');
  assert(emptyRes.length === 0, 'NoopLongTermProvider returns empty array');

  // Test 2: Register valid project knowledge
  memPolicy.registerProjectKnowledge({
    id: 'k1',
    content: 'The application uses Cordis v4 for lifecycle management and plugin fibers.',
    source: 'architecture.md',
    priority: 80,
  });

  memPolicy.registerProjectKnowledge({
    id: 'k2',
    content: 'Docker container port must be bound strictly to 3000.',
    source: 'deploy.md',
    priority: 50,
  });

  // Test 3: Secret rejection security check
  let secretBlocked = false;
  try {
    memPolicy.registerProjectKnowledge({
      id: 'k-bad',
      content: 'Database password=super_secret_password_123',
      source: 'leak.env',
      priority: 100,
    });
  } catch {
    secretBlocked = true;
  }
  assert(secretBlocked === true, 'Security violation: secret-bearing knowledge registration is blocked');

  // Test 4: Task-relevant memory included, irrelevant excluded
  const taskSel = await memPolicy.selectMemoryForTask('How do we configure Cordis plugin lifecycle?');
  assert(taskSel.selected_items.some((i) => i.id === 'k1'), 'Relevant item k1 (Cordis) was selected');
  assert(!taskSel.selected_items.some((i) => i.id === 'k2'), 'Irrelevant item k2 (Docker port) was excluded');

  // Test 5: Budget enforcement and priority ordering
  memPolicy.registerProjectKnowledge({
    id: 'k3-huge',
    content: 'A'.repeat(250) + ' Cordis lifecycle details',
    source: 'verbose.md',
    priority: 10,
  });

  const budgetedSel = await memPolicy.selectMemoryForTask('Cordis lifecycle', { maxBudgetChars: 150 });
  assert(budgetedSel.total_size <= 150, `Budget strictly enforced: total ${budgetedSel.total_size} <= 150`);
  assert(budgetedSel.rejection_count > 0, 'Oversized lower-priority item was rejected by budget limit');

  // Test 6: Conditional prompt section generation
  const promptSec = memPolicy.generatePromptSection(taskSel);
  assert(promptSec.includes('<supplemental_context>'), 'Prompt section generated with <supplemental_context>');

  const emptySelection = { selected_items: [], total_size: 0, budget: 300, rejection_count: 0 };
  const emptyPromptSec = memPolicy.generatePromptSection(emptySelection);
  assert(emptyPromptSec === '', 'Empty selection yields empty string (conditional injection)');

  // Test 7: Disposal
  await fiber.dispose();
  assert(ctx.supremeMemoryPolicy === undefined, 'Disposal cleans up supremeMemoryPolicy');

  console.log(`Memory Policy Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-supreme-memory-policy.ts')) {
  runMemoryPolicyTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
