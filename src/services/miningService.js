import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM doesn't have __dirname natively — this is the standard workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.join(__dirname, "..", "data", "seed");

function loadJSON(filename) {
  const filePath = path.join(SEED_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * Normalizes a raw seed item into the shape every downstream
 * service (filter, mask, extract) expects — regardless of source.
 */
function normalizeItem(item, capturePath) {
  return {
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    project: item.project,
    author: item.author,
    date: item.date,
    raw: item.raw,
    signals: item.signals || {},
    capturePath,
    // Seed-only field — used by the Phase 2 seed script, ignored by
    // real pipeline logic. Real source APIs will never send this.
    ...(typeof item.alreadyCaptured === "boolean"
      ? { alreadyCaptured: item.alreadyCaptured }
      : {}),
  };
}

/**
 * Mines one day's worth of "closed today" items for the daily-batch path.
 * Defaults to the most recent seeded day if no date is given.
 */
export function mineDailyBatch(date) {
  const data = loadJSON("priya_daily_batches.json");
  const batch = date
    ? data.find((b) => b.date === date)
    : data[data.length - 1];

  if (!batch) return [];
  return batch.items.map((item) => normalizeItem(item, "daily_batch"));
}

/**
 * Mines an employee's entire history for the offboarding path.
 * Returns EVERYTHING — including items already captured by daily
 * batches. Deciding what's a "gap" is a separate concern (Phase 4's
 * gap-check service), not this function's job.
 */
export function mineFullHistory() {
  const data = loadJSON("priya_full_history.json");
  return data.map((item) => normalizeItem(item, "offboarding_gap"));
}
