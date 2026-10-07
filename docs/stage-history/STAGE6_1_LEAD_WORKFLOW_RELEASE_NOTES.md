# Stage 6.1 - Lead Workflow Upgrade

This release makes Market Leads operational inside projects.

## Added

- Lead notes via new `MarketLeadNote` model.
- Lead-linked tasks via new `Task.marketLeadId` field.
- Lead detail page sections for:
  - lead notes
  - lead tasks
  - quick add lead task
- Project detail page lead workflow:
  - add a lead directly from a project
  - show project leads
  - project summary now includes lead counts
  - project tasks can attach to leads
- Task inbox can attach new tasks to a lead.
- Lead create/edit can assign a lead to a project.
- Converting a lead to contact/company/deal preserves the lead record and updates existing lead-linked tasks with the converted record where the task does not already have that link.

## Migration

`20260817231000_stage6_1_lead_workflow`

Adds:

- `MarketLeadNote`
- `Task.marketLeadId`
- indexes for lead notes and lead-linked tasks

## Suggested tests

1. Create a project.
2. Add a project lead from the project page.
3. Open the lead and add a lead note.
4. Add a task from the lead page.
5. Confirm the task appears on the project page and task inbox.
6. Convert the lead to a contact.
7. Confirm the original lead remains and the task now links to the created contact where blank.
