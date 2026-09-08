// server/src/controllers/queryController.js
import { embedText } from "../services/embeddingService.js";
import { findSimilarEntries } from "../services/similarityService.js";
import { synthesizeAnswer } from "../services/synthesisService.js";
import { findRelatedExperts } from "../services/expertiseService.js";
import { submitFeedback } from "../services/feedbackService.js";

const MAX_SOURCES_IN_RESPONSE = 3; // matches synthesisService's MAX_MATCHES_FOR_SYNTHESIS —
// the citation card should only ever show sources the answer actually drew from

export async function searchKnowledge(req, res) {
  try {
    const { query, project } = req.body;

    // Fail fast, before any embedding/LLM cost is spent
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "A non-empty query is required" });
    }

    // Stage 1: embed the query
    const queryVector = await embedText(query.trim());

    // Stage 2: semantic search (optionally project-scoped)
    const matches = await findSimilarEntries(queryVector, {
      project: project || undefined,
      topK: 5,
    });

    // Stage 3: synthesize the answer (handles the zero-match case internally)
    const answer = await synthesizeAnswer(query, matches);

    // Stage 4: related experts (handles zero-match case internally — returns [])
    const relatedExperts = await findRelatedExperts(matches);

    // Stage 5: shape citations from the SAME matches the answer was built from —
    // never more than what synthesisService actually saw, so the citation
    // card never implies the answer used a source it didn't.
    const sources = matches.slice(0, MAX_SOURCES_IN_RESPONSE).map((m) => ({
      entryId: m._id,
      problem: m.problem,
      author: m.author?.name || "Unknown",
      project: m.project,
      capturedAt: m.createdAt,
      sourceLink: m.sourceLink || null,
      sourceType: m.sourceType,
      similarityScore: m.similarityScore,
    }));

    return res.json({
      query,
      answer,
      sources,
      relatedExperts,
      matchCount: matches.length,
    });
  } catch (err) {
    console.error("searchKnowledge failed:", err);
    return res.status(500).json({ error: "Failed to process query" });
  }
}

// ADD this new export at the bottom of the file:

export async function handleFeedback(req, res) {
  try {
    const { entryId, rating } = req.body;

    if (!entryId || !rating) {
      return res.status(400).json({ error: "entryId and rating are required" });
    }

    const result = await submitFeedback(entryId, rating);

    if (!result.success) {
      // Distinguish "bad input" (400) from "valid input, entry just doesn't exist" (404)
      const status = result.error === "Entry not found" ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }

    return res.json(result);
  } catch (err) {
    console.error("handleFeedback failed:", err);
    return res.status(500).json({ error: "Failed to submit feedback" });
  }
}
