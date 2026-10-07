# Stage 6.4/6.5 - Project and Lead Usability

This release combines the practical Stage 6.4 and 6.5 improvements.

## Included

- Project archive action from the project page.
- Project delete action from the project page.
  - Tasks, market leads and wants/offers are unlinked from the project before deletion.
  - Project notes and project-deal links are removed with the project.
  - Contacts, companies, deals, leads and tasks are not deleted.
- Deal notes are now expandable on the deal page.
- Lead notes now support:
  - channel
  - note date / occurred date
  - edit note
  - delete note
- Lead note channels now clearly separate:
  - note
  - call
  - voice note
  - meeting
  - email
  - SMS
  - LinkedIn
  - WhatsApp
  - other
- Deal note channel dropdown now separates Email and SMS and adds LinkedIn/WhatsApp/Other.
- Deal "Add person" now has a search/filter box before selecting a contact.
- Custom lead sources via `LeadSource`.
  - Examples: Sam, Sam spreadsheet, MFAA list, aged-care consultant list.
  - Previously entered sources appear in future dropdowns.
- Leads now have address fields:
  - address line 1
  - address line 2
  - suburb
  - state
  - postcode
  - country
- Added lead types:
  - Potential buyer
  - Potential seller
- Added lead statuses:
  - Not contacted
  - Tried - no contact
  - Left voicemail
  - Follow-up needed
  - Contacted
  - Responded
  - Nurture

## New migrations

- `20260818112000_stage6_4_5_lead_enum_values`
- `20260818113000_stage6_4_5_project_lead_usability`

## Test checklist

1. Create a lead source such as `Sam spreadsheet` from the lead form.
2. Create another lead and confirm `Sam spreadsheet` appears in the custom source dropdown.
3. Create a lead with address fields and confirm they display on the lead detail page.
4. Add a lead note with channel `SMS` and a note date.
5. Edit that lead note and confirm the channel/date/body update.
6. Open a deal and expand a recent deal note.
7. Add a person to a deal using the contact search/filter field.
8. Archive a test project and confirm it leaves active project lists.
9. Delete a test project and confirm related contacts/companies/deals/leads/tasks are not deleted.

## Notes

Workstreams are intentionally not included here. They should remain a later Stage 6.7 style change because they require a project-level workflow model.
