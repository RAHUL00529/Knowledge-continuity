// server/src/scratch-test-extract.js
import { mineDailyBatch } from "./services/miningService.js";
import { filterItems } from "./services/filteringService.js";
import { maskItems } from "./services/maskingService.js";
import { extractItems } from "./services/extractionService.js";

const items = mineDailyBatch();
const { kept } = await filterItems(items);
const masked = await maskItems(kept);
const drafts = await extractItems(masked);

console.log(`Produced ${drafts.length} draft entries:\n`);
for (const d of drafts) {
  console.log(JSON.stringify(d, null, 2));
}
