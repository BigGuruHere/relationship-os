// PURPOSE: Browser/server-safe helpers for selected lead batch imports.

export type LeadImportRow = {
  rowNumber: number;
  companyName: string;
  externalCode: string;
  companyPhone: string;
  website: string;
  geography: string;
  personName: string;
  roleTitle: string;
  email: string;
  phone: string;
  research: string;
  researchProvider: string;
  researchDate: string;
  sourceUrl: string;
};

export function normaliseExternalScheme(input: string) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function normaliseExternalValue(input: string) {
  // IT: Keep leading zeroes and public registration formatting meaningful.
  return String(input || '').trim().replace(/\s+/g, ' ');
}

export function buildImportedResearchNote(params: {
  batchName: string;
  sourceFileName?: string;
  row: LeadImportRow;
  externalScheme: string;
}) {
  const research = String(params.row.research || '').trim();
  if (!research) return '';

  const metadata = [
    `Import batch: ${params.batchName}`,
    params.sourceFileName ? `Import file: ${params.sourceFileName}` : '',
    `Spreadsheet row: ${params.row.rowNumber}`,
    `External reference: ${params.externalScheme} / ${params.row.externalCode}`,
    params.row.researchProvider ? `Research provider: ${params.row.researchProvider}` : '',
    params.row.researchDate ? `Research date: ${params.row.researchDate}` : '',
    params.row.sourceUrl ? `Source URL: ${params.row.sourceUrl}` : ''
  ].filter(Boolean);

  return `${metadata.join('\n')}\n\n${research}`;
}
