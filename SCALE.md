# Scaling notes

For five million orders, three developers, and agents working all day in two countries, I would keep the current React frontend and single NestJS API. I would first measure slow requests and browser memory during realistic use, then improve the parts that struggle.

## What I would change

- **Database and search:** Move from SQLite to PostgreSQL as concurrent writes grow, with a reviewed migration and tested backups. Our customer search currently uses `contains`; the sorting indexes do not make substring searches fast. Measure search with realistic data before choosing a search index or changing how matching works.
- **Long sessions:** The table renders only visible rows, but TanStack Query still keeps the loaded pages in memory. Measure memory during long scrolling sessions and limit retained pages if needed, while preserving the ability to scroll back. Review the current memory-only login too: refreshing signs agents out. A persistent session should include clear expiry and logout behavior, with the security details reviewed before implementation.
- **Two countries:** Check response times from both locations and display dates in the agent's local time zone while storing UTC. Being in different countries does not by itself require separate databases or country-based access rules.

## What I would keep

Keep server-side search, filtering, sorting, and cursor pagination, along with virtualization and cancellation of outdated requests. They avoid downloading or rendering the whole dataset, although performance still needs testing at the larger size. Keep order creation confirmed by the server, with totals, authorization, and duplicate protection enforced there. Preserve the database's unique idempotency constraint through any migration.

With three developers, the existing feature folders and one API are manageable. Keep the API contracts clear and require checks and review for changes to queries, authentication, and order creation.

## What I would push back on

I would avoid splitting the API into microservices or adding a separate search service before measurements show a need. I would also push back on downloading all orders into the browser or bulk-deleting cancelled orders without agreed retention and recovery rules. The goal is a responsive, reliable console that a small team can maintain.
