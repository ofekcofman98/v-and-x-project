// /**
//  * One-off manual verification script for the VectorMatcher pipeline.
//  * Not part of the app — run with `npx tsx scripts/tmp-test-vector-matcher.ts`, delete afterward.
//  */
// import 'dotenv/config';
// import { rebuildEntityIndex, invalidateEntityIndex } from '../lib/server/embeddings/entity-index-cache';
// import { createDefaultAsyncMatcherChain } from '../lib/server/matching/matcher';
// import { prisma } from '../lib/prisma';

// const TEST_TABLE_ID = '00000000-0000-0000-0000-000000000042';
// const LABELS = ['David Levy', 'Sarah Cohen', 'Michael Green', 'Rachel Adler'];

// async function main() {
//   console.log('--- 0. Creating scratch Table row (EntityEmbedding.tableId has an FK to tables) ---');
//   await prisma.table.upsert({
//     where: { id: TEST_TABLE_ID },
//     create: {
//       id: TEST_TABLE_ID,
//       name: '__tmp_vector_matcher_test__',
//       representativeColumnKey: 'name',
//       schema: { columns: [] },
//     },
//     update: {},
//   });

//   console.log('--- 1. Building entity index (embeds + persists to Postgres) ---');
//   const t0 = Date.now();
//   const index = await rebuildEntityIndex(TEST_TABLE_ID, LABELS);
//   console.log(`Built index in ${Date.now() - t0}ms:`, {
//     model: index.model,
//     dim: index.dim,
//     labels: index.labels,
//   });

//   const row = await prisma.entityEmbedding.findUnique({ where: { tableId: TEST_TABLE_ID } });
//   console.log('--- 2. Verifying persisted row ---');
//   console.log({
//     found: !!row,
//     labelsHash: row?.labelsHash,
//     vectorByteLength: row?.vectors.length,
//     expectedByteLength: LABELS.length * index.dim * 4,
//   });

//   console.log('--- 3. Running AsyncMatcherChain: exact/phonetic/fuzzy should MISS, vector should HIT ---');
//   const chain = createDefaultAsyncMatcherChain(TEST_TABLE_ID);

//   // Deliberately garbled/Hebrew-ish input that fuzzy-distance won't catch
//   // but is semantically close to "David Levy".
//   const cases = ['דוד לוי', 'Dave Levi', 'completely unrelated text'];

//   for (const input of cases) {
//     const t1 = Date.now();
//     const result = await chain.match(input, LABELS, 0.85);
//     console.log(`match("${input}") -> `, result, `(${Date.now() - t1}ms)`);
//   }

//   console.log('--- 4. Cleaning up test rows ---');
//   await invalidateEntityIndex(TEST_TABLE_ID);
//   await prisma.table.delete({ where: { id: TEST_TABLE_ID } });
//   console.log('Done.');
//   await prisma.$disconnect();
// }

// main().catch(async (err) => {
//   console.error('TEST FAILED:', err);
//   await prisma.$disconnect();
//   process.exit(1);
// });
