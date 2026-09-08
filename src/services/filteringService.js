// server/src/services/filteringService.js
import { generateText } from "../config/llmClient.js"; // adjust path to your actual llmClient location

const MIN_LENGTH = 40; // chars — below this, almost never substantive
const NOISE_PHRASES = [
  "lgtm",
  "ty",
  "thanks",
  "thank you",
  "np",
  "sounds good",
  "on it",
  "will sync",
  "sending now",
  "no functional change",
];

/**
 * Fast, free pre-filter. Returns true if the item PASSES
 * (i.e. is worth sending to the LLM pass), false if it should
 * be discarded immediately.
 */
function heuristicPass(item) {
  const text = item.raw.trim().toLowerCase();

  // Too short to contain a real problem/solution narrative
  if (text.length < MIN_LENGTH) return false;

  // Matches a known noise phrase almost exactly
  if (NOISE_PHRASES.some((p) => text === p || text.startsWith(p + " "))) {
    return false;
  }

  // Strong positive signal — resolution marker present
  if (item.signals?.hasResolutionMarker) return true;

  // No strong signal either way — let it through to the LLM pass
  return true;
}

/**
 * Slower, costs a token call. Only runs on heuristic survivors.
 * Returns true/false via a strict, low-ambiguity prompt.
 */
async function llmPass(item) {
  const prompt = `You are filtering internal engineering messages to decide if they contain reusable knowledge.

Message:
"""
${item.raw}
"""

Does this message describe a real problem AND its solution or root cause (not just a status update, chat filler, or trivial change)?
Answer with exactly one word: YES or NO.`;

  const response = await generateText({
    system: "You are a strict binary classifier. Only ever answer YES or NO.",
    prompt,
    maxTokens: 5,
  });

  return response.trim().toUpperCase().startsWith("YES");
}

/**
 * Runs the full two-pass filter over a list of normalized items
 * (as returned by miningService). Returns { kept, discarded } so
 * callers/routes can show "mined X, filtered to Y" for the demo.
 */
export async function filterItems(items) {
  const kept = [];
  const discarded = [];

  for (const item of items) {
    if (!heuristicPass(item)) {
      discarded.push({ ...item, discardReason: "heuristic" });
      continue;
    }

    // Only items with a clear resolution marker AND reasonable length
    // skip the LLM call entirely — save tokens on the obvious wins.
    if (item.signals?.hasResolutionMarker && item.raw.length > 150) {
      kept.push(item);
      continue;
    }

    const passesLLM = await llmPass(item);
    if (passesLLM) {
      kept.push(item);
    } else {
      discarded.push({ ...item, discardReason: "llm" });
    }
  }

  return { kept, discarded };
}
