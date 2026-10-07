# Stage 4 - Opportunity Scoring v2

This package adds an explainable scoring layer to the Relish Agent Framework.

## What changed

- Added `OpportunityScoreFactor` for durable score-factor evidence/rationale.
- Extended `OpportunityScore` with labels, priority, recommended action, v2 score fields, and `updatedAt`.
- Upgraded `create_opportunity_score` to store score factors and advisory labels.
- Added `Opportunity Scoring Agent` to the core agent setup.
- Added `/agents/scoring/new` manual scoring page.
- Added scorecard display on agent run detail pages.
- Added `Score opportunity` buttons to company, contact, and deal detail pages.
- Updated Outreach Agent scoring payloads to support Stage 4 factor fields.
- Updated Outreach Agent instructions so cold first-touch outreach is softer and less transactional.

## Migration

Run:

```bash
npx prisma generate
npx prisma migrate dev
npm run check
npm run build
```

Production should use the existing deployment command:

```bash
prisma migrate deploy && node build/index.js
```

## Safety model

Scores are advisory only. They do not import records, send outreach, or create deals. Hot/warm scores may create review tasks for the user to inspect.
