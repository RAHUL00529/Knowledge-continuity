// server/src/utils/fakeSourceLink.js

/**
 * Generates a plausible (but fake) deep-link for demo realism, based on
 * sourceType. Real production version would come from the actual
 * Slack/Jira/GitHub API response — this fabricates the SAME shape so
 * the citation card looks identical to what a real integration would produce.
 */
export function generateFakeSourceLink(sourceType, sourceId) {
  switch (sourceType) {
    case "slack":
      // sourceId format: slack-2026-05-02-priya-01 — just needs to look
      // like a real Slack permalink, the exact ID doesn't need to resolve
      return `https://knowledge-continuity-demo.slack.com/archives/C05PAYMENTS/p${sourceId.replace(/\D/g, "")}`;

    case "ticket": {
      // sourceId format: jira-PAY-118 — extract the real-looking ticket key
      const key = sourceId.replace(/^jira-/, "");
      return `https://knowledge-continuity-demo.atlassian.net/browse/${key}`;
    }

    case "github": {
      // sourceId format: gh-pr-2201 — extract the PR number
      const prNumber = sourceId.replace(/^gh-pr-/, "");
      return `https://github.com/knowledge-continuity-demo/payments-service/pull/${prNumber}`;
    }

    default:
      return null; // "manual" entries (like our test seeds) get no link — that's correct, not a bug
  }
}
