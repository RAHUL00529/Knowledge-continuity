[
  {
    problem: "Redis connection pool exhausted during bulk order import jobs",
    symptom:
      "Nightly bulk-import job started failing intermittently with 'connection pool timeout' errors around the same time checkout traffic peaked",
    solution:
      "The bulk-import job and the live checkout-worker were sharing the same Redis connection pool. Split them into two separate pools with independent max sizes so a batch job spike can't starve live customer traffic.",
    context:
      "Related to but distinct from the July connection-pool incident Priya handled - same symptom family (pool exhaustion) but a different root cause (resource contention between two consumers, not an unbounded pool size).",
    tags: ["redis", "connection-pool", "checkout-worker"],
    project: "checkout-service",
    author: "Tom Chen",
    sourceId: "jira-CHK-1055",
    sourceLink: "https://acme.atlassian.net/browse/CHK-1055",
    sourceType: "jira",
    status: "approved",
    capturePath: "daily-batch",
    confidenceScore: 62,
    demoLabel:
      "Pre-stored - proves 'related experts' surfaces Tom alongside Priya for redis/connection-pool queries",
  },
  {
    problem:
      "Downstream payment API getting overwhelmed by retry storms during brief outages",
    symptom:
      "Payment provider's status page showed no outage on their end, but our error rate spiked in bursts every few minutes",
    solution:
      "checkout-worker's retry logic had no rate limit of its own, so during any hiccup every in-flight request retried simultaneously, effectively DDoS-ing our own outbound calls. Added a shared rate limiter across all retry attempts, not just per-request backoff.",
    context:
      "Complements CHK-1042 (Priya's backoff fix) - backoff controls a single request's retry pace, this controls the aggregate retry volume across all requests at once.",
    tags: ["retry-logic", "rate-limiting", "payment-gateway"],
    project: "checkout-service",
    author: "Tom Chen",
    sourceId: "jira-CHK-1068",
    sourceLink: "https://acme.atlassian.net/browse/CHK-1068",
    sourceType: "jira",
    status: "approved",
    capturePath: "daily-batch",
    confidenceScore: 71,
    demoLabel:
      "Pre-stored - reinforces Tom as a second checkout-service expert",
  },
  {
    problem: "JWT refresh token race condition causing duplicate login prompts",
    symptom:
      "Users on flaky mobile connections occasionally got bounced back to the login screen even with a valid session, roughly 1 in a few hundred logins",
    solution:
      "Two near-simultaneous requests could both detect an expiring token and both fire a refresh, and the second refresh invalidated the first token before the first request's response reached the client. Added a short-lived lock keyed on user id during refresh so only one refresh can be in flight at a time.",
    context:
      "This is an auth-platform bug, unrelated to checkout-service, but shares the word 'race-condition' with Priya's webhook bug",
    tags: ["jwt", "race-condition", "session"],
    project: "auth-platform",
    author: "Aisha Khan",
    sourceId: "jira-AUTH-330",
    sourceLink: "https://acme.atlassian.net/browse/AUTH-330",
    sourceType: "jira",
    status: "approved",
    capturePath: "daily-batch",
    confidenceScore: 58,
    demoLabel:
      "★ DELIBERATE NEAR-MISS - proves why project-scoping matters. Without scoping, this could surface as a false-positive 'expert' for Raj's checkout-service race-condition question. With scoping to checkout-service, it correctly does NOT appear. Great judge Q&A moment.",
  },
  {
    problem:
      "Notification delivery queue backing up under load, some notifications delayed by hours",
    symptom:
      "Push notification queue depth kept climbing during peak hours instead of draining",
    solution:
      "A downstream provider timeout was causing failed jobs to requeue instantly with no backoff, same failure class as the checkout-worker retry issue but in a completely different service. Added exponential backoff to the notification retry worker.",
    context:
      "Interesting case if it comes up: same underlying pattern (retry-logic) recurring across two unrelated services, which is a nice organic example of the platform surfacing a shared institutional lesson if you ever search across projects.",
    tags: ["queue", "retry-logic", "notifications"],
    project: "notifications-service",
    author: "Maria Lopez",
    sourceId: "jira-NOTIF-201",
    sourceLink: "https://acme.atlassian.net/browse/NOTIF-201",
    sourceType: "jira",
    status: "approved",
    capturePath: "daily-batch",
    confidenceScore: 55,
    demoLabel:
      "Pre-stored - third project, fills out the scoping dropdown, optional cross-project talking point",
  },
];
