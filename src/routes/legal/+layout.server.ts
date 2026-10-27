import type { LayoutServerLoad } from './$types';
// Values are provided by this server only; never accept browser-controlled legal versions.
export const load: LayoutServerLoad = () => ({
  legalPublished: process.env.RELISH_LEGAL_DOCUMENTS_PUBLISHED === 'YES',
  legalVersion: process.env.RELISH_PILOT_TERMS_VERSION || ''
});
