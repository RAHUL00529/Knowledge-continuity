// server/src/utils/piiPatterns.js

// Each pattern has a `regex` and a `label` used as the placeholder token.
// Order matters slightly (email before generic number patterns) to avoid
// a phone-like substring inside an email being double-matched.
export const PII_PATTERNS = [
  {
    label: "EMAIL",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
  {
    label: "PHONE",
    // Matches common formats: (123) 456-7890, 123-456-7890, +91 98765 43210, etc.
    regex:
      /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/g,
  },
  {
    label: "ID",
    // Generic internal ID-looking tokens: SSN-like, employee-ID-like,
    // card-last-4 patterns. Deliberately narrow to avoid false positives
    // on legitimate ticket keys like "PAY-118" (hyphen + digits only,
    // no letter prefix, min length 6).
    regex: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9,16}\b/g,
  },
];

/**
 * Runs all regex patterns over text, replacing matches with a
 * placeholder token like [EMAIL_1], [PHONE_1], and tracking count.
 */
export function applyRegexMasking(text) {
  let masked = text;
  let count = 0;

  for (const { label, regex } of PII_PATTERNS) {
    masked = masked.replace(regex, () => {
      count += 1;
      return `[${label}_${count}]`;
    });
  }

  return { masked, count };
}
