# Stage 6.7 - Project Workstreams

This release adds workstreams inside projects so one market/campaign can be organised into lanes such as Buyer mandates, Seller outreach, Referrer outreach, Research, and Active deals without creating separate projects for each lane.

## Added

- New `ProjectWorkstream` model.
- Workstream statuses: Active, Paused, Completed, Archived.
- Project page can create, archive, and delete workstreams.
- Leads can belong to a project workstream.
- Tasks can belong to a project workstream.
- Project notes can belong to a project workstream.
- Project-deal links can belong to a project workstream.
- Project page includes workstream sections with grouped leads, tasks, deals, and notes.
- Add lead/task/note/link deal forms on a project can choose a workstream.
- Lead list can filter by project and workstream.
- Task list can filter and sort by workstream.
- Task edit page can set a workstream.
- Lead detail page can show/edit workstream context.
- Deal page can show workstream on linked project-deal relationships.

## Behaviour

- Workstreams are optional. Existing project-level records keep working if they have no workstream.
- Deleting a workstream does not delete its leads, tasks, deals, or notes. Their `workstreamId` is set to null by the database.
- If a task is linked to both a project and a deal, Relish also keeps the direct Project-Deal link in sync.
- If a project-linked lead is converted into a deal, Relish carries the workstream onto the Project-Deal link where possible.

## New migration

`20260819110000_stage6_7_project_workstreams`

## Suggested tests

1. Open a project and create workstreams: Buyer mandates, Seller outreach, Referrer outreach.
2. Add a lead inside a workstream and confirm it appears in that workstream section.
3. Add a task inside a workstream and confirm it appears in that workstream section and the global task list filter.
4. Add a project note inside a workstream and confirm it is grouped and labelled correctly.
5. Link an existing deal to the project and assign a workstream.
6. Open the deal and confirm the linked project shows the workstream.
7. Convert a workstream-linked lead to a deal and confirm the Project-Deal link carries the workstream.
8. Archive/delete a test workstream and confirm the linked records are not deleted.
