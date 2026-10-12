// PURPOSE: Pure telephony normalization shared by call-initiation identity and post-call ingestion.
function clean(value: unknown, max = 240) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : '';
}

export function normalizePhoneForIdentity(value: unknown, defaultCountry = process.env.TELEPHONY_DEFAULT_COUNTRY || 'AU') {
  const raw = clean(value, 80);
  if (!raw) return null;
  let compact = raw.replace(/[()\s.-]/g, '');
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
  if (compact.startsWith('+')) {
    const digits = compact.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = compact.replace(/\D/g, '');
  if (!digits) return null;
  if (defaultCountry.toUpperCase() === 'AU') {
    if (digits.startsWith('61') && digits.length >= 10) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 10) return `+61${digits.slice(1)}`;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}
