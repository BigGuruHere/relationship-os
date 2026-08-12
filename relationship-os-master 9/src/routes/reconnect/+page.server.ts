// src/routes/reconnect/+page.server.ts
// PURPOSE: Preserve compatibility by redirecting to Inbox - reconnect section
// SECURITY: No data exposure

import { redirect } from '@sveltejs/kit';
export const load = () => {
  throw redirect(307, '/actions#reconnect');
};
