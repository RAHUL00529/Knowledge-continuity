// server/src/scratch-test-score.js
import { mineDailyBatch } from "./services/miningService.js";
import { filterItems } from "./services/filteringService.js";
import { maskItems } from "./services/maskingService.js";
import { extractItems } from "./services/extractionService.js";
import { scoreAndRank } from "./services/scoringService.js";

const items = mineDailyBatch();
const { kept } = await filterItems(items);
const masked = await maskItems(kept);

// Build { item, draft } pairs — extractItems already returns items in
// the same order as its input, so we zip by index. If extraction
// skipped any item, this simple zip would misalign — fine for now at
// hackathon scale/small batches, flag if you see mismatches.
const drafts = await extractItems(masked);
const pairs = masked
  .map((item, i) => ({ item, draft: drafts[i] }))
  .filter((p) => p.draft); // drop any that failed extraction

const ranked = scoreAndRank(pairs);

console.log("Ranked order:");
ranked.forEach((entry, i) => {
  console.log(
    `${i + 1}. [score: ${entry._score}] ${entry.sourceId} — ${entry.problem}`,
  );
});
