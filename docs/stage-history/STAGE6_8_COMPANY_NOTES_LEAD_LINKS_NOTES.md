# Stage 6.8 - Company Notes and Lead Links

This patch adds company-level notes and makes Company ↔ Lead linking a first-class workflow.

## Included

- Dedicated `CompanyNote` model and migration.
- Company page now has company notes with channel, occurred date, edit, cancel, and delete.
- Company page now shows linked leads.
- Company page can create a new lead from the company.
- Company page can attach an existing lead with client-side search and open-in-new-tab checks.
- Company page can detach a lead from the company without deleting the lead.
- Company page contact attachment now has a search box across contact name, email and phone.
- Lead page can link/unlink an existing company with search.
- Converting a company-linked lead to contact now attaches the new/existing contact to the company through `CompanyContact`.
- Lead tasks inherit the linked company when a lead is attached or converted where task company is blank.

## Migration

`20260820110000_stage6_8_company_notes_lead_links`

## Recommended tests

1. Open a company and add a company note.
2. Edit and cancel a company note edit.
3. Edit and save a company note.
4. Create a lead from the company page.
5. Attach an existing lead to the company using search.
6. Open the lead and confirm the company is linked.
7. Convert that lead to a contact.
8. Confirm the contact is attached to the company under Employees / contacts.
9. Search for a contact when adding a contact to the company.
