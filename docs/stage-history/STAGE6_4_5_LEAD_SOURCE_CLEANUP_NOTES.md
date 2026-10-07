# Stage 6.4/6.5 Lead Source Cleanup Patch

This patch simplifies the lead form after the first 6.4/6.5 release.

## Changes

- Lead address is now a single `Address` field.
- The older lead address subfields are removed from Prisma and from the UI:
  - address line 1
  - address line 2
  - suburb
  - state
  - postcode
  - country
- Lead source is now one dropdown.
- The source dropdown includes:
  - built-in source values such as Manual, Referral, Research, Imported
  - previously saved custom sources such as Sam or Sam spreadsheet
  - Custom...
- Choosing `Custom...` shows one text box. Saving it creates/reuses a `LeadSource` record, and it appears in the dropdown next time.
- Lead list search now searches the displayed source label.
- Lead list now has an optional source filter that includes built-in and custom sources.
- Lead note edit forms now include a Cancel button that closes the edit panel.

## Data model notes

Built-in source values are still stored in `MarketLead.source`.
Custom source values are stored in the existing `LeadSource` table and linked through `MarketLead.leadSourceId`.
The UI deliberately combines both into one source dropdown so it feels like one field.

## Migrations

- `20260818123000_stage6_4_5_project_note_sync_guard`
  - Adds ProjectNote channel/occurredAt only if they do not already exist.
  - This is included because some machines may already have those fields through a local sync migration.
- `20260818124000_stage6_4_5_lead_source_address_cleanup`
  - Adds `MarketLead.addressEnc` and `MarketLead.addressIdx`.
  - Removes old multi-part address columns and indexes.

## Apply

Unzip this patch over the current working repo. Do not delete existing migration folders, especially any local `sync_project_note_fields` migration that already exists on your machine.

Then run:

```bash
npx prisma generate
npx prisma migrate dev
npm run check
npm run build
npm run dev
```
