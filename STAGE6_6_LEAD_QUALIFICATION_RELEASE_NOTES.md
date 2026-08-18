# Stage 6.6 Lead Qualification

This patch adds lead qualification fields and makes linked leads visible from the contact page.

## Adds to leads

- Contact attempt status
- Last contacted date/time
- Buyer status
- Seller status
- Lead create/edit forms updated
- Lead detail page shows the new qualification fields
- Lead list filters for contact attempt, buyer status and seller status
- Project page lead rows show contact/buyer/seller qualification summary

## Adds to contacts

- Contact detail page now shows linked leads.
- Linked lead cards show source, project, contact attempt status, buyer status, seller status, priority, confidence, conversion date and next action.
- Linked lead context stays on the lead rather than being copied into the contact fields.

## Migration

- `20260818190000_stage6_6_lead_qualification`

Run:

```bash
npx prisma generate
npx prisma migrate dev
npm run check
npm run build
npm run dev
```

Apply this patch over your current working repo after Stage 6.4/6.5 and the lead source cleanup patch.
