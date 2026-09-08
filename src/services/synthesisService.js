// server/src/services/synthesisService.js
import { generateText } from "../config/llmClient.js";

// More than 3 dilutes focus and burns tokens for marginal gain — anything
// ranked #4/#5 already scored lower relevance in similarityService, so
// including them risks the answer hedging across weak options instead of
// committing to the actual best fix.
const MAX_MATCHES_FOR_SYNTHESIS = 3;

const NO_MATCHES_MESSAGE =
  "I couldn't find any existing knowledge base entries relevant to this question. This might be new territory — consider asking a teammate directly, or check back after more knowledge has been captured.";

function buildSynthesisPrompt(query, matches) {
  const contextBlocks = matches
    .map(
      (m, i) => `[Entry ${i + 1}] (project: ${m.project})
Problem: ${m.problem}
Symptom: ${m.symptom || "N/A"}
Solution: ${m.solution}
Context: ${m.context || "N/A"}`,
    )
    .join("\n\n");

  return `A team member asked the following question:

"""
${query}
"""

Here are the most relevant past knowledge base entries, ranked by relevance:

${contextBlocks}

Write a clear, direct answer to their question using ONLY the information in these entries.

Rules:
- If one entry is clearly the best match, lead with its solution directly — don't hedge or make the reader dig through multiple options if only one is actually relevant.
- If multiple entries are genuinely relevant (e.g. a recurring pattern), synthesize them into one coherent explanation rather than listing them separately.
- Do NOT invent any technical detail, root cause, or fix that isn't explicitly present in the entries above.
- Do NOT mention "Entry 1", "Entry 2", etc. in your answer — write it as a normal, direct explanation, not a citation of internal labels. Source attribution is handled separately, outside this answer.
- Keep the answer focused and practical — a few sentences to a short paragraph, not an essay.
- Do NOT add generic advice, caveats, or disclaimers not grounded in the entries above.

Write only the answer text, nothing else.`;
}

export async function synthesizeAnswer(query, matches) {
  if (!matches || matches.length === 0) {
    return NO_MATCHES_MESSAGE;
  }

  const topMatches = matches.slice(0, MAX_MATCHES_FOR_SYNTHESIS);

  try {
    const answer = await generateText({
      system:
        "You are a precise internal engineering assistant. You only answer using the knowledge base entries you're given — never your own general knowledge — since this is company-specific tacit knowledge no outside model could actually know. Be direct and concise.",
      prompt: buildSynthesisPrompt(query, topMatches),
      maxTokens: 400,
    });

    return answer.trim();
  } catch (err) {
    console.error("synthesizeAnswer failed:", err.message);
    // Fail soft: a synthesis hiccup shouldn't crash the whole
    // /api/query/search request. Fall back to the raw solution text
    // of the top match — less polished, but still a genuinely correct
    // and useful answer, sourced from real data either way.
    const top = topMatches[0];
    return `${top.solution}${top.context ? ` (${top.context})` : ""}`;
  }
}
