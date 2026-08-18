# Stage 6.6 Follow-up - Contact Qualification Fields

This patch keeps converted leads as origin/history records, but moves the ongoing relationship/outreach state onto Contact.

## Included

- Adds Contact fields:
  - address
  - source/origin
  - custom lead source link
  - contact attempt status
  - buyer status
  - seller status
- Contact already had:
  - usual communication method
  - last contacted date
- Contact create/edit pages now expose those fields.
- Contact detail page now displays those fields.
- Lead-to-contact conversion now copies ongoing relationship fields into the contact.
- If the lead was already linked to an existing contact, conversion fills only blank/default contact fields and does not overwrite stronger existing contact data.
- Converted leads remain linked as history and remain visible from the contact page.
- Converted leads are hidden from the default active Leads list and project active lead lists.

## Migration

Adds:

`20260818194500_stage6_6_contact_qualification_fields`

## Run

```bash
npx prisma generate
npx prisma migrate dev
npm run check
npm run build
npm run dev
```

## Test

1. Create a lead with source, buyer/seller status, contact attempt, address, usual communication and last contacted.
2. Convert it to a contact.
3. Confirm the contact shows those fields.
4. Confirm the converted lead is still visible in the contact's Linked leads panel.
5. Open `/leads` without filters and confirm the converted lead no longer appears in the active list.
6. Filter lead status to Converted and confirm it can still be found.
