// server/src/services/gapCheckService.js
import KnowledgeEntry from "../models/KnowledgeEntry.js";

/**
 * Given a list of normalized items (output of miningService.mineFullHistory),
 * returns only the items whose sourceId is NOT already present in MongoDB —
 * i.e. the genuine "gaps" that daily-batch capture never caught.
 *
 * Design note: does ONE query for all existing sourceIds, then filters in
 * memory with a Set, rather than one DB round-trip per item. At hackathon
 * scale (dozens-hundreds of entries) this is both simpler and faster than
 * N sequential existence checks.
 *
 * Deliberately NOT scoped by project — an offboarding gap-check should
 * cover an employee's entire history across every project they touched,
 * not just one. Project scoping is a retrieval-time concern, not a
 * capture-time one.
 */
export async function findGaps(fullHistoryItems) {
  if (fullHistoryItems.length === 0) {
    return { gaps: [], alreadyCapturedCount: 0, totalMined: 0 };
  }

  const existingDocs = await KnowledgeEntry.find(
    { sourceId: { $in: fullHistoryItems.map((i) => i.sourceId) } },
    { sourceId: 1, _id: 0 },
  ).lean();

  const existingSourceIds = new Set(existingDocs.map((d) => d.sourceId));

  const gaps = fullHistoryItems.filter(
    (item) => !existingSourceIds.has(item.sourceId),
  );

  return {
    gaps,
    alreadyCapturedCount: fullHistoryItems.length - gaps.length,
    totalMined: fullHistoryItems.length,
  };
}
