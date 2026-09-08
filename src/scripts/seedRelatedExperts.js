// server/src/scripts/seedRelatedExperts.js
//
// One-time seed: adds a small set of KnowledgeEntry docs authored by
// people OTHER than Priya, sharing tags with her entries. This exists
// purely so expertiseService.js has real data to surface — without
// this, "related experts" is permanently empty (every seeded entry
// elsewhere is authored by Priya alone), which would make the
// RelatedExpertsTag.jsx component look broken/empty in every demo run.
//
// Run with: node src/scripts/seedRelatedExperts.js

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { embedText } from "../services/embeddingService.js";
import { generateFakeSourceLink } from "../utils/fakeSourceLink.js";

const RELATED_EXPERT_ENTRIES = [
  {
    problem: "API gateway timeouts during Redis failover",
    symptom: "Elevated 502s during planned Redis maintenance windows",
    solution:
      "Added a circuit breaker with exponential backoff on Redis calls, degrading gracefully to cache-miss behavior during failover instead of blocking.",
    context:
      "Redis Sentinel failover took roughly 8 seconds, longer than the default client timeout.",
    tags: ["redis", "timeout", "payments"],
    project: "Payments Platform",
    author: "Rahul Verma",
    sourceId: "gh-pr-3010",
    sourceType: "github",
  },
  {
    problem: "Connection pool exhaustion under load testing",
    symptom: "Slow API responses and eventual 502s during a stress test",
    solution:
      "Tuned the database connection pool size and added pool-usage monitoring alerts at 80% capacity.",
    context:
      "Similar pattern to other pool-exhaustion issues, but on the primary Postgres pool rather than Redis.",
    tags: ["timeout", "payments", "monitoring"],
    project: "Payments Platform",
    author: "Ananya Iyer",
    sourceId: "jira-PAY-205",
    sourceType: "ticket",
  },
  {
    problem: "Search results felt stale after catalog updates",
    symptom: "Newly added products didn't appear in search for several minutes",
    solution:
      "Reduced the search index refresh interval and added a manual reindex trigger for urgent updates.",
    context:
      "Trade-off between indexing cost and freshness — tuned for the common case.",
    tags: ["search", "indexing", "caching"],
    project: "Search & Discovery",
    author: "Rahul Verma",
    sourceId: "gh-pr-3055",
    sourceType: "github",
  },
];

async function run() {
  await connectDB();

  console.log("Cleaning up any previous related-expert seed entries...");
  await KnowledgeEntry.deleteMany({
    sourceId: { $in: RELATED_EXPERT_ENTRIES.map((e) => e.sourceId) },
  });

  console.log(
    `Seeding ${RELATED_EXPERT_ENTRIES.length} cross-author entries...`,
  );

  for (const entry of RELATED_EXPERT_ENTRIES) {
    const embeddingInput = [
      entry.problem,
      entry.symptom,
      entry.solution,
      entry.context,
    ].join(" ");
    const vector = await embedText(embeddingInput);

    await KnowledgeEntry.create({
      problem: entry.problem,
      symptom: entry.symptom,
      solution: entry.solution,
      context: entry.context,
      tags: entry.tags,
      project: entry.project,
      author: { name: entry.author },
      sourceId: entry.sourceId,
      sourceType: entry.sourceType,
      capturePath: "daily_batch",
      status: "approved",
      piiMasked: false,
      piiMaskedCount: 0,
      vector,
      sourceLink: generateFakeSourceLink(entry.sourceType, entry.sourceId),
    });

    console.log(`  ✅ ${entry.author} — ${entry.problem}`);
  }

  console.log("✅ Related-expert seeding complete.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
