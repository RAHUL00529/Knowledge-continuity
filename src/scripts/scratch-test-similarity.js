// server/src/scripts/scratch-test-similarity.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { embedText } from "../services/embeddingService.js";
import { findSimilarEntries } from "../services/similarityService.js";

// Three test entries: one genuinely on-topic, two off-topic,
// so we can see the score GAP between relevant and irrelevant.
const TEST_ENTRIES = [
  {
    problem: "Redis connection pool exhausting under traffic spikes",
    symptom: "Intermittent 502s on the checkout service",
    solution:
      "Explicitly release connections in the finally block and increase pool size",
    context: "Caused by failed transactions leaving connections half-open",
    tags: ["redis", "timeout", "payments"],
    project: "Payments Platform",
    author: { name: "Test Author" },
    sourceId: "TEST-similarity-01",
    sourceType: "manual",
    capturePath: "daily_batch",
    status: "approved",
  },
  {
    problem: "Search autocomplete showing discontinued products",
    symptom: "Users see products that are no longer for sale",
    solution: "Consolidated two out-of-sync filter functions into one",
    context: "Two separate indexing jobs had drifted apart",
    tags: ["search", "indexing"],
    project: "Search & Discovery",
    author: { name: "Test Author" },
    sourceId: "TEST-similarity-02",
    sourceType: "manual",
    capturePath: "daily_batch",
    status: "approved",
  },
  {
    problem: "Payout scheduler using local time instead of UTC",
    symptom: "Payouts triggered an hour early or late around DST",
    solution: "Switched all scheduling comparisons to UTC",
    context: "Timezone conversion now happens only at the display layer",
    tags: ["scheduling", "timezone", "payments"],
    project: "Payments Platform",
    author: { name: "Test Author" },
    sourceId: "TEST-similarity-03",
    sourceType: "manual",
    capturePath: "daily_batch",
    status: "approved",
  },
];

async function run() {
  await connectDB();

  console.log("Cleaning up any leftover test entries from a previous run...");
  await KnowledgeEntry.deleteMany({ sourceId: /^TEST-similarity-/ });

  console.log("Embedding and inserting 3 test entries...");
  for (const entry of TEST_ENTRIES) {
    const embeddingInput = [
      entry.problem,
      entry.symptom,
      entry.solution,
      entry.context,
    ].join(" ");
    const vector = await embedText(embeddingInput);
    await KnowledgeEntry.create({ ...entry, vector });
  }

  // The query is deliberately worded DIFFERENTLY from entry #1's text
  // (paraphrased, not copy-pasted) — this is the real test. If it only
  // matched on exact keyword overlap, that would prove nothing about
  // semantic search actually working.
  const query = "our checkout API is throwing random 502 errors under load";
  console.log(`\nQuery: "${query}"\n`);

  const queryVector = await embedText(query);

  // Test A: no project filter — should surface entry #1 clearly on top
  console.log("--- Unscoped search (all projects) ---");
  const results = await findSimilarEntries(queryVector, { topK: 5 });
  results.forEach((r, i) => {
    console.log(
      `${i + 1}. [score: ${r.similarityScore}] ${r.problem} (${r.sourceId})`,
    );
  });

  if (results.length === 0) {
    console.log(
      "⚠️  No results returned — either MIN_SIMILARITY_THRESHOLD is too strict, or vectors aren't matching as expected. This is exactly the kind of thing this test is meant to catch.",
    );
  } else if (results[0].sourceId !== "TEST-similarity-01") {
    console.log(
      "⚠️  Top result is NOT the redis/502 entry — investigate before trusting this service.",
    );
  } else {
    console.log("✅ Top match is the correct entry, as expected.");
  }

  // Test B: project-scoped search — should exclude the Search & Discovery entry entirely
  console.log("\n--- Scoped to 'Payments Platform' only ---");
  const scopedResults = await findSimilarEntries(queryVector, {
    project: "Payments Platform",
    topK: 5,
  });
  scopedResults.forEach((r, i) => {
    console.log(
      `${i + 1}. [score: ${r.similarityScore}] ${r.problem} (${r.sourceId})`,
    );
  });
  const leakedSearchEntry = scopedResults.some(
    (r) => r.sourceId === "TEST-similarity-02",
  );
  console.log(
    leakedSearchEntry
      ? "❌ Search & Discovery entry leaked into a Payments-scoped query — project filter is broken."
      : "✅ Project scoping correctly excluded the unrelated project's entry.",
  );

  console.log("\nCleaning up test entries...");
  await KnowledgeEntry.deleteMany({ sourceId: /^TEST-similarity-/ });

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
