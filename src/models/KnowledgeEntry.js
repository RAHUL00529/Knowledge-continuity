// server/src/models/KnowledgeEntry.js
import mongoose from "mongoose";

const knowledgeEntrySchema = new mongoose.Schema(
  {
    // --- Extracted content (produced by extractionService) ---
    problem: { type: String, required: true },
    symptom: { type: String },
    solution: { type: String, required: true },
    context: { type: String },
    tags: [{ type: String, trim: true, lowercase: true }],

    // --- Provenance / scoping ---
    project: { type: String, required: true, index: true },
    author: {
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
      name: { type: String, required: true, index: true }, // denormalized for fast reads/expertise queries
    },
    sourceId: { type: String, required: true, unique: true }, // e.g. slack msg id, ticket key — drives gap-check
    sourceLink: { type: String }, // fake deep-link for demo realism
    sourceType: {
      type: String,
      enum: ["slack", "ticket", "github", "manual"],
      default: "manual",
    },

    // --- Pipeline state ---
    status: {
      type: String,
      enum: ["draft", "approved", "discarded"],
      default: "draft",
      index: true,
    },
    capturePath: {
      type: String,
      enum: ["daily_batch", "offboarding_gap"],
      required: true,
    },

    // --- PII masking metadata (for the badge/tooltip) ---
    piiMasked: { type: Boolean, default: false },
    piiMaskedCount: { type: Number, default: 0 },

    // --- Retrieval ---
    vector: { type: [Number], default: undefined }, // only populated once approved+embedded
    confidenceScore: { type: Number, default: 1.0 }, // adjusted by feedback loop

    // --- Feedback ---
    feedback: {
      helpfulCount: { type: Number, default: 0 },
      outdatedCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

export default mongoose.model("KnowledgeEntry", knowledgeEntrySchema);
