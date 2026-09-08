// server/src/services/expertiseService.js
import KnowledgeEntry from "../models/KnowledgeEntry.js";

const MAX_EXPERTS = 3;

/**
 * Given the ranked matches from similarityService, finds other authors
 * (besides the top match's own author) who have approved entries sharing
 * at least one tag with the matched entries — i.e. "who else might know
 * about this."
 *
 * Deliberately NOT a graph query — a simple find + in-memory grouping,
 * matching the same pattern as gapCheckService.js. This is a lookup on
 * existing `author`/`tags` fields, not a new data structure.
 */
export async function findRelatedExperts(matches) {
  if (!matches || matches.length === 0) return [];

  const primaryAuthor = matches[0]?.author?.name;
  const allTags = [...new Set(matches.flatMap((m) => m.tags || []))];

  if (allTags.length === 0) return [];

  const candidates = await KnowledgeEntry.find({
    status: "approved",
    tags: { $in: allTags },
    "author.name": { $ne: primaryAuthor }, // don't recommend the person already cited
  }).lean();

  // Group by author: count how many entries overlap, and which specific
  // tags matched (so the UI can show *why* this person is relevant).
  const grouped = new Map();

  for (const entry of candidates) {
    const name = entry.author?.name;
    if (!name) continue;

    if (!grouped.has(name)) {
      grouped.set(name, { name, matchCount: 0, sharedTags: new Set() });
    }

    const g = grouped.get(name);
    g.matchCount += 1;
    for (const tag of entry.tags || []) {
      if (allTags.includes(tag)) g.sharedTags.add(tag);
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, MAX_EXPERTS)
    .map((g) => ({
      name: g.name,
      matchCount: g.matchCount,
      sharedTags: Array.from(g.sharedTags),
    }));
}
