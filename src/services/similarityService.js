// server/src/services/similarityService.js
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";

const DEFAULT_TOP_K = 5;
const MIN_SIMILARITY_THRESHOLD = 0.3; // below this, a match is likely noise, not signal

/**
 * Finds the most semantically similar approved KnowledgeEntry docs
 * to a given query vector.
 *
 * @param {number[]} queryVector - output of embeddingService.embedText(query)
 * @param {Object} options
 * @param {string} [options.project] - optional project filter for scoped retrieval
 * @param {number} [options.topK] - how many matches to return
 */
export async function findSimilarEntries(queryVector, options = {}) {
  const { project, topK = DEFAULT_TOP_K } = options;

  // Stage 1: pull candidates. Only approved entries are ever retrievable —
  // drafts are pending review and must never leak into answers.
  const filter = { status: "approved", vector: { $exists: true, $ne: [] } };
  if (project) filter.project = project;

  const candidates = await KnowledgeEntry.find(filter).lean();

  if (candidates.length === 0) {
    return [];
  }

  // Stage 2: score every candidate against the query vector
  const scored = candidates.map((entry) => ({
    entry,
    score: cosineSimilarity(queryVector, entry.vector),
  }));

  // Stage 3: filter weak matches, sort strongest first, cap at topK
  return scored
    .filter((s) => s.score >= MIN_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({
      ...s.entry,
      similarityScore: Number(s.score.toFixed(3)),
    }));
}
