// server/src/services/scoringService.js

/**
 * Computes a 0-1 recency score. Most recent item in the batch = 1.0,
 * oldest = closer to 0. Pure relative ranking — no absolute date math
 * needed since we only care about order within one batch.
 */
function computeRecencyScores(items) {
  const dates = items.map((i) => new Date(i.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const range = maxDate - minDate || 1; // avoid divide-by-zero if all same date

  return items.map((item) => {
    const t = new Date(item.date).getTime();
    return (t - minDate) / range;
  });
}

/**
 * Composite signal-strength score (0-1ish, not strictly bounded)
 * from resolution marker, reaction count, and masking flag.
 */
function computeSignalScore(item) {
  let score = 0;

  if (item.signals?.hasResolutionMarker) score += 0.5;

  const reactionCount = item.signals?.reactions?.length || 0;
  score += Math.min(reactionCount * 0.1, 0.3); // cap contribution at 0.3

  if (item.piiMasked) score += 0.1; // slight boost — likely customer-impact

  return score;
}

/**
 * Ranks a list of extracted draft entries (output of extractItems)
 * by combined recency + signal strength. Higher score = higher priority
 * to show first on the review screen.
 *
 * Note: draft entries from extractItems don't carry `date` or `signals`
 * directly — this expects the ORIGINAL mined/filtered item alongside
 * its draft, so callers should score before losing that reference, or
 * pass both. See usage note below.
 */
export function scoreAndRank(itemsWithDrafts) {
  // itemsWithDrafts: [{ item: <mined item w/ date+signals>, draft: <extracted entry> }]
  const recencyScores = computeRecencyScores(
    itemsWithDrafts.map((x) => x.item),
  );

  const scored = itemsWithDrafts.map((x, i) => {
    const recency = recencyScores[i];
    const signal = computeSignalScore(x.item);
    const totalScore = recency * 0.4 + signal * 0.6; // signal weighted higher than recency

    return {
      ...x.draft,
      _score: Number(totalScore.toFixed(3)), // exposed for debugging/demo, not stored in DB
    };
  });

  return scored.sort((a, b) => b._score - a._score);
}
