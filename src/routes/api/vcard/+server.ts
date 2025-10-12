// PURPOSE: serve a dynamic vCard for easy “save my contact”.
// SECURITY: accepts only public fields - nothing sensitive.

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const name = url.searchParams.get('name') ?? 'Your Name';
  const phone = url.searchParams.get('phone') ?? '';
  const email = url.searchParams.get('email') ?? '';
  const link = url.searchParams.get('link') ?? '';

  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    phone ? `TEL;TYPE=CELL:${phone}` : null,
    email ? `EMAIL;TYPE=INTERNET:${email}` : null,
    link ? `URL:${link}` : null,
    'END:VCARD'
  ].filter(Boolean).join('\n');

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard',
      'Content-Disposition': 'attachment; filename="contact.vcf"'
    }
  });
};
