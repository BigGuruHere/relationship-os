# Stage 6.7 Workstream UX Patch

Small UX patch on top of Stage 6.7 Workstream Pages.

## Included

- Adds a search field when attaching an existing lead to a workstream.
- Shows quick matching lead rows with Open links so you can check a lead in another tab before attaching it.
- Adds duplicate lead warnings when creating a new lead from a workstream.
  - Checks existing leads by exact indexed title, person name, company name, email, and phone.
  - Shows possible matches with Open links.
  - Allows Create anyway if it is genuinely a different lead.
- Makes task titles clickable on the main `/tasks` page.

## Migration

No Prisma migration required.

## Test

1. Open a project workstream.
2. Click Attach existing lead and type part of a lead name in the search field.
3. Confirm the lead dropdown/result list filters.
4. Click Open on a result and confirm it opens the lead in a new tab.
5. Create a lead in the workstream using a name/title/company that already exists.
6. Confirm a possible duplicate warning appears.
7. Click Create anyway and confirm the lead is created if you choose to override.
8. Open `/tasks` and confirm the task title itself opens the task edit page.
