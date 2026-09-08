// server/src/services/extractionService.js
import { generateText } from "../config/llmClient.js";

const EXTRACTION_SYSTEM_PROMPT = `You are an expert technical writer who converts messy engineering chat/ticket text into clean, structured knowledge base entries. You always respond with ONLY a single valid JSON object — no markdown fences, no preamble, no explanation, no trailing text.`;

function buildExtractionPrompt(maskedText) {
  return `Extract a structured knowledge entry from the message below.

Message:
"""
${maskedText}
"""

Return a JSON object with exactly these fields:
{
  "problem": "one clear sentence describing what was broken or the challenge faced",
  "symptom": "what was observed before the root cause was known (e.g. an error, a user report, a metric) — can be empty string if not present in the message",
  "solution": "one to three sentences describing the fix or resolution",
  "context": "any useful background — why it happened, what made it tricky, what to watch for next time",
  "tags": ["2 to 4 short lowercase keywords, e.g. redis, timeout, payments"]
}

Rules:
- Do NOT include any bracketed placeholders like [NAME] or [EMAIL] in your output — omit that detail entirely if it was masked, don't just copy the placeholder token.
- Do NOT invent details not present in the message.
 
- Every field value must be a single line — do NOT insert literal line breaks inside any string.
- If the message does not contain enough information for a field, use an empty string ("") or empty array ([]), never null.
- Output ONLY the JSON object.`;
}

/**
 * Strips common LLM wrapping artifacts (markdown fences, stray text)
 * before attempting JSON.parse.
 */
// server/src/services/extractionService.js
// ... (keep EXTRACTION_SYSTEM_PROMPT and buildExtractionPrompt as-is,
//      but see the one prompt addition below)

/**
 * Extracts the {...} JSON block from a response and repairs the
 * most common Llama/Groq JSON malformations before parsing:
 * - markdown fences
 * - raw literal newlines/tabs inside string values (invalid JSON,
 *   must be escaped) — we collapse them to spaces
 * - stray text before/after the JSON object
 */
function cleanJSONResponse(raw) {
  let text = raw.trim();

  // Strip markdown fences if present
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Grab only the outermost {...} block — ignores any stray
  // preamble/postamble text the model tacked on
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("No JSON object found in response");
  }
  text = text.slice(firstBrace, lastBrace + 1);

  // Replace raw newlines/tabs/carriage returns with a single space.
  // These are only ever invalid here (they'd have to be \n / \t
  // escaped inside a JSON string to be legal) — collapsing them is
  // safe for our short text fields and fixes the #1 failure cause.
  text = text.replace(/[\r\n\t]+/g, " ");

  // Remove trailing commas before } or ] — another common Llama slip
  text = text.replace(/,\s*([}\]])/g, "$1");

  return text;
}

export async function extractEntry(maskedText) {
  try {
    const response = await generateText({
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: buildExtractionPrompt(maskedText),
      maxTokens: 700, // bumped from 400 — was likely truncating longer entries mid-string
    });

    let cleaned;
    try {
      cleaned = cleanJSONResponse(response);
    } catch (cleanErr) {
      console.error("extractEntry failed (no JSON found):", cleanErr.message);
      console.error("Raw response was:\n", response);
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("extractEntry failed (parse):", parseErr.message);
      console.error("Cleaned text was:\n", cleaned);
      return null;
    }

    if (
      typeof parsed.problem !== "string" ||
      typeof parsed.solution !== "string"
    ) {
      console.warn("Extraction produced unexpected shape:", parsed);
      return null;
    }

    return {
      problem: parsed.problem || "",
      symptom: parsed.symptom || "",
      solution: parsed.solution || "",
      context: parsed.context || "",
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t).toLowerCase())
        : [],
    };
  } catch (err) {
    console.error("extractEntry failed (unexpected):", err.message);
    return null;
  }
}

/**
 * Batch helper — runs extraction over a list of masked items
 * (output of maskingService.maskItems) and merges the extracted
 * fields back with the item's provenance/metadata, producing
 * objects shaped ready for KnowledgeEntry.js (minus vector/status,
 * which get added later in the review/save step).
 */
export async function extractItems(maskedItems) {
  const drafts = [];

  for (const item of maskedItems) {
    const extracted = await extractEntry(item.maskedText);

    if (!extracted) {
      console.warn(`Skipping ${item.sourceId} — extraction failed`);
      continue;
    }

    drafts.push({
      ...extracted,
      project: item.project,
      author: { name: item.author },
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      capturePath: item.capturePath,
      piiMasked: item.piiMasked,
      piiMaskedCount: item.piiMaskedCount,
      status: "draft",
    });
  }

  return drafts;
}
