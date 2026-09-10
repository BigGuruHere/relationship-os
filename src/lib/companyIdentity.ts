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

function companyNameTypoDistance(left: string, right: string) {
  // IT: Optimal-string-alignment distance treats one adjacent transposition as one typo.
  // This keeps the helper dependency-free and intentionally suitable only for warnings, never merges.
  const a = left.replace(/\s+/g, '');
  const b = right.replace(/\s+/g, '');
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[a.length][b.length];
}

export function areCompanyNamesSimilarForDuplicateWarning(left: unknown, right: unknown) {
  const a = normaliseCompanyNameForDuplicateWarning(left);
  const b = normaliseCompanyNameForDuplicateWarning(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const compactA = a.replace(/\s+/g, '');
  const compactB = b.replace(/\s+/g, '');
  const maxLength = Math.max(compactA.length, compactB.length);
  const minLength = Math.min(compactA.length, compactB.length);

  // IT: Avoid noisy substring/fragment warnings such as "Cola" vs "Coca Cola".
  // A fuzzy warning requires both names to be substantial and broadly the same length.
  if (minLength < 5 || Math.abs(compactA.length - compactB.length) > 2) return false;

  const distance = companyNameTypoDistance(a, b);
  if (distance <= 1 && maxLength >= 6) return true;

  // IT: Permit two edits only on longer names, where two typos are still strong evidence
  // and less likely to confuse genuinely different short company names.
  return distance <= 2 && maxLength >= 12;
}

