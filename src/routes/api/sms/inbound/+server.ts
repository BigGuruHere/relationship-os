// PURPOSE: handle incoming SMS keyword and reply with your link and vCard.
// SECURITY: do not echo back any sensitive info. This is public-facing.

import type { RequestHandler } from './$types';
import { xml } from 'xmlbuilder2';

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const from = String(form.get('From') ?? '');
  // const body = String(form.get('Body') ?? '').trim().toLowerCase();

  const message = `Great to meet you. Save my contact: https://yourapp.com/api/vcard?name=Your%20Name&link=https%3A%2F%2Fyourapp.com%2Fu%2Fterence
Connect here: https://yourapp.com/u/terence`;

  const twiml = xml({ version: '1.0' })
    .ele('Response')
    .ele('Message').txt(message).up()
    .end({ prettyPrint: false });

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
};
