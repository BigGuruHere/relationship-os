# Stage 5.2 Duplicate Warning Patch

This patch changes duplicate checks from hard blocks into a review-and-confirm flow.

## Behaviour

### Contacts

- Same contact name now shows a possible duplicate warning instead of blocking creation.
- Same phone and same email also show warnings.
- Existing possible matches are displayed with company, position, email and phone when available.
- Each match includes an Open link that opens the existing contact in a new tab.
- The user can click Create anyway to create a separate contact record.

### Companies

- Same company name now shows a possible duplicate warning instead of blocking creation.
- Same phone and same website also show warnings.
- Existing possible matches are displayed with website, phone, industry and location when available.
- Each match includes an Open link that opens the existing company in a new tab.
- The user can click Create anyway to create a separate company record.

## Schema changes

New migration:

- `20260817172500_soft_duplicate_warnings`

It removes hard uniqueness for:

- Contact email index
- Company user/name index

and replaces them with normal indexes so duplicates can be handled by the UI rather than blocked at the database layer.

## Test cases

1. Create a contact with the same name as an existing contact.
   - Expected: warning appears, existing contact can be opened, Create anyway works.

2. Create a contact with the same phone as an existing contact.
   - Expected: warning appears, Create anyway works.

3. Create a company with the same name as an existing company.
   - Expected: warning appears, existing company can be opened, Create anyway works.

4. Create a company with the same phone or website.
   - Expected: warning appears, Create anyway works.
