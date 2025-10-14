// PURPOSE: serve a dynamic vCard so recipients can save your contact with real details.
// INPUT via query string: name, org, title, email, phone, link
// FALLBACKS: if a field is missing, it is omitted - we do not emit blank lines.
// SECURITY: values are treated as plain text and lightly sanitized for vCard syntax.
// NOTE: all IT code is commented and uses hyphens only.

import type { RequestHandler } from './$types';

// Basic vCard escaping for commas, semicolons, and newlines
function esc(input: string | null | undefined): string {
  const s = (input ?? '').toString();
  return s
    .replace(/\\/g, '\\\\')     // backslash
    .replace(/\n/g, '\\n')      // newlines
    .replace(/,/g, '\\,')       // commas
    .replace(/;/g, '\\;');      // semicolons
}

// Simple filename-friendly slug
function fileSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'contact';
}

export const GET: RequestHandler = async ({ url }) => {
  // Read query params
  const name  = url.searchParams.get('name');   // display name
  const org   = url.searchParams.get('org');    // company
  const title = url.searchParams.get('title');  // job title
  const email = url.searchParams.get('email');  // public email
  const phone = url.searchParams.get('phone');  // public phone
  const link  = url.searchParams.get('link');   // your public profile URL

  // Build lines conditionally - only include non-empty fields
  const lines: string[] = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');

  if (name) {
    // N is structured - we only have display name, so use FN and a flat N
    lines.push(`FN:${esc(name)}`);
    lines.push(`N:${esc(name)};;;;`);
  }
  if (org)   lines.push(`ORG:${esc(org)}`);
  if (title) lines.push(`TITLE:${esc(title)}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${esc(phone)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${esc(email)}`);
  if (link)  lines.push(`URL:${esc(link)}`);

  lines.push('END:VCARD');

  const vcf = lines.join('\n');
  const fname = fileSlug(name || 'contact');

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard',
      'Content-Disposition': `attachment; filename="${fname}.vcf"`
    }
  });
};
