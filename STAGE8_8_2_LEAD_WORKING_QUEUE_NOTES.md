# Stage 8.8.2 - Lead Working Queue Navigation

## Purpose

Stage 8.8.2 is a small code-only usability release for working through selected calling batches quickly.

The real workflow that triggered it is:

1. Open a filtered lead batch, usually by Lead Source.
2. Open the next lead.
3. Call the lead or send a LinkedIn request.
4. Lower priority when the lead has been actioned for now.
5. Return to the same filtered batch and continue with the next lead.

No new workflow status, lead-list model, or database concept is introduced.

## Changes

### Existing priority display is now the control

Stage 8.8.1 added a second priority control near the page title. Stage 8.8.2 removes that duplicate.

The existing `Priority` row in the lead Details panel now contains the autosaving stepper:

```text
Priority    ▼  3/5  ▲
```

The existing `quickPriority` server action and 1-5 boundary remain unchanged.

### Return to the exact working list

The Leads page now passes its exact current URL into each lead link. This includes filters such as:

- Lead Source / import batch
- search text
- lead type
- status
- contact-attempt status
- buyer / seller qualification status
- project
- workstream

The lead detail page exposes a primary `Return to list` button.

The return target is restricted to `/leads` or `/leads?...`; arbitrary URLs and lead-detail paths fail closed to `/leads`.

### Fresh ordering on return

`Return to list` performs normal navigation back to the filtered list, so the server queries the leads again using the existing ordering:

1. status ascending
2. priority descending
3. updatedAt descending

Therefore, if a working batch is all Priority 3 and the current lead is lowered to Priority 2, returning to the list moves that lead below the remaining Priority 3 leads.

The return link also targets the `#lead-list` anchor so the browser jumps directly to the refreshed working cards rather than the summary/filter controls above them.

### Edit Lead preserves queue context

If the full Edit Lead form is opened and saved, its hidden `returnTo` value is preserved in the detail URL. This means changing Contact Attempt or other fields does not lose the calling-list return target.

## Security

The return URL is user-controlled query-string input, so it is normalized by `safeLeadListReturnTo`.

Only these shapes are accepted:

```text
/leads
/leads?...filters...
```

Anything else resolves to `/leads`, preventing this feature from becoming an open redirect.

## Database / Prisma

None.

Stage 8.8.2 adds no migration and does not change `schema.prisma`.

The complete `prisma/migrations` directory is byte-for-byte identical to Stage 8.8.1.

## Tests

`check:stage8.8.2` verifies:

- exact filtered list URL survives lead navigation
- invalid/non-list return targets fail closed
- there is exactly one quick-priority form and it is in the existing Details priority row
- the list page passes its exact current URL into lead links
- the working list has an anchor for direct return

A mutation proof weakened the return-target restriction. The test failed, then passed again after restoration.
