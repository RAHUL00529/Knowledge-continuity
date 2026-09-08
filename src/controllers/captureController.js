import { mineDailyBatch } from "../services/miningService.js";
import { filterItems } from "../services/filteringService.js";
import { maskItems } from "../services/maskingService.js";
import { extractItems } from "../services/extractionService.js";
import { scoreAndRank } from "../services/scoringService.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { embedText } from "../services/embeddingService.js";
import { mineFullHistory } from "../services/miningService.js";
import { findGaps } from "../services/gapCheckService.js";
import { attachInterviewQuestions } from "../services/interviewService.js";

export async function runDailyBatch(req, res) {
  try {
    const { date } = req.body; // optional — defaults to latest seeded day inside miningService

    // Stage 1: Mining
    const minedItems = mineDailyBatch(date);
    if (minedItems.length === 0) {
      return res.json({ mined: 0, filtered: 0, discarded: 0, drafts: [] });
    }

    // Stage 2: Relevance filtering (heuristic + LLM pass)
    const { kept, discarded } = await filterItems(minedItems);

    // Stage 3: PII masking
    const maskedItems = await maskItems(kept);

    // Stage 4: AI extraction
    const drafts = await extractItems(maskedItems);

    // Stage 5: Re-pair drafts with their original mined item (need date/signals for scoring)
    const itemsBySourceId = new Map(kept.map((i) => [i.sourceId, i]));
    const itemsWithDrafts = drafts
      .map((draft) => {
        const originalItem = itemsBySourceId.get(draft.sourceId);
        return originalItem ? { item: originalItem, draft } : null;
      })
      .filter(Boolean);

    const rankedDrafts = scoreAndRank(itemsWithDrafts);

    return res.json({
      mined: minedItems.length,
      filtered: kept.length,
      discarded: discarded.length,
      drafts: rankedDrafts,
    });
  } catch (err) {
    console.error("runDailyBatch failed:", err);
    return res.status(500).json({ error: "Failed to run daily batch capture" });
  }
}

export async function saveEntries(req, res) {
  try {
    const { entries } = req.body;
    // entries: [{ ...draft fields, decision: "approve" | "discard", edits?: {...} }]

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: "No entries provided" });
    }

    const approved = entries.filter((e) => e.decision === "approve");
    const saved = [];

    for (const entry of approved) {
      const merged = { ...entry, ...(entry.edits || {}) }; // edits win over original draft

      const embeddingInput = [
        merged.problem,
        merged.symptom,
        merged.solution,
        merged.context,
      ]
        .filter(Boolean)
        .join(" ");
      const vector = await embedText(embeddingInput);

      const doc = await KnowledgeEntry.create({
        problem: merged.problem,
        symptom: merged.symptom,
        solution: merged.solution,
        context: merged.context,
        tags: merged.tags,
        project: merged.project,
        author: merged.author,
        sourceId: merged.sourceId,
        sourceType: merged.sourceType,
        capturePath: merged.capturePath,
        piiMasked: merged.piiMasked,
        piiMaskedCount: merged.piiMaskedCount,
        status: "approved",
        vector,
      });

      saved.push(doc._id);
    }

    return res.json({
      requested: entries.length,
      approved: approved.length,
      discarded: entries.length - approved.length,
      saved,
    });
  } catch (err) {
    console.error("saveEntries failed:", err);
    return res.status(500).json({ error: "Failed to save entries" });
  }
}

// (mineDailyBatch, filterItems, maskItems, extractItems, scoreAndRank,
//  KnowledgeEntry, embedText already imported above from Phase 2/3)

export async function runOffboardingGapCheck(req, res) {
  try {
    // Stage 1: Mine the employee's ENTIRE history (seeded for demo)
    const fullHistory = mineFullHistory();
    if (fullHistory.length === 0) {
      return res.json({
        totalMined: 0,
        alreadyCapturedCount: 0,
        gapsFound: 0,
        filtered: 0,
        discarded: 0,
        drafts: [],
      });
    }

    // Stage 2: Gap check — diff against what's already stored in MongoDB
    const { gaps, alreadyCapturedCount, totalMined } =
      await findGaps(fullHistory);

    if (gaps.length === 0) {
      // Edge case worth handling explicitly: nothing to review.
      // A good thing! Worth a distinct response so the frontend can
      // show "no gaps found" rather than an empty-looking error state.
      return res.json({
        totalMined,
        alreadyCapturedCount,
        gapsFound: 0,
        filtered: 0,
        discarded: 0,
        drafts: [],
      });
    }

    // Stage 3: Relevance filtering — same two-pass logic as daily batch,
    // applied ONLY to the surviving gap items (not the whole history)
    const { kept, discarded } = await filterItems(gaps);

    // Stage 4: PII masking (identical to daily-batch path)
    const maskedItems = await maskItems(kept);

    // Stage 5: AI extraction (identical to daily-batch path)
    const drafts = await extractItems(maskedItems);

    // Stage 6: Re-pair drafts with original gap items for scoring
    // (same pattern as runDailyBatch — scoreAndRank needs date/signals,
    // which don't survive onto the extracted draft object)
    const itemsBySourceId = new Map(kept.map((i) => [i.sourceId, i]));
    const itemsWithDrafts = drafts
      .map((draft) => {
        const originalItem = itemsBySourceId.get(draft.sourceId);
        return originalItem ? { item: originalItem, draft } : null;
      })
      .filter(Boolean);

    const rankedDrafts = scoreAndRank(itemsWithDrafts);
    const draftsWithQuestions = await attachInterviewQuestions(rankedDrafts);

    return res.json({
      totalMined,
      alreadyCapturedCount,
      gapsFound: gaps.length,
      filtered: kept.length,
      discarded: discarded.length,
      drafts: draftsWithQuestions,
    });
  } catch (err) {
    console.error("runOffboardingGapCheck failed:", err);
    return res
      .status(500)
      .json({ error: "Failed to run offboarding gap check" });
  }
}

export async function submitInterviewAnswers(req, res) {
  try {
    const { sourceId, answers } = req.body;
    // answers: [{ question: "...", answer: "..." }]

    if (!sourceId || !Array.isArray(answers) || answers.length === 0) {
      return res
        .status(400)
        .json({ error: "sourceId and answers are required" });
    }

    // Merge answers into the context field — simplest, most robust
    // approach for a hackathon: append rather than trying to re-run
    // extraction with the new info (which risks losing/mangling
    // already-good fields).
    const additionalContext = answers
      .map((a) => `${a.question} ${a.answer}`)
      .join(" ");

    return res.json({
      sourceId,
      mergedContext: additionalContext,
      // Frontend merges this into the draft's `context` field client-side
      // before the user hits "Approve" — no DB write happens here, since
      // nothing is persisted until saveEntries.
    });
  } catch (err) {
    console.error("submitInterviewAnswers failed:", err);
    return res
      .status(500)
      .json({ error: "Failed to process interview answers" });
  }
}
