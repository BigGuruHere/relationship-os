# Stage 6.7 Workstream Pages Patch

This patch adds an actual working page for each project workstream.

## New route

`/projects/[projectId]/workstreams/[workstreamId]`

## Included

- Workstream cards on the project page now have an Open button and are clickable.
- New workstream detail page.
- Work inside a workstream with:
  - Leads
  - Tasks
  - Notes
  - Linked deals
- Create a lead directly inside a workstream.
- Attach an existing lead to the workstream.
- Create a task directly inside a workstream.
- Add notes directly to the workstream.
- Link an existing deal to the workstream.
- Remove deal links from the workstream without deleting the deal.
- Update task status from the workstream page.
- Edit workstream name and description.
- Links back to the parent project, task inbox and leads list with project/workstream filters.

## Migration

No Prisma migration is required. This uses the Stage 6.7 workstream fields already added to:

- MarketLead
- Task
- ProjectNote
- ProjectDeal

## Install

Apply this patch over your current working repo after Stage 6.7.

Run:

```bash
npm run check
npm run build
npm run dev
```

## Tests

1. Open a project.
2. Click Open on a workstream card.
3. Add a task inside the workstream.
4. Add a lead inside the workstream.
5. Attach an existing lead.
6. Add a note.
7. Link a deal.
8. Confirm each item appears on the workstream page and still appears in the project overview.
