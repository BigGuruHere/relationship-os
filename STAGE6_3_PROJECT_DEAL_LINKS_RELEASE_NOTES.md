# Stage 6.3 Project-Deal Links

This release adds direct Project ↔ Deal links so a deal can belong to a project without relying on a task as the relationship bridge.

## Added

- New `ProjectDeal` join model.
- Project page now has a **Linked deals** section.
- Project page can link an existing deal directly to the project.
- Project page can start a new deal with the project already attached.
- Deal page now has a **Linked projects** section.
- Deal page can link an existing project directly to the deal.
- Removing a link does not delete the project or deal.
- Creating a project task with an attached deal now also creates the direct project-deal link.
- Creating a deal task with an attached project now also creates the direct project-deal link.
- Converting a project-linked lead to a deal now also creates the direct project-deal link.
- Migration backfills direct links from existing tasks where both `projectId` and `dealId` are already present.

## Why

Before this release, deals were related to projects mainly through tasks:

`Project → Task → Deal`

That worked, but it made tasks act as the relationship glue. This release makes the model cleaner:

`Project → Deal`

Tasks remain next actions, not the main relationship between records.

## Migration

New migration:

`20260818104500_stage6_3_project_deal_links`

Run:

```bash
npx prisma generate
npx prisma migrate dev
npm run check
npm run build
npm run dev
```

## Suggested tests

1. Open a project and link an existing deal.
2. Confirm the deal appears under Linked deals.
3. Open the deal and confirm the project appears under Linked projects.
4. Remove the link from the project and confirm the deal still exists.
5. From a project, click New deal and create a deal. Confirm it is automatically linked back to the project.
6. Add a project task with an attached deal. Confirm the direct link is created automatically.
7. Convert a project-linked lead to a deal. Confirm the new deal is directly linked to the lead's project.
