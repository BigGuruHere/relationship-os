# Stage 6 - Market Leads

This release adds a practical Lead layer for Relish's market-making workflow.

## Why

Relish now needs to capture weak, unconfirmed, or pre-researched signals before they deserve to become a Contact, Company, Deal, Want, or Offer.

A Lead is a staging record for market-making. It can represent:

- Buyer
- Seller
- Company
- Contact
- Mandate
- Asset
- Referrer
- Other

## Added

- New `/leads` page
- New `/leads/[id]` detail page
- New `MarketLead` Prisma model
- Lead type, status, source, priority, confidence, and usual communication method
- Lead fields for person/company/contact details, geography, value range, description, notes, source URL, and next action
- Convert lead to Contact
- Convert lead to Company
- Convert lead to Deal
- Convert lead to Want
- Convert lead to Offer
- Create lead from Contact
- Usual communication method on Contact
- Leads link back to converted Contact/Company/Deal/Want/Offer records

## Important implementation note

There was already an older `Lead` Prisma model used for public claim/invite behaviour. To avoid breaking that existing functionality, this release adds the market-making lead model as `MarketLead` in Prisma while showing it as "Leads" in the app UI.

## Migration

New migration:

```text
20260817180000_stage6_market_leads
```

## Recommended test flow

1. Run:

```bash
npx prisma generate
npx prisma migrate dev
npm run check
npm run build
npm run dev
```

2. Open `/leads` and create a buyer lead.
3. Convert that lead to a contact.
4. Create a contact and click `Create lead` from the contact detail page.
5. Create a company-type lead and convert it to a company.
6. Create a mandate lead and convert it to a want or offer.
7. Check that the original lead remains as history and links to the converted record.

## Left for later stages

- Lead duplicate warnings
- Lead notes timeline
- Lead to project linking from the UI
- Lead to existing record linking rather than only creating new converted records
- Buyer mandate and seller opportunity views
- Market Map view
