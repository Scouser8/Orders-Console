# Decisions

In progress: the remaining two decisions and final review belong to checklist step 20.

## 1. Database-enforced idempotency for order creation

- Scope each key to the authenticated user using the database's unique `(userId, key)` constraint.
- Reject payload-hash deduplication as the alternative: separate legitimate orders can contain identical customer and item data, so a per-submission key expresses intent.
- Hash normalized validated fields with SHA-256 in a fixed property order; item order matters, and a different payload with the same key returns `409`.
- Create the record, order, and items in one atomic Prisma nested write; calculate integer-money totals on the server.
- Return `201` for creation and matching retries, returning the stored order rather than a frozen response snapshot.
- A concurrent uniqueness loser reads the committed winner and replays it, or returns `409` for a conflicting payload.
- Retain keys without automatic expiry for the database's lifetime; deletion preserves a tombstone and matching retries return `410`.
- Different keys may create identical orders; resetting the database ends the guarantee, and transient write failures should be retried with the same key within SQLite's single-writer limits.

AI usage so far: OpenAI Codex assisted with planning, implementation, documentation, and automated tests. Final disclosure will be reviewed with the completed submission.
