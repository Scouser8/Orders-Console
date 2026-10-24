# Decisions

## 1. Database-enforced idempotency for order creation

- Each key belongs to the signed-in user, enforced by a unique `(userId, key)` constraint.
- A key is a better fit than deduplicating by payload because two real orders can have identical details.
- The API hashes the normalized request in a fixed order. Reusing a key with different data returns `409`.
- Prisma creates the idempotency record, order, and items in one transaction, and calculates the total on the server.
- A matching retry returns `201` with the stored order. If two requests race, the loser reads and returns the winner.
- Keys stay in the database for its lifetime. Deleting an order leaves a tombstone, so a matching retry returns `410`.
- Different keys can still create identical orders. The form keeps its key only while it is open, so uncertain requests should be retried before refresh or sign-out.

## 2. Cursor pagination instead of offset pagination

- Use a cursor containing the active sort value and the order ID tie-breaker.
- Keep filtering, sorting, and pagination on the API; the browser never loads all orders.
- Offset pagination was rejected because inserts and deletes can shift later pages and cause skips or duplicates.
- TanStack Query appends pages while TanStack Virtual renders only visible rows.
- Query keys include every search, filter, and sort input, and requests consume cancellation signals.
- This is simple for the MVP and still gives us a reasonable path to larger datasets.

## 3. SQLite for the assessment, PostgreSQL at larger scale

- SQLite keeps the assessment easy to run: there is no separate database service to install.
- PostgreSQL would add setup work without helping this single-machine MVP.
- The important correctness rules already live in database constraints and indexes, not in process memory.
- If the dataset grows, move the Prisma schema and idempotency constraint to PostgreSQL through a reviewed migration.
- Before that move, revisit search indexes, connection pooling, backups, and monitoring.
- SQLite is a practical assessment choice, not a claim that it is the right production database at every scale.

## AI Disclosure

I used OpenAI Codex to save time on planning, implementation, documentation, and tests. Lovable provided suggestions for the scaling memo. I ran the relevant checks and reviewed each accepted change before moving on. I did not review every AI-generated test file line by line, so those tests support the review but do not replace manual review. The UI focuses on the assessment requirements rather than visual polish.
