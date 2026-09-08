// server/src/services/interviewService.js
import { generateText } from "../config/llmClient.js";

/**
 * Decides which fields on a single draft are thin enough to warrant a
 * follow-up question. Deliberately conservative — most drafts should
 * need ZERO questions. Only flag genuinely empty/near-empty fields,
 * not merely short-but-complete ones.
 */
function detectWeakFields(draft) {
  const weak = [];

  if (!draft.context || draft.context.trim().length < 15) {
    weak.push("context");
  }
  if (!draft.symptom || draft.symptom.trim().length < 10) {
    weak.push("symptom");
  }
  // Deliberately NOT checking problem/solution here — extractionService's
  // own validation already discards drafts missing those (see the
  // `typeof parsed.problem !== "string"` check in extractEntry). If a
  // draft made it this far, problem/solution are already populated.

  return weak;
}

/**
 * Generates 1-2 targeted follow-up questions for ONE draft, based on
 * which fields are weak. Returns [] if the draft is already complete —
 * no question is better than a low-value generic one.
 */
async function generateQuestionsForDraft(draft) {
  const weakFields = detectWeakFields(draft);
  if (weakFields.length === 0) return [];

  const prompt = `A knowledge base entry was extracted from an engineering message, but some fields are thin or missing. Write 1-2 short, specific follow-up questions to ask the original author to fill in the gaps.

Entry so far:
- Problem: ${draft.problem}
- Symptom: ${draft.symptom || "(not captured)"}
- Solution: ${draft.solution}
- Context: ${draft.context || "(not captured)"}

Fields needing more detail: ${weakFields.join(", ")}

Rules:
- Ask only about the fields listed above as needing more detail.
- Each question should be answerable in 1-2 sentences.
- Do NOT ask about fields that already have content.
- Return ONLY a JSON array of question strings, e.g. ["question one?", "question two?"]
- No markdown, no preamble, no explanation.`;

  const response = await generateText({
    system:
      "You generate short, specific follow-up questions. Always respond with a JSON array of strings only.",
    prompt,
    maxTokens: 200,
  });

  try {
    let text = response.trim();
    text = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q) => typeof q === "string" && q.trim().length > 0);
  } catch (err) {
    console.warn(
      `interviewService: failed to parse questions for ${draft.sourceId}, skipping. Raw: ${response}`,
    );
    return []; // fail soft — a missing question is not worth crashing the batch over
  }
}

/**
 * Batch helper — runs over a list of ranked drafts (output of
 * scoreAndRank) and attaches `interviewQuestions: []` to each one.
 * Most drafts will get an empty array; only genuinely thin ones
 * get real questions.
 */
export async function attachInterviewQuestions(drafts) {
  const results = [];
  for (const draft of drafts) {
    const questions = await generateQuestionsForDraft(draft);
    results.push({ ...draft, interviewQuestions: questions });
  }
  return results;
}
