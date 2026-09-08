// server/src/services/maskingService.js
import { generateText } from "../config/llmClient.js";
import { applyRegexMasking } from "../utils/piiPatterns.js";

/**
 * Second-pass LLM check: catches PII regex can't reliably catch —
 * full names, informal references to people, addresses — WITHOUT
 * needing the model to reproduce anything sensitive. It just returns
 * a rewritten version with those spans replaced by [NAME]/[LOCATION]/etc.
 */
async function llmMaskingPass(text) {
  const prompt = `Rewrite the message below, replacing any personally identifying information with a bracketed placeholder describing the category (e.g. [NAME], [LOCATION], [USERNAME]).

Do NOT replace:
- Ticket/PR IDs (e.g. PAY-118, PR #2201)
- Project or product names
- Technical terms, service names, error codes

Only replace things that identify a specific real person or place.

Message:
"""
${text}
"""

Return ONLY the rewritten message, nothing else — no preamble, no explanation.`;

  const response = await generateText({
    system:
      "You are a careful PII redaction assistant. Output only the redacted text.",
    prompt,
    maxTokens: 500,
  });

  return response.trim();
}

/**
 * Full masking pipeline for one item's raw text.
 * Returns everything the review UI / PiiMaskedBadge needs.
 */
export async function maskText(rawText) {
  // Layer 1: regex (free, instant, catches structured PII)
  const { masked: afterRegex, count: regexCount } = applyRegexMasking(rawText);

  // Layer 2: LLM pass on the regex-masked text (catches names/places)
  const afterLLM = await llmMaskingPass(afterRegex);

  // Rough count of additional LLM-layer redactions, by counting
  // bracketed tokens that weren't already there from the regex pass.
  const llmBracketCount = (afterLLM.match(/\[[A-Z_]+\]/g) || []).length;
  const totalMaskedCount = Math.max(llmBracketCount, regexCount);

  return {
    maskedText: afterLLM,
    piiMasked: totalMaskedCount > 0,
    piiMaskedCount: totalMaskedCount,
  };
}

/**
 * Batch helper — masks a list of filtered items (from filteringService),
 * attaching maskedText/piiMasked/piiMaskedCount to each.
 */
export async function maskItems(items) {
  const results = [];
  for (const item of items) {
    const { maskedText, piiMasked, piiMaskedCount } = await maskText(item.raw);
    results.push({ ...item, maskedText, piiMasked, piiMaskedCount });
  }
  return results;
}
