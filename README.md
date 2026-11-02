# Relish

Relish is a person-first Relationship Operating System. It helps people remember, understand and develop valuable human relationships. Dorian is an AI conversational partner supporting those relationships.

## Current project reference

**Start with [docs/START_HERE.md](docs/START_HERE.md).** It links the living documents that replace outdated stage-specific bootstrap prompts:

- [Product vision and principles](docs/PRODUCT_AND_PRINCIPLES.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE_AND_BOUNDARIES.md)
- [Current implementation status](docs/CURRENT_STATE.md)
- [Forward plan](docs/ROADMAP.md)
- [Decision log](docs/DECISION_LOG.md)
- [Engineering rules](AGENTS.md)

These documents describe the current direction and verified repository state. The source, schema and tests on the selected branch establish actual implementation. A Git merge does not necessarily mean a Railway deployment has occurred.

## Repositories

- `BigGuruHere/relationship-os`: main Relish SvelteKit app and domain Core.
- `BigGuruHere/relish-agent-management`: management of conversational agents.
- `BigGuruHere/relish-proxy-server`: provider/session routing.

## Development

Use the configured local Development environment and its isolated database. Never use production connection credentials for development.

```sh
# Start the application for local testing.
npm run dev

# Run SvelteKit and TypeScript checks.
npm run check

# Run the existing behavioral tests.
npm test
```

When a change genuinely introduces a Prisma migration, follow the repository's current safe migration procedure and verify the target database before applying it. No migration is implied by documentation or UI-only work.

## Older stage notes

Release notes, earlier roadmaps, install reports and architecture experiments remain in this repository for history. Many are in [docs/stage-history](docs/stage-history/README.md), while some later `STAGE_*.md` files are still at the root. They are **not the current roadmap** merely because they say "canonical" or "latest". Do not delete them or migrations as part of routine cleanup.
