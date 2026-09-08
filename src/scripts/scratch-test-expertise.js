// server/src/scripts/scratch-test-expertise.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { embedText } from "../services/embeddingService.js";
import { findSimilarEntries } from "../services/similarityService.js";
import { findRelatedExperts } from "../services/expertiseService.js";

async function run() {
  await connectDB();

  // Insert one entry by a second author BEFORE running this, or add it here:
  await KnowledgeEntry.deleteMany({ sourceId: "TEST-expert-seed-01" });
  const vector = await embedText(
    "API gateway timeouts during Redis failover, circuit breaker exponential backoff",
  );
  await KnowledgeEntry.create({
    problem: "API gateway timeouts during Redis failover",
    symptom: "Elevated 502s during planned Redis maintenance windows",
    solution: "Added circuit breaker with exponential backoff on Redis calls.",
    context: "Redis Sentinel failover took ~8s, longer than default timeout.",
    tags: ["redis", "timeout", "payments"],
    project: "Payments Platform",
    author: { name: "Rahul Verma" },
    sourceId: "TEST-expert-seed-01",
    sourceType: "manual",
    capturePath: "daily_batch",
    status: "approved",
    vector,
  });

  const query = "our checkout API is throwing random 502 errors under load";
  const queryVector = await embedText(query);
  const matches = await findSimilarEntries(queryVector, { topK: 5 });

  console.log(
    `Top match author: ${matches[0]?.author?.name} (should be excluded below)\n`,
  );

  const experts = await findRelatedExperts(matches);
  console.log("Related experts found:");
  console.log(experts);

  const stillIncludesTopAuthor = experts.some(
    (e) => e.name === matches[0]?.author?.name,
  );
  console.log(
    stillIncludesTopAuthor
      ? "❌ Top author leaked into related experts — exclusion filter broken."
      : "✅ Top author correctly excluded.",
  );

  await KnowledgeEntry.deleteMany({ sourceId: "TEST-expert-seed-01" });
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
