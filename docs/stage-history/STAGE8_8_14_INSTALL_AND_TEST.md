# Stage 8.8.14 - Install and Test

Stage 8.8.14 changes documentation and adds a roadmap regression only. It has no database migration or runtime change.

```bash
# Install locked dependencies if they are not already installed.
npm install

# Run the consolidated RelationshipOS roadmap regression.
npm run check:stage8.8.14

# Run the earlier Stage 8.8 documentation baseline regression.
npm run check:stage8.8.13

# Run the normal project validation when using the supported Node 22 runtime.
npm run check
```

No `prisma migrate` command is required for this release.
