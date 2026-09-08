// server/src/scripts/seedOffboardingHistory.js
//
// One-time seed: pre-populates MongoDB with KnowledgeEntry docs for every
// item in priya_full_history.json marked alreadyCaptured: true.
//
// WHY THIS EXISTS: the offboarding gap-check works by diffing full-history
// sourceIds against what's already stored in MongoDB. Without this seed,
// there is nothing in the DB to diff against, and every item would
// incorrectly show up as a "gap" during the demo.
//
// This intentionally does NOT run the real filter/mask/extract pipeline —
// these entries represent knowledge captured by daily batches over the
// past several months, not knowledge being captured right now. We fabricate
// a plausible structured entry directly from the raw text.
//
// Run with: node src/scripts/seedOffboardingHistory.js

import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { embedText } from "../services/embeddingService.js";
import { generateFakeSourceLink } from "../utils/fakeSourceLink.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HISTORY_PATH = path.join(
  __dirname,
  "..",
  "data",
  "seed",
  "priya_full_history.json",
);

/**
 * Very lightweight structuring — NOT the real extractionService.
 * Good enough for entries that will never be shown as "just extracted"
 * in the demo (they represent already-approved past knowledge).
 */
function fabricateEntryFromRaw(item) {
  const sentences = item.raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  const problem = sentences[0] || item.raw.slice(0, 140);
  const solution = sentences.slice(1).join(" ") || item.raw;

  return {
    problem,
    symptom: "",
    solution,
    context: `Captured from ${item.sourceType} on ${item.date}.`,
    tags: [item.project.toLowerCase().split(" ")[0]],
  };
}

async function run() {
  await connectDB();

  const raw = fs.readFileSync(HISTORY_PATH, "utf-8");
  const history = JSON.parse(raw);
  const alreadyCapturedItems = history.filter(
    (i) => i.alreadyCaptured === true,
  );

  console.log(
    `Found ${alreadyCapturedItems.length} "already captured" items to seed ` +
      `(out of ${history.length} total in full history).`,
  );

  let inserted = 0;
  let skipped = 0;

  for (const item of alreadyCapturedItems) {
    const exists = await KnowledgeEntry.findOne({ sourceId: item.sourceId });
    if (exists) {
      skipped++;
      continue;
    }

    const fabricated = fabricateEntryFromRaw(item);
    const embeddingInput = [
      fabricated.problem,
      fabricated.solution,
      fabricated.context,
    ].join(" ");
    const vector = await embedText(embeddingInput);

    await KnowledgeEntry.create({
      ...fabricated,
      project: item.project,
      author: { name: item.author },
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      capturePath: "daily_batch",
      status: "approved",
      piiMasked: false,
      piiMaskedCount: 0,
      vector,
      sourceLink: generateFakeSourceLink(item.sourceType, item.sourceId), // ADD THIS LINE
    });
    inserted++;
  }

  console.log(
    `✅ Seed complete — inserted ${inserted}, skipped ${skipped} (already existed).`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
