// src/routes/reminders/+page.server.ts
// PURPOSE: Preserve compatibility by redirecting to Inbox - reminders section
// SECURITY: No data exposure

import { redirect } from '@sveltejs/kit';
export const load = () => {
  throw redirect(307, '/inbox#reminders');
};
