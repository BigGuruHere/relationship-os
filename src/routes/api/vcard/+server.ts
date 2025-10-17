// src/routes/api/vcard/+server.ts
// PURPOSE:
// - Serve a dynamic vCard so recipients can save a contact with real details
// - Support either direct query params or a slug that maps to a public profile URL
// ENVS:
// - Makes links absolute using locals.appOrigin so it works on local, dev, and prod
// SECURITY:
// - Values are treated as plain text and lightly sanitized for vCard syntax
// NOTES:
// - All IT code is commented and uses hyphens only

import type { RequestHandler } from './$types';
import { absoluteUrlFromOrigin } from '$lib/url';

// Basic vCard escaping for commas, semicolons, and newlines
function esc(input: string | null | undefined): string {
  const s = (input ?? '').toString();
  return s
    .replace(/\\/g, '\\\\')   // backslash
    .replace(/\r?\n/g, '\\n') // newlines
    .replace(/,/g, '\\,')     // commas
    .replace(/;/g, '\\;');    // semicolons
}

// Simple filename-friendly slug
function fileSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'contact'
  );
}

// Normalize any provided link into an absolute URL using the current env origin
function normalizeLink(origin: string, link: string | null, slug: string | null): string | null {
  // If a slug is provided, prefer that
  if (slug && slug.trim()) {
    return absoluteUrlFromOrigin(origin, `/u/${slug.trim()}`);
  }

  if (!link || !link.trim()) return null;

  const raw = link.trim();

  // If link is already absolute, keep it
  try {
    const u = new URL(raw);
    return u.toString();
  } catch {
    // Not a valid absolute URL - treat as a path and make it absolute
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return absoluteUrlFromOrigin(origin, path);
  }
}

export const GET: RequestHandler = async ({ url, locals }) => {
  // Read query params
  const name  = url.searchParams.get('name');   // display name
  const org   = url.searchParams.get('org');    // company
  const title = url.searchParams.get('title');  // job title
  const email = url.searchParams.get('email');  // public email
  const phone = url.searchParams.get('phone');  // public phone
  const link  = url.searchParams.get('link');   // profile URL or relative path
  const slug  = url.searchParams.get('slug');   // optional profile slug for /u/[slug]

  // Build an env-aware absolute link
  const absoluteLink = normalizeLink(locals.appOrigin, link, slug);

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
  if (absoluteLink) lines.push(`URL:${esc(absoluteLink)}`);

  lines.push('END:VCARD');

  const vcf = lines.join('\r\n'); // vCard prefers CRLF
  const fname = fileSlug(name || 'contact');

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${fname}.vcf"`
    }
  });
};
