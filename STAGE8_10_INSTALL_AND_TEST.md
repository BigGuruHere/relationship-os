# Stage 8.10 - Install and Test

## Install

Stage 8.10 includes a small database-function migration. It adds `introduction_participant` to the fail-closed `AgentRunEntity` custody allowlist. It does not add or alter a table or Prisma model.

```bash
# Apply the database-function migration in development.
npx prisma migrate dev

# Refresh the generated Prisma client, following the normal development workflow.
npx prisma generate

# Install dependencies and refresh generated SvelteKit route types if required.
npm install

# Run the focused Stage 8.10 pilot regression.
npm run check:stage8.10

# Re-run the ContextSpace boundary regression.
npm run check:stage8.9

# Start the development application.
npm run dev
```

If Stage 8.10 was installed before this correction, run both Prisma commands above before retrying a reflection.
The migration also closes any pending Dating review left behind by this specific failed-run path. It does not delete the encrypted transcript or audit history.

## Manual acceptance

1. Open `/dating` and confirm no Business modules or Business records appear.
2. Open Dating People and add two pilot people.
3. Create a Dating Introduction using those two people.
4. Open the Introduction and select Record reflection.
5. Select the respondent before recording.
6. Record or type a controlled reflection that covers personal experience, self-learning, experience of the other person, relationship dynamic, and desire to continue.
7. Confirm processing consent and deliberately choose the permitted uses.
8. Submit and confirm the review page shows the source transcript and separate proposed perspectives.
9. Edit at least one proposal field.
10. Reject one dry-run proposal and confirm no Outcome is created.
11. Create another reflection, approve it, and confirm exactly one whole-Introduction Outcome is created.
12. Confirm no Want, Offer, Knowledge Claim, match, message, or participant disclosure was created.

## Pilot evidence gate

- Complete at least five controlled dry runs.
- Complete at least five real single-sided reflections with informed consent where another person is identifiable.
- Record whether at least 90 percent of exact proposed fields are correct before editing.
- Confirm every proposal remains traceable to its encrypted source transcript.
- Confirm no unredacted transcript appears in ordinary agent audit JSON.
- Use the evidence to decide whether Stage 8.11 needs `IntroductionFeedback` as a durable Core model.
