# Stage 6.9 - Company-contact relationships

This release turns the existing Company ↔ Contact link into a first-class working record.

## Added

- Dedicated relationship page: `/companies/[companyId]/contacts/[linkId]`
- Open relationship button from the company contact list
- Relationship notes with channel and occurred date
- Edit/cancel/delete relationship notes
- Tasks directly attached to the contact-company relationship
- Wants/offers directly attached to the contact-company relationship
- Deals can be linked through the relationship using `DealContact.companyContactId`
- Relationship edit form for role/title, department, status, primary contact and notes

## Data model

Adds:

- `CompanyContactNote`
- `DealContact.companyContactId`
- `Task.companyContactId`
- `ExchangeItem.companyContactId`

This keeps the existing Company and Contact records clean while creating a workspace for the specific context of a person at a company.

## Suggested tests

1. Open a company page.
2. Click **Open relationship** beside an attached contact.
3. Add a relationship note.
4. Edit and cancel editing the note.
5. Add a task from the relationship page.
6. Link a deal from the relationship page.
7. Add a want/offer for the relationship.
8. Confirm the contact and company still remain separate records.
