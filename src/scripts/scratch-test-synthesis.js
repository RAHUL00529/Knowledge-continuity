// server/src/scripts/scratch-test-synthesis.js
import dotenv from "dotenv";
dotenv.config();

import { synthesizeAnswer } from "../services/synthesisService.js";

const query = "our checkout API is throwing random 502 errors under load";

// Hardcoded matches — no DB needed, this mirrors what
// similarityService would hand off after Step 1
const matches = [
  {
    problem: "Intermittent 502s on the checkout service",
    symptom: "Random 502 errors during traffic spikes",
    solution:
      "Explicitly call conn.release() in the finally block of the payment retry handler, and bumped pool size from 10 to 25.",
    context:
      "Root cause was the Redis connection pool exhausting because failed transactions left connections in a half-open state until timeout.",
    project: "Payments Platform",
  },
  {
    problem:
      "Payment service was silently swallowing timeout errors from the fraud-check API",
    symptom: "Fraudulent transactions let through during an outage",
    solution:
      "Changed to fail-closed with a manual review queue on timeout, added alerting on fraud-check timeout rate.",
    context: "A fail-open bug — timeouts were being treated as 'approved'.",
    project: "Payments Platform",
  },
];

async function run() {
  console.log(`Query: "${query}"\n`);

  console.log("--- With matches (real case) ---");
  const answer = await synthesizeAnswer(query, matches);
  console.log(answer);

  console.log("\n--- With zero matches (should skip LLM entirely) ---");
  const start = Date.now();
  const noMatchAnswer = await synthesizeAnswer(query, []);
  const elapsed = Date.now() - start;
  console.log(noMatchAnswer);
  console.log(
    `(took ${elapsed}ms — should be near-instant; if this took 500ms+, an LLM call happened when it shouldn't have)`,
  );
}

run();
