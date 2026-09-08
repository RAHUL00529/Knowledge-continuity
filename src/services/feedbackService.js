// server/src/services/feedbackService.js
import KnowledgeEntry from "../models/KnowledgeEntry.js";

const HELPFUL_BOOST = 0.05;
const OUTDATED_PENALTY = 0.15; // weighted heavier — confidently serving
// stale info is a worse failure mode than under-confidence in good info

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Applies one feedback vote to a KnowledgeEntry: increments the
 * appropriate counter and nudges confidenceScore incrementally rather
 * than recalculating it as a fresh ratio. A ratio-based score is too
 * volatile on small sample sizes — one "outdated" vote on a brand-new
 * entry would crash it to 0 immediately, which overstates what a
 * single data point should mean.
 */
export async function submitFeedback(entryId, rating) {
  const entry = await KnowledgeEntry.findById(entryId);

  if (!entry) {
    return { success: false, error: "Entry not found" };
  }

  if (rating === "helpful") {
    entry.feedback.helpfulCount += 1;
    entry.confidenceScore = clamp(entry.confidenceScore + HELPFUL_BOOST);
  } else if (rating === "outdated") {
    entry.feedback.outdatedCount += 1;
    entry.confidenceScore = clamp(entry.confidenceScore - OUTDATED_PENALTY);
  } else {
    return { success: false, error: "rating must be 'helpful' or 'outdated'" };
  }

  await entry.save();

  return {
    success: true,
    entryId: entry._id,
    confidenceScore: entry.confidenceScore,
    feedback: entry.feedback,
  };
}
