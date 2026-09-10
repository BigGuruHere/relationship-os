// PURPOSE: Shared company-identity helpers for optional external identifiers and conservative duplicate warnings.
// IT: External identifiers strengthen identity resolution when present, but a Company never requires one.

export const COMPANY_EXTERNAL_IDENTIFIER_SCHEMES = [
  { value: 'ABN', label: 'ABN' },
  { value: 'ACN', label: 'ACN' },
  { value: 'ASQA_RTO', label: 'ASQA RTO registration' },
  { value: 'AGED_CARE_PROVIDER', label: 'Aged care provider ID' }
] as const;

export function normaliseCompanyIdentifierScheme(input: unknown) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function companyIdentifierLabel(scheme: string) {
  const normalised = normaliseCompanyIdentifierScheme(scheme);
  return COMPANY_EXTERNAL_IDENTIFIER_SCHEMES.find((option) => option.value === normalised)?.label || normalised.replace(/_/g, ' ');
}

export function normaliseCompanyIdentifierValue(input: unknown) {
  // IT: Preserve public registration formatting and leading zeroes; only tidy surrounding/repeated whitespace.
  return String(input || '').trim().replace(/\s+/g, ' ').slice(0, 240);
}

export function companyIdentifierComparisonKey(scheme: string, value: unknown) {
  const normalisedScheme = normaliseCompanyIdentifierScheme(scheme);
  const normalisedValue = normaliseCompanyIdentifierValue(value).toUpperCase();
  // IT: ABN/ACN are commonly entered with or without spaces. Treat formatting-only differences as the same identifier.
  if (normalisedScheme === 'ABN' || normalisedScheme === 'ACN') return normalisedValue.replace(/[^A-Z0-9]/g, '');
  return normalisedValue;
}

export function normaliseCompanyNameForDuplicateWarning(input: unknown) {
  // IT: This is deliberately conservative. It catches punctuation and common legal-suffix variants,
  // but it is only a warning key and must never auto-merge two Companies.
  let value = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const suffixes = [
    'proprietary limited',
    'pty limited',
    'pty ltd',
    'limited',
    'ltd',
    'incorporated',
    'inc'
  ];
  let changed = true;
  while (changed && value) {
    changed = false;
    for (const suffix of suffixes) {
      if (value === suffix) continue;
      if (value.endsWith(` ${suffix}`)) {
        value = value.slice(0, -(suffix.length + 1)).trim();
        changed = true;
        break;
      }
    }
  }
  return value;
}
