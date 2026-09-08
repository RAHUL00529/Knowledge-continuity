// server/src/scratch-test-mask.js
import { maskText } from "./services/maskingService.js";

const sample = `Contacted Priya Sharma at priya.sharma@company.com or 
+91 98765 43210 about ticket PAY-118 — she said the root cause 
was the Redis pool exhausting under load.`;

const result = await maskText(sample);
console.log("Masked text:\n", result.maskedText);
console.log("piiMasked:", result.piiMasked, "| count:", result.piiMaskedCount);
