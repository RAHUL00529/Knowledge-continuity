// server/src/scratch-test-filter.js
import { mineDailyBatch } from "./services/miningService.js";
import { filterItems } from "./services/filteringService.js";

const items = mineDailyBatch(); // grabs your seeded 2026-09-04 batch
const { kept, discarded } = await filterItems(items);

console.log(`Mined ${items.length} items`);
console.log(
  `Kept ${kept.length}:`,
  kept.map((i) => i.sourceId),
);
console.log(
  `Discarded ${discarded.length}:`,
  discarded.map((i) => `${i.sourceId} (${i.discardReason})`),
);
